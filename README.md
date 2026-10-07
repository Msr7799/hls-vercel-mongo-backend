# HLS Sticky Collector - Vercel + MongoDB API

This backend stores the Tampermonkey collector state in MongoDB without exposing the MongoDB login inside the userscript.

## 1. MongoDB environment variables

Add these in **Vercel -> Project -> Settings -> Environment Variables**:

```env
MONGODB_USERNAME=your_mongodb_user
MONGODB_PASSWORD=your_mongodb_password
MONGODB_URI=mongodb+srv://cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

`MONGODB_URI` may also use placeholders:

```env
MONGODB_URI=mongodb+srv://{username}:{password}@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
```

The server URL-encodes the username and password before inserting them.

### Recommended security variable

Because a Vercel API URL is public, also add a long random token:

```env
SYNC_TOKEN=put-a-long-random-private-value-here
```

Then put the same token in `REMOTE.token` in the userscript. If `SYNC_TOKEN` is left blank, anyone who knows your API address can call the read/write/delete endpoint.

## 2. Deploy to Vercel

Upload/push this folder to a Git repository, import the repository into Vercel, add the environment variables above, and deploy.

Your endpoint will be:

```text
https://YOUR-PROJECT.vercel.app/api/state
```

Test MongoDB connectivity with:

```text
https://YOUR-PROJECT.vercel.app/api/state?health=1
```

A successful response is similar to:

```json
{"ok":true,"mongo":"connected"}
```

## 3. Configure Tampermonkey

At the top of `HLS_Sticky_Collector_Vercel_Mongo.user.js` set:

```js
const REMOTE = {
  enabled: true,
  domain: 'https://YOUR-PROJECT.vercel.app',
  token: 'same value as SYNC_TOKEN, or empty if you did not set one'
};
```

You only put the Vercel domain in the userscript. The MongoDB username, password and URI stay on Vercel.

## API behavior

- `GET /api/state` -> returns the saved sticky-note database
- `PUT /api/state` -> saves/replaces the sticky-note database
- `DELETE /api/state` -> deletes the remote saved database
- `GET /api/state?health=1` -> tests MongoDB connectivity

The MongoDB database name is `hls_collector`, collection `sticky_state`, document `_id: "main"`.
