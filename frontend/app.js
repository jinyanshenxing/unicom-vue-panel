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
  console.log(`[API] ${path}`, JSON.stringify(data).slice(0, 1800));

  if (!res.ok || (data.code && !['0000','200',200,'1000','success','SUCCESS'].includes(data.code))) {
    throw new Error(data.message || data.resultMessage || data.msg || `请求失败 (${res.status})`);
  }
  return data;
}

/* ===== Deep Search Helpers ===== */
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
    if (Array.isArray(obj[k]) && obj[k].length) return obj[k];
  }
  for (const [, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length) return v;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = findArray(v, ...preferKeys);
      if (found.length) return found;
    }
  }
  return [];
}

/* ===== Login Functions ===== */
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
  try { 
    await api('/send-sms'); 
    startCountdown(); 
    showMsg('msg-sms', '验证码已重新发送', 'ok'); 
  } catch (e) { showMsg('msg-sms', e.message, 'err'); }
}

function startCountdown() {
  S.countdown = 60;
  const btn = id('btn-resend');
  btn.disabled = true;
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
  if (!token) { showMsg('msg-token', '请输入 ECS Token', 'err'); return; }
  S.token = token;
  S.phone = val('inp-token-phone') || '';
  const btn = document.querySelector('#login-token .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = '验证中...'; }
  try {
    await api('/flow');
    onLoginSuccess();
  } catch (e) {
    showMsg('msg-token', 'Token 无效或已过期：' + e.message, 'err');
    S.token = '';
    if (btn) { btn.disabled = false; btn.textContent = '验证并登录'; }
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
  ['inp-phone','inp-code','inp-token','inp-token-phone'].forEach(i => { if(id(i)) id(i).value = ''; });
}

/* ===== Data Loading ===== */
function loadAll() { loadFlow(); loadSpeed(); loadBiz(); }

async function refreshAll() {
  const btn = id('btn-refresh');
  if (btn) btn.classList.add('spinning');
  id('pkg-list').innerHTML = '<div class="loading-row"><div class="spinner"></div>刷新中...</div>';
  id('speed-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  id('biz-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  await Promise.allSettled([loadFlow(), loadSpeed(), loadBiz()]);
  if (btn) btn.classList.remove('spinning');
}

/* ── Flow ──（已优化，专门适配你的深层结构） */
async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
  } catch (e) {
    id('pkg-list').innerHTML = `<div class="error-tip">流量查询失败：${esc(e.message)}</div>`;
  }
}

function renderFlow(data) {
  console.log('[flow] 完整数据结构:', data);

  let total = 0, used = 0, left = 0;

  // 递归搜索所有层级的 xusedvalue / xcanusevalue / xsumvalue
  const searchDeep = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(searchDeep);
      return;
    }

    const xused = parseMB(obj.xusedvalue || obj.usedvalue || obj.used);
    const xcan  = parseMB(obj.xcanusevalue || obj.canusevalue || obj.remain || obj.left);
    const xsum  = parseMB(obj.xsumvalue || obj.sumvalue || obj.total || obj.allSize);

    if (xsum > 0) {
      total += xsum;
      used  += xused;
      left  += xcan || Math.max(xsum - xused, 0);
    }

    Object.values(obj).forEach(v => {
      if (v && typeof v === 'object') searchDeep(v);
    });
  };

  searchDeep(data);

  // 额外尝试已知路径
  if (total === 0) {
    const tw = dig(data, 'TwResources');
    if (tw) searchDeep(tw);
    const sumList = findArray(data, 'flowSumList', 'MIResources', 'XsbResources');
    sumList.forEach(item => searchDeep(item));
  }

  const pct = total > 0 ? Math.round(used / total * 100) : 0;

  // 更新顶部卡片
  id('s-remain').textContent = fmtGB(left);
  id('s-used').textContent   = fmtGB(used);
  id('s-total').textContent  = fmtGB(total);
  id('s-pct').textContent    = pct + '%';

  const bar = id('main-bar');
  if (bar) {
    bar.style.width = Math.min(pct, 100) + '%';
    bar.style.background = pct > 85 ? '#dc2626' : pct > 60 ? '#d97706' : '#2563eb';
  }

  id('bar-used-lbl').textContent = '已用 ' + fmtGB(used);
  id('bar-total-lbl').textContent = '共 ' + fmtGB(total);

  // 流量包列表（简化显示主流量）
  const pkgHTML = total > 0 
    ? `<div class="pkg-item">
        <div class="pkg-left">
          <div class="pkg-name">主流量包</div>
          <div class="mini-bar-bg"><div class="mini-bar" style="width:${Math.min(pct,100)}%;background:#2563eb"></div></div>
        </div>
        <div class="pkg-right">
          <div class="pkg-remain">${fmtGB(left)}</div>
          <div class="pkg-of">/ ${fmtGB(total)}</div>
          <span class="pkg-pct green">已用 ${pct}%</span>
        </div>
      </div>`
    : `<div class="error-tip">未提取到流量数据，请把控制台 [flow] 完整数据结构 发给我</div>`;

  id('pkg-list').innerHTML = pkgHTML;
}

/* ── Speed ── */
async function loadSpeed() {
  try {
    const data = await api('/speed');
    renderSpeed(data);
  } catch (e) {
    id('speed-area').innerHTML = `<div class="error-tip">速率查询失败</div>`;
  }
}

function renderSpeed(data) {
  let dl = numOf(dig(data, 'rateResource.rate', 'flowPercent', 'downRate', 'downSpeed')) || 500;
  let ul = numOf(dig(data, 'upRate', 'uploadRate', 'upSpeed'));
  const net = dig(data, 'networkType', 'netType') ?? '5G';

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
      ${row('QCI 等级', dig(data, 'qci', 'QCI') ?? '—')}
      ${row('网络类型', net)}
      ${row('限速状态', '<span class="pkg-pct green">正常</span>')}
    </div>`;
}

/* ── Biz ── */
async function loadBiz() {
  try {
    const data = await api('/biz');
    renderBiz(data);
  } catch (e) {
    id('biz-area').innerHTML = `<div class="error-tip">业务查询失败</div>`;
  }
}

function renderBiz(data) {
  const list = findArray(data, 'data', 'list', 'orderList', 'items', 'productList');
  id('biz-count').textContent = list.length ? list.length + ' 项' : '1 项';

  if (!list.length) {
    id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>';
    return;
  }

  id('biz-area').innerHTML = list.map(b => {
    const name = dig(b, 'productName', 'serviceName', 'name') || '业务';
    const date = dig(b, 'startDate', 'orderTime') || '';
    const price = dig(b, 'productFee', 'fee') || '';
    return `<div class="biz-item">
      <div>
        <div class="biz-name">${esc(name)}</div>
        ${date ? `<div class="biz-date">${date}</div>` : ''}
      </div>
      <div class="biz-price">${price ? '¥' + price + '/月' : '免费'}</div>
    </div>`;
  }).join('');
}

/* ===== Utils ===== */
function parseMB(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().toUpperCase().replace(/,/g, '');
  let n = parseFloat(s);
  if (isNaN(n)) return 0;
  if (s.endsWith('TB') || s.endsWith('T')) return n * 1024 * 1024;
  if (s.endsWith('GB') || s.endsWith('G')) return n * 1024;
  if (s.endsWith('KB') || s.endsWith('K')) return n / 1024;
  if (n < 5000 && !s.endsWith('MB') && !s.endsWith('M')) return n * 1024;
  return n;
}

function fmtGB(mb) {
  if (mb <= 0) return '—';
  if (mb >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
  return mb.toFixed(0) + ' MB';
}

const id = i => document.getElementById(i);
const show = (elId, visible) => { const el = id(elId); if (el) el.style.display = visible ? '' : 'none'; };

function showMsg(elId, text, type) {
  const el = id(elId);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 5000);
}
