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

/* ===== Deep search helpers ===== */
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
    if (Array.isArray(obj[k]) && obj[k].length && typeof obj[k][0] === 'object') return obj[k];
  }

  for (const [, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
  }

  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = findArray(v, ...preferKeys);
      if (found.length) return found;
    }
  }

  return [];
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

/* ── Flow ── */
async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
  } catch (e) {
    id('pkg-list').innerHTML = `<div class="error-tip">流量查询失败：${esc(e.message)}<br>
      <small style="color:var(--text-3)">请按 F12 → Console 查看 [API] /flow 原始响应</small></div>`;
  }
}

function renderFlow(data) {
  const pkgs = findArray(
    data,
    'packageList',
    'flowPackageList',
    'pkgList',
    'packages',
    'list',
    'items',
    'records',
    'flowList',
    'XsbResources',
    'resources'
  );

  console.log('[flow] pkgs count=', pkgs.length, ' first=', pkgs[0]);

  let total = 0;
  let used = 0;
  let left = 0;
  let list = [];

  if (pkgs.length) {
    list = pkgs.map(p => {
      const detail = Array.isArray(p.details) && p.details.length ? p.details[0] : p;

      const t = parseMB(
        detail.total ||
        detail.packageFlow ||
        detail.flowSize ||
        detail.totalFlow ||
        detail.totalSize ||
        detail.allSize ||
        detail.allFlow
      );

      const u = parseMB(
        detail.usedFlow ||
        detail.used ||
        detail.usedSize ||
        detail.useFlow ||
        detail.usedTraffic ||
        detail.usedAmount ||
        detail.flowUsed
      );

      const l0 = parseMB(
        detail.leftFlow ||
        detail.remainFlow ||
        detail.left ||
        detail.remainSize ||
        detail.surplusFlow ||
        detail.balance ||
        detail.allUserFlo
      );

      const l = l0 || Math.max(t - u, 0);

      total += t;
      used += u;
      left += l;

      return {
        name: detail.packageName || detail.name || detail.productName || detail.offerName || detail.pkgName || p.feePolicyName || '流量包',
        t,
        u,
        l,
        expire: detail.expireDate || detail.endDate || detail.expiryDate || detail.validDate || detail.endTime || '',
      };
    });
  }

  // 顶层汇总兜底
  if (total === 0 && used === 0 && left === 0) {
    total = parseMB(dig(data, 'allFlow', 'totalFlow', 'sumFlow', 'packageFlow'));
    used = parseMB(dig(data, 'flowUsed', 'usedFlow', 'useFlow'));
    left = parseMB(dig(data, 'allUserFlo', 'leftFlow', 'remainFlow', 'surplusFlow'));

    if (!left && total > 0) {
      left = Math.max(total - used, 0);
    }
  }

  let pct = dig(data, 'flowPersent', 'flowPercent', 'sumPercent');
  pct = pct !== undefined && pct !== null && pct !== '' ? parseFloat(pct) : NaN;
  if (Number.isNaN(pct)) {
    pct = total > 0 ? Math.round(used / total * 100) : 0;
  }

  id('s-remain').textContent = fmtGB(left);
  id('s-used').textContent = fmtGB(used);
  id('s-total').textContent = fmtGB(total);
  id('s-pct').textContent = Math.round(pct) + '%';

  id('bar-used-lbl').textContent = '已用 ' + fmtGB(used);
  id('bar-total-lbl').textContent = '共 ' + fmtGB(total);

  const bar = id('main-bar');
  if (bar) {
    bar.style.width = Math.min(Math.max(pct, 0), 100) + '%';
    bar.style.background = pct > 85 ? '#dc2626' : pct > 60 ? '#d97706' : '#2563eb';
  }

  if (!list.length) {
    id('pkg-list').innerHTML = `<div class="empty-tip">暂无可展示的流量包明细</div>`;
    return;
  }

  id('pkg-list').innerHTML = list.map(p => {
    const pp = p.t > 0 ? Math.round(p.u / p.t * 100) : 0;
    const cls = pp > 85 ? 'red' : pp > 60 ? 'amber' : 'green';
    const barColor = pp > 85 ? '#dc2626' : pp > 60 ? '#d97706' : '#2563eb';

    return `<div class="pkg-item">
      <div class="pkg-left">
        <div class="pkg-name">${esc(p.name)}</div>
        ${p.expire ? `<div class="pkg-expire">到期 ${esc(p.expire)}</div>` : '<div class="pkg-expire">&nbsp;</div>'}
        <div class="mini-bar-bg"><div class="mini-bar" style="width:${Math.min(pp, 100)}%;background:${barColor}"></div></div>
      </div>
      <div class="pkg-right">
        <div class="pkg-remain">${fmtGB(p.l)}</div>
        <div class="pkg-of">/ ${fmtGB(p.t)}</div>
        <span class="pkg-pct ${cls}">已用 ${pp}%</span>
      </div>
    </div>`;
  }).join('');
}

/* ── Speed ── */
async function loadSpeed() {
  try {
    const data = await api('/speed');
    renderSpeed(data);
  } catch (e) {
    id('speed-area').innerHTML = `<div class="error-tip">速率查询失败：${esc(e.message)}</div>`;
  }
}

function renderSpeed(data) {
  const dlRaw =
    data?.downlinkRateResource?.rate ??
    dig(data, 'downRate', 'downloadRate', 'downSpeed', 'downloadSpeed', 'downBandwidth', 'dlRate');

  const ulRaw =
    data?.uplinkRateResource?.rate ??
    dig(data, 'upRate', 'uploadRate', 'upSpeed', 'uploadSpeed', 'upBandwidth', 'ulRate');

  const dl = dlRaw ?? '—';
  const ul = ulRaw ?? '—';

  const qci =
    dig(data, 'qci', 'QCI', 'qciLevel', 'qciValue', 'qciCode') ?? '—';

  const net =
    dig(data, 'networkType', 'netType', 'network', 'accessType', 'netTypeName') ??
    data?.terminalResource?.terminal ??
    '5G';

  const limitFlag = ['1', 'true', true, 'yes'].includes(
    dig(data, 'limitFlag', 'isLimit', 'speedLimit', 'isLimitSpeed', 'limitStatus')
  );

  const limitV = dig(data, 'limitRate', 'limitSpeed', 'limitBandwidth', 'limitValue') ?? '';

  id('net-badge').textContent = net;
  id('speed-area').innerHTML = `
    <div class="speed-pair">
      <div class="speed-block">
        <div class="speed-icon dl">↓</div>
        <div><div class="speed-val">${esc(String(dl))}</div><div class="speed-unit">Mbps 下行</div></div>
      </div>
      <div class="speed-block">
        <div class="speed-icon ul">↑</div>
        <div><div class="speed-val">${esc(String(ul))}</div><div class="speed-unit">Mbps 上行</div></div>
      </div>
    </div>
    <div class="info-rows">
      ${row('QCI 等级', esc(String(qci)))}
      ${row('网络类型', esc(String(net)))}
      ${row('限速状态', limitFlag
        ? `<span class="pkg-pct amber">已限速${limitV ? ' ' + esc(String(limitV)) + ' Mbps' : ''}</span>`
        : '<span class="pkg-pct green">正常</span>')}
      ${dig(data, 'cellId', 'cell_id', 'cellID') ? row('Cell ID', esc(String(dig(data, 'cellId', 'cell_id', 'cellID')))) : ''}
    </div>`;
}

/* ── Biz ── */
async function loadBiz() {
  try {
    const data = await api('/biz');
    renderBiz(data);
  } catch (e) {
    id('biz-area').innerHTML = `<div class="error-tip">业务查询失败：${esc(e.message)}</div>`;
  }
}

function renderBiz(data) {
  const list = findArray(
    data,
    'mainProductInfo',
    'list',
    'orderList',
    'serviceList',
    'bizList',
    'items',
    'records',
    'productList'
  );

  console.log('[biz] items count=', list.length, ' first=', list[0]);

  id('biz-count').textContent = list.length ? list.length + ' 项' : '';

  if (!list.length) {
    id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>';
    return;
  }

  id('biz-area').innerHTML = list.map(b => {
    const price = b.price || b.fee || b.month_fee || b.monthFee || b.chargeFee || b.cost || b.amount || '';
    const name = b.serviceName || b.name || b.productName || b.offerName || b.bizName || b.spName || '业务';
    const date = b.subscribeDate || b.createDate || b.orderDate || b.startDate || b.orderTime || '';

    return `<div class="biz-item">
      <div>
        <div class="biz-name">${esc(name)}</div>
        ${date ? `<div class="biz-date">${esc(date)}</div>` : ''}
      </div>
      <div class="biz-price">${price ? '¥' + esc(String(price)) + '/月' : '免费'}</div>
    </div>`;
  }).join('');
}

/* ===== Helpers ===== */
const id = i => document.getElementById(i);
const val = i => id(i).value.trim();

const esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const row = (k, v) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`;

const numOf = v => (v !== undefined && v !== null && v !== '') ? (parseFloat(v) || 0) : 0;

function parseMB(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;

  const s = String(v).trim().toUpperCase().replace(/,/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return 0;

  if (s.endsWith('TB') || s.endsWith('T')) return n * 1024 * 1024;
  if (s.endsWith('GB') || s.endsWith('G')) return n * 1024;
  if (s.endsWith('MB') || s.endsWith('M')) return n;
  if (s.endsWith('KB') || s.endsWith('K')) return n / 1024;

  // 无单位时做启发式判断
  if (n < 2000) return n * 1024; // 小数字大概率是 GB
  return n; // 否则按 MB
}

function fmtGB(mb) {
  if (mb === undefined || mb === null || Number.isNaN(mb)) return '—';
  if (mb === 0) return '0 MB';
  if (mb >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
  return mb.toFixed(0) + ' MB';
}

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