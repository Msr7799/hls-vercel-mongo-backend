import { MongoClient } from 'mongodb';

const DB_NAME = 'hls_collector';
const COLLECTION = 'sticky_state';
const DOC_ID = 'main';

function buildMongoUri() {
  const raw = String(process.env.MONGODB_URI || '').trim();
  const username = String(process.env.MONGODB_USERNAME || '').trim();
  const password = String(process.env.MONGODB_PASSWORD || '').trim();

  if (!raw) throw new Error('Missing MONGODB_URI');
  if (!username) throw new Error('Missing MONGODB_USERNAME');
  if (!password) throw new Error('Missing MONGODB_PASSWORD');

  const user = encodeURIComponent(username);
  const pass = encodeURIComponent(password);

  // Supported form 1:
  // mongodb+srv://{username}:{password}@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
  if (raw.includes('{username}') || raw.includes('{password}')) {
    return raw
      .replaceAll('{username}', user)
      .replaceAll('{password}', pass);
  }

  // Supported form 2:
  // mongodb+srv://cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
  const scheme = raw.match(/^mongodb(?:\+srv)?:\/\//i)?.[0];
  if (scheme) {
    const rest = raw.slice(scheme.length);

    // If credentials were already included, respect the provided full URI.
    if (rest.includes('@')) return raw;

    return `${scheme}${user}:${pass}@${rest}`;
  }

  // Supported form 3:
  // cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
  return `mongodb+srv://${user}:${pass}@${raw}`;
}

function getClientPromise() {
  if (!globalThis.__HLS_MONGO_CLIENT_PROMISE__) {
    const client = new MongoClient(buildMongoUri(), {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000
    });
    globalThis.__HLS_MONGO_CLIENT_PROMISE__ = client.connect();
  }
  return globalThis.__HLS_MONGO_CLIENT_PROMISE__;
}

async function getCollection() {
  const client = await getClientPromise();
  return client.db(DB_NAME).collection(COLLECTION);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Collector-Token');
  res.setHeader('Cache-Control', 'no-store');
}

function authorized(req) {
  const expected = String(process.env.SYNC_TOKEN || '');
  if (!expected) return true;
  const got = String(req.headers['x-collector-token'] || '');
  return got === expected;
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); }
  catch { return {}; }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      if (req.query?.health === '1') {
        await getClientPromise();
        return res.status(200).json({ ok: true, mongo: 'connected' });
      }

      const col = await getCollection();
      const doc = await col.findOne(
        { _id: DOC_ID },
        { projection: { _id: 0, data: 1, updatedAt: 1 } }
      );

      return res.status(200).json({
        ok: true,
        data: doc?.data || {},
        updatedAt: doc?.updatedAt || null
      });
    }

    if (req.method === 'PUT') {
      const body = parseBody(req);
      const data = body?.data;

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({ ok: false, error: 'body.data must be an object' });
      }

      const col = await getCollection();
      const now = new Date();

      await col.updateOne(
        { _id: DOC_ID },
        {
          $set: { data, updatedAt: now },
          $setOnInsert: { createdAt: now }
        },
        { upsert: true }
      );

      return res.status(200).json({ ok: true, updatedAt: now.toISOString() });
    }

    if (req.method === 'DELETE') {
      const col = await getCollection();
      await col.deleteOne({ _id: DOC_ID });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE, OPTIONS');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (error) {
    console.error('[HLS Collector API]', error);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}
