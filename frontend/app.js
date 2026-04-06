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
  console.log(`[API] ${path}`, JSON.stringify(data).slice(0, 1200));
  
  if (!res.ok || (data.code && !['0000','200',200,'1000','success','SUCCESS'].includes(data.code))) {
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
  if (!/^1[3-9]\d{9}$/.test(phone)) { showMsg('msg-sms', '请输入有效的联通手机号', 'err'); return; }
  S.phone = phone;
  if (S.smsStep === 'send') {
    const btn = id('btn-sms-submit');
    btn.disabled = true; btn.textContent = '发送中...';
    try {
      await api('/send-sms');
      showMsg('msg-sms', '验证码已发送，请注意查收', 'ok');
      show('sms-code-group', true);
      btn.textContent = '登 录';
      S.smsStep = 'verify';
      startCountdown();
    } catch (e) { showMsg('msg-sms', e.message, 'err'); btn.textContent = '获取验证码'; }
    btn.disabled = false;
    return;
  }
  const code = val('inp-code');
  if (!code) { showMsg('msg-sms', '请输入验证码', 'err'); return; }
  const btn = id('btn-sms-submit');
  btn.disabled = true; btn.textContent = '登录中...';
  try {
    const data = await api('/login-sms', { randomNum: code });
    S.token = data.token || data.ecs_token || data.accessToken
           || data.result?.token || data.result?.ecs_token
           || data.data?.token || data.data?.ecs_token || '';
    console.log('[login] token prefix =', S.token ? S.token.slice(0,20)+'...' : '(none)');
    onLoginSuccess();
  } catch (e) {
    showMsg('msg-sms', e.message, 'err');
    btn.disabled = false; btn.textContent = '登 录';
  }
}

async function sendSms() {
  const phone = val('inp-phone');
  if (!/^1[3-9]\d{9}$/.test(phone)) return;
  S.phone = phone;
  try { await api('/send-sms'); startCountdown(); showMsg('msg-sms', '验证码已重新发送', 'ok'); }
  catch (e) { showMsg('msg-sms', e.message, 'err'); }
}

function startCountdown() {
  S.countdown = 60;
  const btn = id('btn-resend');
  btn.disabled = true;
  clearInterval(S.timer);
  S.timer = setInterval(() => {
    S.countdown--;
    btn.textContent = `${S.countdown}s 后重发`;
    if (S.countdown <= 0) { clearInterval(S.timer); btn.textContent = '重新发送'; btn.disabled = false; }
  }, 1000);
}

async function handleTokenLogin() {
  const token = val('inp-token').trim();
  if (!token) { showMsg('msg-token', '请输入 ECS Token', 'err'); return; }
  S.token = token;
  S.phone = val('inp-token-phone');
  const btn = document.querySelector('#login-token .btn-primary');
  btn.disabled = true; btn.textContent = '验证中...';
  try {
    await api('/flow');
    onLoginSuccess();
  } catch (e) {
    showMsg('msg-token', 'Token 无效或已过期：' + e.message, 'err');
    S.token = '';
    btn.disabled = false; btn.textContent = '验证并登录';
  }
}

function onLoginSuccess() {
  show('page-login', false); show('page-dash', true);
  show('header-user', true);
  id('header-phone').textContent = S.phone || '已登录';
  loadAll();
}

function logout() {
  Object.assign(S, { phone: '', token: '', smsStep: 'send', countdown: 0 });
  clearInterval(S.timer);
  show('page-login', true); show('page-dash', false); show('header-user', false);
  show('sms-code-group', false);
  id('btn-sms-submit').textContent = '获取验证码';
  ['inp-phone','inp-code','inp-token','inp-token-phone'].forEach(i => id(i).value = '');
}

/* ===== Data ===== */
function loadAll() { loadFlow(); loadSpeed(); loadBiz(); }

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
  console.log('[flow] 完整数据结构:', data);

  let total = 0, used = 0, left = 0;
  let pkgs = [];

  // 从 flowSumList / MIResources 提取总用量（你当前接口的主要结构）
  const sumList = findArray(data, 'flowSumList', 'MIResources', 'resources');
  if (sumList.length > 0) {
    sumList.forEach(item => {
      const canuse = parseMB(dig(item, 'xcanusevalue', 'canusevalue', 'remain', 'left'));
      const xused  = parseMB(dig(item, 'xusedvalue', 'usedvalue', 'used'));
      const xsum   = parseMB(dig(item, 'xsumvalue', 'sumvalue', 'total'));
      if (xsum > 0) {
        total += xsum;
        used  += xused;
        left  += canuse || Math.max(xsum - xused, 0);
      }
    });
  }

  // 流量包列表
  const pkgArray = findArray(data, 'pkgs', 'packageList', 'flowPackageList', 'pkgList', 'flowList', 'items');
  pkgs = pkgArray.map(p => {
    const t = parseMB(dig(p, 'total', 'flowSize', 'totalFlow', 'allSize', 'xsumvalue'));
    const u = parseMB(dig(p, 'used', 'usedFlow', 'xusedvalue', 'usedAmount'));
    const l = parseMB(dig(p, 'left', 'remain', 'canusevalue', 'xcanusevalue')) || Math.max(t - u, 0);
    return {
      name: dig(p, 'packageName', 'name', 'productName', 'offerName', 'pkgName') || '主流量包',
      t, u, l,
      expire: dig(p, 'expireDate', 'endDate', 'validDate', 'endTime') || ''
    };
  });

  // 如果上面没取到总和，从单个包累加
  if (total === 0 && pkgs.length > 0) {
    pkgs.forEach(p => { total += p.t; used += p.u; left += p.l; });
  }

  const pct = total > 0 ? Math.round(used / total * 100) : 0;

  // 更新顶部卡片
  id('s-remain').textContent = fmtGB(left);
  id('s-used').textContent   = fmtGB(used);
  id('s-total').textContent  = fmtGB(total);
  id('s-pct').textContent    = pct + '%';

  // 主进度条
  const bar = id('main-bar');
  if (bar) {
    bar.style.width = Math.min(pct, 100) + '%';
    bar.style.background = pct > 85 ? '#dc2626' : pct > 60 ? '#d97706' : '#2563eb';
  }

  id('bar-used-lbl').textContent = '已用 ' + fmtGB(used);
  id('bar-total-lbl').textContent = '共 ' + fmtGB(total);

  // 流量包详情列表
  if (!pkgs.length) {
    id('pkg-list').innerHTML = `<div class="error-tip">未找到流量包数据</div>`;
    return;
  }

  id('pkg-list').innerHTML = pkgs.map(p => {
    const pp = p.t > 0 ? Math.round(p.u / p.t * 100) : 0;
    const cls = pp > 85 ? 'red' : pp > 60 ? 'amber' : 'green';
    const barColor = pp > 85 ? '#dc2626' : pp > 60 ? '#d97706' : '#2563eb';
    return `<div class="pkg-item">
      <div class="pkg-left">
        <div class="pkg-name">${esc(p.name)}</div>
        ${p.expire ? `<div class="pkg-expire">到期 ${p.expire}</div>` : '<div class="pkg-expire">&nbsp;</div>'}
        <div class="mini-bar-bg"><div class="mini-bar" style="width:${Math.min(pp,100)}%;background:${barColor}"></div></div>
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
  console.log('[speed] 原始数据:', data);

  const rateRes = dig(data, 'rateResource', 'flowPercent');
  let dl = numOf(dig(rateRes || data, 'rate', 'downRate', 'downloadRate', 'flowPercent', 'downSpeed'));
  let ul = numOf(dig(rateRes || data, 'upRate', 'uploadRate', 'upSpeed', 'ulRate'));

  if (rateRes && typeof rateRes === 'object') {
    dl = dl || numOf(dig(rateRes, 'down', 'download', 'dl'));
    ul = ul || numOf(dig(rateRes, 'up', 'upload', 'ul'));
  }

  const qci = dig(data, 'qci', 'QCI', 'qciLevel') ?? '—';
  const net = dig(data, 'networkType', 'netType', 'network', 'accessType') ?? '5G';
  const limitFlag = ['1','true',true].includes(dig(data, 'limitFlag','isLimit','speedLimit'));

  id('net-badge').textContent = net;

  id('speed-area').innerHTML = `
    <div class="speed-pair">
      <div class="speed-block">
        <div class="speed-icon dl">↓</div>
        <div><div class="speed-val">${dl || '—'}</div><div class="speed-unit">Mbps 下行</div></div>
      </div>
      <div class="speed-block">
        <div class="speed-icon ul">↑</div>
        <div><div class="speed-val">${ul || '—'}</div><div class="speed-unit">Mbps 上行</div></div>
      </div>
    </div>
    <div class="info-rows">
      ${row('QCI 等级', qci)}
      ${row('网络类型', net)}
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
  console.log('[biz] 原始数据:', data);

  const list = findArray(data, 'data', 'list', 'orderList', 'items', 'productList', 'records');
  
  id('biz-count').textContent = list.length ? list.length + ' 项' : '1 项';

  if (!list.length) {
    id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>';
    return;
  }

  id('biz-area').innerHTML = list.map(b => {
    const name = dig(b, 'productName', 'serviceName', 'name', 'offerName', 'bizName') || '业务';
    const date = dig(b, 'startDate', 'orderTime', 'subscribeDate', 'createDate') || '';
    const price = dig(b, 'productFee', 'fee', 'price', 'monthFee') || '';
    return `<div class="biz-item">
      <div>
        <div class="biz-name">${esc(name)}</div>
        ${date ? `<div class="biz-date">${date}</div>` : ''}
      </div>
      <div class="biz-price">${price ? '¥' + price + '/月' : '免费'}</div>
    </div>`;
  }).join('');
}

/* ===== Helpers ===== */
const id = i => document.getElementById(i);
const val = i => id(i).value.trim();
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const row = (k, v) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`;
const numOf = v => (v !== undefined && v !== null && v !== '') ? (parseFloat(v) || 0) : 0;

function parseMB(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().toUpperCase().replace(/,/g,'');
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (s.endsWith('TB') || s.endsWith('T')) return n * 1024 * 1024;
  if (s.endsWith('GB') || s.endsWith('G')) return n * 1024;
  if (s.endsWith('KB') || s.endsWith('K')) return n / 1024;
  if (n < 2000 && !s.endsWith('MB') && !s.endsWith('M')) return n * 1024;
  return n;
}

function fmtGB(mb) {
  if (!mb) return '—';
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
  el._t = setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 5000);
}
