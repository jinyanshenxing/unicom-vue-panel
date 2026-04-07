'use strict';

/* ===== State ===== */
const S = { phone: '', token: '', smsStep: 'send', countdown: 0, timer: null };

/* ===== API ===== */
async function api(path, extra = {}) {
  const res = await fetch('/api' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(S.token ? { 'x-ecs-token': S.token } : {}),
    },
    body: JSON.stringify({ mobileNumber: S.phone, ...extra }),
  });

  const data = await res.json();
  console.log(`[API] ${path}`, data);

  if (!res.ok || (data.code && !['0000', '200', 200, '1000', 'success', 'SUCCESS'].includes(data.code))) {
    throw new Error(data.message || data.resultMessage || data.msg || `请求失败 (${res.status})`);
  }
  return data;
}

/* ===== Common ===== */
const id = i => document.getElementById(i);
const val = i => id(i).value.trim();

const esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const row = (k, v) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`;

function show(elId, visible) {
  const el = id(elId);
  if (el) el.style.display = visible ? '' : 'none';
}

function showMsg(elId, text, type) {
  const el = id(elId);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.textContent = '';
    el.className = 'msg';
  }, 5000);
}

function dig(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;

  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }

  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      const found = dig(v, ...keys);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function findArray(obj, ...preferKeys) {
  if (!obj || typeof obj !== 'object') return [];

  for (const k of preferKeys) {
    if (Array.isArray(obj[k])) return obj[k];
  }

  for (const [, v] of Object.entries(obj)) {
    if (Array.isArray(v)) return v;
  }

  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = findArray(v, ...preferKeys);
      if (found.length || Array.isArray(found)) return found;
    }
  }

  return [];
}

function parseNum(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function parseMB(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;

  const s = String(v).trim().toUpperCase().replace(/,/g, '');
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;

  if (s.endsWith('TB') || s.endsWith('T')) return n * 1024 * 1024;
  if (s.endsWith('GB') || s.endsWith('G')) return n * 1024;
  if (s.endsWith('MB') || s.endsWith('M')) return n;
  if (s.endsWith('KB') || s.endsWith('K')) return n / 1024;

  return n;
}

function fmtFlow(mb) {
  if (mb === undefined || mb === null || Number.isNaN(mb)) return '—';
  if (mb === 0) return '0 MB';
  if (mb >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
  return mb.toFixed(0) + ' MB';
}

function normalizeRate(v) {
  if (v === undefined || v === null || v === '') return '—';
  const s = String(v).trim();
  const m = s.match(/([\d.]+)\s*([A-Za-z\/]+)?/);
  if (!m) return s;
  const num = m[1];
  const unit = m[2] || 'Mbps';
  if (/mbps/i.test(unit)) return num;
  return `${num} ${unit}`;
}

/* ===== Login ===== */
function switchLoginTab(type, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  show('login-sms', type === 'sms');
  show('login-token', type === 'token');
}

async function handleSmsLogin() {
  const phone = val('inp-phone');
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showMsg('msg-sms', '请输入有效的联通手机号', 'err');
    return;
  }

  S.phone = phone;

  if (S.smsStep === 'send') {
    const btn = id('btn-sms-submit');
    btn.disabled = true;
    btn.textContent = '发送中...';

    try {
      await api('/send-sms');
      showMsg('msg-sms', '验证码已发送，请注意查收', 'ok');
      show('sms-code-group', true);
      btn.textContent = '登 录';
      S.smsStep = 'verify';
      startCountdown();
    } catch (e) {
      showMsg('msg-sms', e.message, 'err');
      btn.textContent = '获取验证码';
    }

    btn.disabled = false;
    return;
  }

  const code = val('inp-code');
  if (!code) {
    showMsg('msg-sms', '请输入验证码', 'err');
    return;
  }

  const btn = id('btn-sms-submit');
  btn.disabled = true;
  btn.textContent = '登录中...';

  try {
    const data = await api('/login-sms', { randomNum: code });
    S.token =
      data.token ||
      data.ecs_token ||
      data.accessToken ||
      data.result?.token ||
      data.result?.ecs_token ||
      data.data?.token ||
      data.data?.ecs_token ||
      '';

    console.log('[login] token prefix =', S.token ? S.token.slice(0, 20) + '...' : '(none)');
    onLoginSuccess();
  } catch (e) {
    showMsg('msg-sms', e.message, 'err');
    btn.disabled = false;
    btn.textContent = '登 录';
  }
}

async function sendSms() {
  const phone = val('inp-phone');
  if (!/^1[3-9]\d{9}$/.test(phone)) return;
  S.phone = phone;

  try {
    await api('/send-sms');
    startCountdown();
    showMsg('msg-sms', '验证码已重新发送', 'ok');
  } catch (e) {
    showMsg('msg-sms', e.message, 'err');
  }
}

function startCountdown() {
  S.countdown = 60;
  const btn = id('btn-resend');
  btn.disabled = true;
  btn.textContent = `${S.countdown}s 后重发`;

  clearInterval(S.timer);
  S.timer = setInterval(() => {
    S.countdown--;
    btn.textContent = `${S.countdown}s 后重发`;
    if (S.countdown <= 0) {
      clearInterval(S.timer);
      btn.textContent = '重新发送';
      btn.disabled = false;
    }
  }, 1000);
}

async function handleTokenLogin() {
  const token = val('inp-token').trim();
  if (!token) {
    showMsg('msg-token', '请输入 ECS Token', 'err');
    return;
  }

  S.token = token;
  S.phone = val('inp-token-phone');

  const btn = document.querySelector('#login-token .btn-primary');
  btn.disabled = true;
  btn.textContent = '验证中...';

  try {
    await api('/flow');
    onLoginSuccess();
  } catch (e) {
    showMsg('msg-token', 'Token 无效或已过期：' + e.message, 'err');
    S.token = '';
    btn.disabled = false;
    btn.textContent = '验证并登录';
  }
}

function onLoginSuccess() {
  show('page-login', false);
  show('page-dash', true);
  show('header-user', true);
  id('header-phone').textContent = S.phone || '已登录';
  loadAll();
}

function logout() {
  Object.assign(S, { phone: '', token: '', smsStep: 'send', countdown: 0 });
  clearInterval(S.timer);
  show('page-login', true);
  show('page-dash', false);
  show('header-user', false);
  show('sms-code-group', false);
  id('btn-sms-submit').textContent = '获取验证码';
  ['inp-phone', 'inp-code', 'inp-token', 'inp-token-phone'].forEach(i => id(i).value = '');
}

/* ===== Data ===== */
function loadAll() {
  loadFlow();
  loadSpeed();
  loadBiz();
}

async function refreshAll() {
  const btn = id('btn-refresh');
  btn.classList.add('spinning');

  id('pkg-list').innerHTML = '<div class="loading-row"><div class="spinner"></div>刷新中...</div>';
  id('speed-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  id('biz-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';

  await Promise.allSettled([loadFlow(), loadSpeed(), loadBiz()]);
  btn.classList.remove('spinning');
}

/* ===== Flow ===== */
async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
  } catch (e) {
    id('pkg-list').innerHTML = `<div class="error-tip">流量查询失败：${esc(e.message)}</div>`;
  }
}

function renderFlow(raw) {
  console.log('[flow] raw =', raw);

  // 顶层真实字段
  const usedMB = parseMB(raw.flowUsed);
  const leftMB = parseMB(raw.allUserFlo);

  // total 优先找 allFlow；没有就 left + used
  let totalMB = parseMB(raw.allFlow);
  if (!totalMB && (leftMB || usedMB)) totalMB = leftMB + usedMB;

  // 百分比优先用 flowPersent，没有就用计算值
  let pct = parseNum(raw.flowPersent);
  if (!pct && totalMB > 0) pct = Math.round((usedMB / totalMB) * 100);

  id('s-remain').textContent = fmtFlow(leftMB);
  id('s-used').textContent = fmtFlow(usedMB);
  id('s-total').textContent = fmtFlow(totalMB);
  id('s-pct').textContent = `${Math.round(pct || 0)}%`;

  id('bar-used-lbl').textContent = `已用 ${fmtFlow(usedMB)}`;
  id('bar-total-lbl').textContent = `共 ${fmtFlow(totalMB)}`;

  const bar = id('main-bar');
  if (bar) {
    bar.style.width = `${Math.min(Math.max(pct || 0, 0), 100)}%`;
    bar.style.background = pct > 85 ? '#dc2626' : pct > 60 ? '#d97706' : '#2563eb';
  }

  // 明细流量包：你这个接口里 XsbResources[0].details 是空数组，所以这里只做兜底展示
  const xsb = Array.isArray(raw.XsbResources) ? raw.XsbResources : [];
  const details = xsb.flatMap(x => Array.isArray(x.details) ? x.details : []);

  console.log('[flow] XsbResources count=', xsb.length, 'details count=', details.length);

  if (!details.length) {
    id('pkg-list').innerHTML = `
      <div class="pkg-item">
        <div class="pkg-left">
          <div class="pkg-name">流量包</div>
          <div class="pkg-expire">&nbsp;</div>
          <div class="mini-bar-bg">
            <div class="mini-bar" style="width:${Math.min(Math.max(pct || 0, 0), 100)}%;background:#2563eb"></div>
          </div>
        </div>
        <div class="pkg-right">
          <div class="pkg-remain">${fmtFlow(leftMB)}</div>
          <div class="pkg-of">/ ${fmtFlow(totalMB)}</div>
          <span class="pkg-pct green">已用 ${Math.round(pct || 0)}%</span>
        </div>
      </div>
    `;
    return;
  }

  let html = '';
  for (const p of details) {
    const t = parseMB(p.totalFlow || p.total || p.packageFlow || p.allFlow);
    const u = parseMB(p.usedFlow || p.used || p.flowUsed);
    const l = parseMB(p.leftFlow || p.remainFlow || p.balance || p.allUserFlo) || Math.max(t - u, 0);
    const pp = t > 0 ? Math.round((u / t) * 100) : 0;
    const cls = pp > 85 ? 'red' : pp > 60 ? 'amber' : 'green';
    const color = pp > 85 ? '#dc2626' : pp > 60 ? '#d97706' : '#2563eb';

    html += `
      <div class="pkg-item">
        <div class="pkg-left">
          <div class="pkg-name">${esc(p.packageName || p.name || p.productName || '流量包')}</div>
          <div class="pkg-expire">${esc(p.expireDate || p.endDate || '') || '&nbsp;'}</div>
          <div class="mini-bar-bg">
            <div class="mini-bar" style="width:${Math.min(pp, 100)}%;background:${color}"></div>
          </div>
        </div>
        <div class="pkg-right">
          <div class="pkg-remain">${fmtFlow(l)}</div>
          <div class="pkg-of">/ ${fmtFlow(t)}</div>
          <span class="pkg-pct ${cls}">已用 ${pp}%</span>
        </div>
      </div>
    `;
  }

  id('pkg-list').innerHTML = html;
}

/* ===== Speed ===== */
async function loadSpeed() {
  try {
    const data = await api('/speed');
    renderSpeed(data);
  } catch (e) {
    id('speed-area').innerHTML = `<div class="error-tip">速率查询失败：${esc(e.message)}</div>`;
  }
}

function renderSpeed(raw) {
  console.log('[speed] raw =', raw);

  const rate = raw.rateResource?.rate || '';
  const flowRes = raw.flowResource || {};
  const net = raw.corner || raw.terminalResource?.terminal || raw.networkType || '5G';

  // 这个接口实际只有一个 rate=500Mbps，不区分上下行
  const down = normalizeRate(rate);
  const up = '—';

  const qci = raw.qci || raw.qciLevel || '—';

  const isWarn = String(flowRes.isWarn || '0') === '1';
  const limitText = isWarn ? '<span class="pkg-pct amber">可能受限</span>' : '<span class="pkg-pct green">正常</span>';

  id('net-badge').textContent = net;
  id('speed-area').innerHTML = `
    <div class="speed-pair">
      <div class="speed-block">
        <div class="speed-icon dl">↓</div>
        <div>
          <div class="speed-val">${esc(String(down))}</div>
          <div class="speed-unit">Mbps 下行</div>
        </div>
      </div>
      <div class="speed-block">
        <div class="speed-icon ul">↑</div>
        <div>
          <div class="speed-val">${esc(String(up))}</div>
          <div class="speed-unit">Mbps 上行</div>
        </div>
      </div>
    </div>
    <div class="info-rows">
      ${row('QCI 等级', esc(String(qci)))}
      ${row('网络类型', esc(String(net)))}
      ${row('限速状态', limitText)}
    </div>
  `;
}

/* ===== Biz ===== */
async function loadBiz() {
  try {
    const data = await api('/biz');
    renderBiz(data);
  } catch (e) {
    id('biz-area').innerHTML = `<div class="error-tip">业务查询失败：${esc(e.message)}</div>`;
  }
}

function renderBiz(raw) {
  console.log('[biz] raw =', raw);

  const list =
    raw.mainProductInfo ||
    raw.data?.mainProductInfo ||
    findArray(raw, 'mainProductInfo', 'list', 'orderList', 'serviceList', 'bizList', 'items', 'records', 'productList');

  console.log('[biz] items count=', list.length, 'first=', list[0]);

  id('biz-count').textContent = list.length ? `${list.length} 项` : '';

  if (!list.length) {
    id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>';
    return;
  }

  id('biz-area').innerHTML = list.map(b => {
    const name = b.productName || b.serviceName || b.name || '业务';
    const date = b.startDate || b.subscribeDate || b.createDate || b.orderDate || '';
    const price = b.productFee || b.price || b.fee || b.amount || '';

    return `
      <div class="biz-item">
        <div>
          <div class="biz-name">${esc(name)}</div>
          ${date ? `<div class="biz-date">${esc(date)}</div>` : ''}
        </div>
        <div class="biz-price">${price ? '¥' + esc(String(price)) + '/月' : '免费'}</div>
      </div>
    `;
  }).join('');
}