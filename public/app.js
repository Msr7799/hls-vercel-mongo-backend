const endpoint = `${window.location.origin}/api/state`;
const elements = {
  endpoint: document.querySelector('#endpoint'), token: document.querySelector('#token'),
  toggleToken: document.querySelector('#toggleToken'), healthButton: document.querySelector('#healthButton'),
  readButton: document.querySelector('#readButton'), copyButton: document.querySelector('#copyButton'),
  liveBadge: document.querySelector('#liveBadge'), apiStatus: document.querySelector('#apiStatus'),
  mongoStatus: document.querySelector('#mongoStatus'), latencyStatus: document.querySelector('#latencyStatus'),
  authStatus: document.querySelector('#authStatus'), debugLog: document.querySelector('#debugLog'),
  emptyState: document.querySelector('#emptyState'), requestCount: document.querySelector('#requestCount'),
  clock: document.querySelector('#clock')
};
let requestCount = 0;
elements.endpoint.value = endpoint;

function setTextStatus(element, text, ok) {
  element.textContent = text;
  element.classList.remove('good', 'bad');
  if (ok === true) element.classList.add('good');
  if (ok === false) element.classList.add('bad');
}
function setLive(state, text) {
  elements.liveBadge.className = `live-badge is-${state}`;
  elements.liveBadge.querySelector('strong').textContent = text;
}
function safeJson(value) {
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}
function addDebug({ method, path, status, duration, body, error }) {
  requestCount += 1;
  elements.requestCount.textContent = `${requestCount} طلب`;
  elements.emptyState.hidden = true;
  const item = document.createElement('article');
  item.className = 'debug-item';
  const summary = document.createElement('div');
  summary.className = 'debug-summary';
  const methodNode = document.createElement('span');
  methodNode.className = 'method';
  methodNode.textContent = method;
  const pathNode = document.createElement('span');
  pathNode.textContent = path;
  const statusNode = document.createElement('span');
  statusNode.className = `status${error || status >= 400 ? ' error' : ''}`;
  statusNode.textContent = error ? 'NETWORK ERROR' : `${status} · ${duration}ms`;
  summary.append(methodNode, pathNode, statusNode);
  const output = document.createElement('pre');
  output.textContent = error || safeJson(body);
  item.append(summary, output);
  elements.debugLog.prepend(item);
}
async function apiRequest(path) {
  const started = performance.now();
  const headers = { Accept: 'application/json' };
  const token = elements.token.value.trim();
  if (token) headers['X-Collector-Token'] = token;
  setLive('idle', 'جارٍ الاتصال…');
  elements.healthButton.disabled = true;
  elements.readButton.disabled = true;
  try {
    const response = await fetch(`${endpoint}${path}`, { headers, cache: 'no-store' });
    const duration = Math.round(performance.now() - started);
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    addDebug({ method: 'GET', path: `/api/state${path}`, status: response.status, duration, body });
    setTextStatus(elements.apiStatus, response.ok ? 'متصلة' : `خطأ ${response.status}`, response.ok);
    setTextStatus(elements.latencyStatus, `${duration} ms`, response.ok);
    setLive(response.ok ? 'online' : 'error', response.ok ? 'الخادم متصل' : 'فشل الطلب');
    return { response, body };
  } catch (error) {
    const duration = Math.round(performance.now() - started);
    addDebug({ method: 'GET', path: `/api/state${path}`, duration, error: error instanceof Error ? error.message : String(error) });
    setTextStatus(elements.apiStatus, 'غير متصلة', false);
    setTextStatus(elements.latencyStatus, `${duration} ms`, false);
    setLive('error', 'تعذر الاتصال');
    return null;
  } finally {
    elements.healthButton.disabled = false;
    elements.readButton.disabled = false;
  }
}
async function runHealth() {
  const result = await apiRequest('?health=1');
  if (!result) { setTextStatus(elements.mongoStatus, 'غير متاحة', false); return; }
  const { response, body } = result;
  setTextStatus(elements.mongoStatus, body?.mongo === 'connected' ? 'متصلة' : 'غير متصلة', body?.mongo === 'connected');
  const authText = body?.authentication === 'token-required' ? 'SYNC_TOKEN مفعّل' : body?.authentication === 'open' ? 'مفتوحة' : response.status === 401 ? 'التوكن مطلوب' : 'غير معروفة';
  setTextStatus(elements.authStatus, authText, body?.authentication === 'token-required');
}
function clearDebug() {
  requestCount = 0;
  elements.requestCount.textContent = '0 طلب';
  elements.debugLog.replaceChildren();
  elements.emptyState.hidden = false;
}
elements.healthButton.addEventListener('click', runHealth);
elements.readButton.addEventListener('click', () => apiRequest(''));
elements.copyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(endpoint);
  const original = elements.copyButton.textContent;
  elements.copyButton.textContent = 'تم النسخ';
  setTimeout(() => { elements.copyButton.textContent = original; }, 1400);
});
elements.toggleToken.addEventListener('click', () => {
  const showing = elements.token.type === 'text';
  elements.token.type = showing ? 'password' : 'text';
  elements.toggleToken.textContent = showing ? 'إظهار' : 'إخفاء';
});
document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.action === 'health') runHealth();
  if (button.dataset.action === 'read') apiRequest('');
  if (button.dataset.action === 'clear') clearDebug();
}));
function updateClock() {
  elements.clock.textContent = new Intl.DateTimeFormat('ar-BH', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date());
}
updateClock();
setInterval(updateClock, 1000);
runHealth();
