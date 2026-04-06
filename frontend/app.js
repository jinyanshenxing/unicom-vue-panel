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

/* ===== Helpers ===== */
const id = i => document.getElementById(i);
const val = i => id(i).value.trim();

const esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const row = (k, v) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`;

const numOf = v => (v !== undefined && v !== null && v !== '') ? (parseFloat(v) || 0) : 0;

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
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
    if (Array.isArray(obj[k]) && typeof obj[k][0] === 'object') return obj[k];
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

function parseMB(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;

  const s = String(v).trim().toUpperCase().replace(/,/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return 0;

  if (s.endsWith('TB') || s.endsWith('T')) return n * 1024 * 1024;
  if (s.endsWith('GB') || s.endsWith('G')) return n * 1024;
  if (s.endsWith('KB') || s.endsWith('K')) return n / 1024;
  return n; // 默认 MB
}

function fmtFlow(mb) {
  if (mb === undefined || mb === null || isNaN(mb)) return '—';
  if (mb >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
  return mb.toFixed(2).replace(/\.00$/, '') + ' MB';
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

function extractPriceFromName(name) {
  const s = String(name || '');
  const m = s.match(/(\d+(?:\.\d+)?)元/);
  return m ? m[1] : '';
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
  const sumList = Array.isArray(data.flowSumList) ? data.flowSumList : [];
  const xsbList = Array.isArray(data.XsBResources) ? data.XsBResources : [];
  const details = Array.isArray(data.details) ? data.details : [];

  console.log('[flow] sumList=', sumList, ' xsbList=', xsbList, ' details=', details);

  let summary = null;
  if (sumList.length) {
    summary = sumList[0];
  } else {
    summary = data;
  }

  let left = parseMB(firstNonEmpty(
    summary?.xcanusevalue,
    summary?.canusevalue,
    summary?.leftFlow,
    summary?.remainFlow,
    summary?.left,
    summary?.remainSize,
    summary?.surplusFlow,
    summary?.balance
  ));

  let used = parseMB(firstNonEmpty(
    summary?.xusedvalue,
    summary?.usedFlow,
    summary?.used,
    summary?.usedSize,
    summary?.useFlow,
    summary?.usedTraffic,
    summary?.usedAmount
  ));

  let total = parseMB(firstNonEmpty(
    summary?.xtotalvalue,
    summary?.total,
    summary?.packageFlow,
    summary?.flowSize,
    summary?.totalFlow,
    summary?.totalSize,
    summary?.allSize
  ));

  if (!total && (left || used)) total = left + used;
  if (!left && total && used) left = Math.max(total - used, 0);

  const pct = total > 0 ? Math.round((used / total) * 100) : 0;

  id('s-remain').textContent = fmtFlow(left);
  id('s-used').textContent = fmtFlow(used);
  id('s-total').textContent = fmtFlow(total);
  id('s-pct').textContent = pct + '%';

  id('bar-used-lbl').textContent = '已用 ' + fmtFlow(used);
  id('bar-total-lbl').textContent = '共 ' + fmtFlow(total);

  const bar = id('main-bar');
  bar.style.width = Math.min(pct, 100) + '%';
  bar.style.background = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#2563eb';

  let pkgSource = [];
  if (details.length) {
    pkgSource = details;
  } else if (xsbList.length) {
    pkgSource = xsbList;
  } else if (sumList.length) {
    pkgSource = sumList;
  }

  const list = pkgSource.map((p, idx) => {
    let l = parseMB(firstNonEmpty(
      p.xcanusevalue,
      p.canusevalue,
      p.leftFlow,
      p.remainFlow,
      p.left,
      p.remainSize,
      p.surplusFlow,
      p.balance
    ));

    let u = parseMB(firstNonEmpty(
      p.xusedvalue,
      p.usedFlow,
      p.used,
      p.usedSize,
      p.useFlow,
      p.usedTraffic,
      p.usedAmount
    ));

    let t = parseMB(firstNonEmpty(
      p.xtotalvalue,
      p.total,
      p.packageFlow,
      p.flowSize,
      p.totalFlow,
      p.totalSize,
      p.allSize
    ));

    if (!t && (l || u)) t = l + u;
    if (!l && t && u) l = Math.max(t - u, 0);

    const pp = t > 0 ? Math.round((u / t) * 100) : 0;
    const cls = pp > 85 ? 'red' : pp > 60 ? 'amber' : 'green';
    const barColor = pp > 85 ? '#ef4444' : pp > 60 ? '#f59e0b' : '#2563eb';

    return {
      name: firstNonEmpty(
        p.feePolicyName,
        p.packageName,
        p.name,
        p.productName,
        p.offerName,
        p.pkgName,
        idx === 0 ? '通用流量' : '专属流量'
      ),
      l, u, t, pp, cls, barColor,
      expire: firstNonEmpty(
        p.expireDate,
        p.endDate,
        p.expiryDate,
        p.validDate,
        p.endTime
      ) || ''
    };
  });

  if (!list.length && total > 0) {
    id('pkg-list').innerHTML = `<div class="pkg-item enhanced">
      <div class="pkg-main">
        <div class="pkg-title-row">
          <div class="pkg-name">套餐流量</div>
          <span class="pkg-pct ${pct > 85 ? 'red' : pct > 60 ? 'amber' : 'green'}">已用 ${pct}%</span>
        </div>
        <div class="mini-bar-bg"><div class="mini-bar" style="width:${Math.min(pct, 100)}%;background:${pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#2563eb'}"></div></div>
        <div class="pkg-meta">
          <span>剩余 ${fmtFlow(left)}</span>
          <span>总量 ${fmtFlow(total)}</span>
        </div>
      </div>
    </div>`;
    return;
  }

  if (!list.length) {
    id('pkg-list').innerHTML = '<div class="empty-tip">暂无流量包信息</div>';
    return;
  }

  id('pkg-list').innerHTML = list.map(p => `
    <div class="pkg-item enhanced">
      <div class="pkg-main">
        <div class="pkg-title-row">
          <div class="pkg-name">${esc(p.name)}</div>
          <span class="pkg-pct ${p.cls}">已用 ${p.pp}%</span>
        </div>
        ${p.expire ? `<div class="pkg-expire">到期时间：${esc(p.expire)}</div>` : '<div class="pkg-expire">&nbsp;</div>'}
        <div class="mini-bar-bg"><div class="mini-bar" style="width:${Math.min(p.pp, 100)}%;background:${p.barColor}"></div></div>
        <div class="pkg-meta">
          <span>剩余 ${fmtFlow(p.l)}</span>
          <span>总量 ${fmtFlow(p.t)}</span>
        </div>
      </div>
    </div>
  `).join('');
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
  const downRaw = firstNonEmpty(
    dig(data, 'downRate', 'downloadRate', 'downSpeed', 'downloadSpeed', 'downBandwidth', 'dlRate'),
    data?.rateResource?.rate
  );

  const dl = typeof downRaw === 'string'
    ? downRaw.replace(/Mbps/i, '').trim()
    : numOf(downRaw);

  const ul = numOf(firstNonEmpty(
    dig(data, 'upRate', 'uploadRate', 'upSpeed', 'uploadSpeed', 'upBandwidth', 'ulRate'),
    data?.upRate
  ));

  const qci = firstNonEmpty(
    dig(data, 'qci', 'QCI', 'qciLevel', 'qciValue', 'qciCode'),
    '—'
  );

  const net = firstNonEmpty(
    dig(data, 'networkType', 'netType', 'network', 'accessType', 'netTypeName'),
    data?.terminalResource?.terminal,
    '5G'
  );

  const state = firstNonEmpty(
    dig(data, 'limitFlag', 'isLimit', 'speedLimit', 'isLimitSpeed', 'limitStatus'),
    data?.networkStirchResource?.state
  );

  const limitFlag = ['0', 0, 'true', true, 'yes', 'limited', 'LIMITED'].includes(state);

  id('net-badge').textContent = net;

  id('speed-area').innerHTML = `
    <div class="speed-pair">
      <div class="speed-block modern">
        <div class="speed-icon dl">↓</div>
        <div>
          <div class="speed-val">${dl || '—'}</div>
          <div class="speed-unit">Mbps 下行</div>
        </div>
      </div>
      <div class="speed-block modern">
        <div class="speed-icon ul">↑</div>
        <div>
          <div class="speed-val">${ul || '—'}</div>
          <div class="speed-unit">Mbps 上行</div>
        </div>
      </div>
    </div>
    <div class="info-rows">
      ${row('QCI 等级', esc(String(qci)))}
      ${row('网络类型', esc(String(net)))}
      ${row('限速状态', limitFlag
        ? '<span class="pkg-pct amber">已限速</span>'
        : '<span class="pkg-pct green">正常</span>')}
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
  let list = [];

  if (Array.isArray(data?.mainProductInfo)) {
    list = data.mainProductInfo;
  } else if (Array.isArray(data?.data?.mainProductInfo)) {
    list = data.data.mainProductInfo;
  } else {
    list = findArray(
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
  }

  console.log('[biz] items count=', list.length, ' first=', list[0]);

  id('biz-count').textContent = list.length ? list.length + ' 项' : '';

  if (!list.length) {
    id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>';
    return;
  }

  id('biz-area').innerHTML = list.map((b, idx) => {
    const name = firstNonEmpty(
      b.serviceName,
      b.name,
      b.productName,
      b.offerName,
      b.bizName,
      b.spName,
      '业务'
    );

    const date = firstNonEmpty(
      b.subscribeDate,
      b.createDate,
      b.orderDate,
      b.startDate,
      b.orderTime,
      b.orderTimeStr,
      ''
    );

    let price = firstNonEmpty(
      b.price,
      b.fee,
      b.month_fee,
      b.monthFee,
      b.chargeFee,
      b.cost,
      b.amount,
      b.productFee
    );

    if (!price) {
      price = extractPriceFromName(name);
    }

    const statusText =
      b.orderStatus === '0' ? '生效中' :
      b.orderStatus === '1' ? '处理中' :
      '已订购';

    return `
      <div class="biz-card">
        <div class="biz-card-left">
          <div class="biz-dot ${idx % 2 === 0 ? 'blue' : 'green'}"></div>
          <div class="biz-content">
            <div class="biz-name">${esc(String(name))}</div>
            <div class="biz-sub">
              ${date ? `<span>${esc(String(date))}</span>` : '<span>已订购业务</span>'}
              <span class="biz-status">${statusText}</span>
            </div>
          </div>
        </div>
        <div class="biz-card-right">
          <span class="biz-tag">${price ? `¥${esc(String(price))}/月` : '套餐'}</span>
        </div>
      </div>
    `;
  }).join('');
}