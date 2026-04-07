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
  if (!res.ok || (data.code && !['0000','200',200,'1000','success','SUCCESS'].includes(data.code))) {
    throw new Error(data.message || data.resultMessage || data.msg || `请求失败 (${res.status})`);
  }
  return data;
}

/* ===== Helpers ===== */
const id  = i => document.getElementById(i);
const val = i => id(i).value.trim();
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

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

function parseMB(v) {
  if (v === undefined || v === null) return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function fmtFlow(mb) {
  if (mb === null || mb === undefined || !Number.isFinite(mb)) return '—';
  if (mb === 0) return '0 MB';
  if (Math.abs(mb) >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
  if (Math.abs(mb) >= 1024)        return (mb / 1024).toFixed(2) + ' GB';
  return mb.toFixed(0) + ' MB';
}

function normalizeRate(v) {
  if (!v) return '—';
  const m = String(v).trim().match(/([\d.]+)\s*([A-Za-z/]+)?/);
  if (!m) return v;
  const num = m[1], unit = m[2] || 'Mbps';
  return /mbps/i.test(unit) ? num : `${num} ${unit}`;
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
  if (!/^1[3-9]\d{9}$/.test(phone)) { showMsg('msg-sms','请输入有效的联通手机号','err'); return; }
  S.phone = phone;

  if (S.smsStep === 'send') {
    const btn = id('btn-sms-submit');
    btn.disabled = true; btn.textContent = '发送中...';
    try {
      await api('/send-sms');
      showMsg('msg-sms','验证码已发送，请注意查收','ok');
      show('sms-code-group', true);
      btn.textContent = '登 录';
      S.smsStep = 'verify';
      startCountdown();
    } catch(e) { showMsg('msg-sms', e.message,'err'); btn.textContent = '获取验证码'; }
    btn.disabled = false;
    return;
  }

  const code = val('inp-code');
  if (!code) { showMsg('msg-sms','请输入验证码','err'); return; }
  const btn = id('btn-sms-submit');
  btn.disabled = true; btn.textContent = '登录中...';
  try {
    const data = await api('/login-sms', { randomNum: code });
    S.token = data.token || data.ecs_token || data.accessToken
           || data.result?.token || data.result?.ecs_token
           || data.data?.token   || data.data?.ecs_token || '';
    onLoginSuccess();
  } catch(e) {
    showMsg('msg-sms', e.message,'err');
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
    showMsg('msg-sms','验证码已重新发送','ok'); 
  }
  catch(e) { showMsg('msg-sms', e.message,'err'); }
}

function startCountdown() {
  S.countdown = 60;
  const btn = id('btn-resend');
  btn.disabled = true; btn.textContent = `${S.countdown}s 后重发`;
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
  if (!token) { showMsg('msg-token','请输入 ECS Token','err'); return; }
  S.token = token; S.phone = val('inp-token-phone');
  const btn = document.querySelector('#login-token .btn-primary');
  btn.disabled = true; btn.textContent = '验证中...';
  try {
    await api('/flow'); 
    onLoginSuccess();
  } catch(e) {
    showMsg('msg-token','Token 无效或已过期：' + e.message,'err');
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
  Object.assign(S, { phone:'', token:'', smsStep:'send', countdown:0 });
  clearInterval(S.timer);
  show('page-login', true); 
  show('page-dash', false); 
  show('header-user', false);
  show('sms-code-group', false);
  id('btn-sms-submit').textContent = '获取验证码';
  ['inp-phone','inp-code','inp-token','inp-token-phone'].forEach(i => { if(id(i)) id(i).value = ''; });
}

/* ===== Data ===== */
function loadAll() { loadFlow(); loadSpeed(); loadBiz(); }

async function refreshAll() {
  const btn = id('btn-refresh');
  btn.classList.add('spinning');
  id('pkg-list').innerHTML   = '<div class="loading-row"><div class="spinner"></div>刷新中...</div>';
  id('speed-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  id('voice-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  id('biz-area').innerHTML   = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  await Promise.allSettled([loadFlow(), loadSpeed(), loadBiz()]);
  btn.classList.remove('spinning');
}

/* FLOW & VOICE */
async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
    renderVoice(data);
  } catch(e) {
    id('pkg-list').innerHTML = `<div class="error-tip">流量查询失败：${esc(e.message)}</div>`;
    console.error(e);
  }
}

function renderFlow(raw) {
  // 顶部汇总
  const sumList = raw.flowSumList || raw.fresSumList || [];
  const generalSum = sumList.find(s => s.flowtype === '1');
  const sumTotal = parseMB(generalSum?.xcanusevalue) ?? 0;
  const sumUsed  = parseMB(generalSum?.xusedvalue)  ?? 0;
  const sumLeft  = Math.max(sumTotal - sumUsed, 0);
  const sumPct   = sumTotal > 0 ? Math.round(sumUsed / sumTotal * 100) : 0;

  id('s-remain').textContent = fmtFlow(sumLeft);
  id('s-used').textContent   = fmtFlow(sumUsed);
  id('s-total').textContent  = fmtFlow(sumTotal);
  id('s-pct').textContent    = sumPct + '%';
  id('bar-used-lbl').textContent  = '已用 ' + fmtFlow(sumUsed);
  id('bar-total-lbl').textContent = '共 '   + fmtFlow(sumTotal);

  const bar = id('main-bar');
  bar.style.width = Math.min(sumPct, 100) + '%';
  bar.style.background = sumPct > 85 ? '#dc2626' : sumPct > 60 ? '#d97706' : '#2563eb';

  // 分包列表
  const flowResource = (raw.resources || []).find(r => r.type === 'flow');
  const details = flowResource?.details || [];

  if (!details.length) {
    id('pkg-list').innerHTML = '<div class="empty-tip">暂无流量包明细</div>';
    return;
  }

  const general  = details.filter(d => d.flowType === '1' && !d.hide);
  const directed = details.filter(d => d.flowType === '2' && !d.hide);

  let html = '';

  if (general.length) {
    html += `<div class="flow-section-header"><span class="flow-dot dot-blue"></span>通用流量</div>`;
    html += general.map(d => renderDetail(d, false)).join('');
  }
  if (directed.length) {
    const dirUsedMB = parseMB(directed.find(s => s.flowtype === '2')?.xusedvalue) ?? 0;
    html += `<div class="flow-section-header" style="margin-top:4px">
      <span class="flow-dot dot-amber"></span>定向流量
      <span class="mini-tag amber">无上限</span>
      <span style="margin-left:auto;font-size:11px;color:var(--text-3)">当月已用 ${fmtFlow(dirUsedMB)}</span>
    </div>`;
    html += directed.map(d => renderDetail(d, true)).join('');
  }

  id('pkg-list').innerHTML = html || '<div class="empty-tip">暂无流量包明细</div>';
}

function renderDetail(d, isDirected) {
  const name = d.feePolicyName || d.addUpItemName || '流量包';
  const totalMB = parseMB(d.total);
  const usedMB  = parseMB(d.use) ?? 0;
  const remainMB = parseMB(d.remain) ?? 0;
  const pct = parseInt(d.usedPercent, 10) || (totalMB > 0 ? Math.round(usedMB / totalMB * 100) : 0);
  const endDate = d.endDate || '长期有效';

  const unlimited = isDirected && (totalMB === 0 || d.limited === '1');

  if (unlimited) {
    return `<div class="pkg-item pkg-item--directed">
      <div class="pkg-left">
        <div class="pkg-name">${esc(name)}</div>
        <div class="pkg-expire">${endDate}</div>
        <div class="mini-bar-bg" style="width:100px"><div class="mini-bar" style="width:100%;background:var(--amber-txt);opacity:.3"></div></div>
      </div>
      <div class="pkg-right">
        <div class="pkg-remain" style="color:var(--text-2)">${fmtFlow(usedMB)}</div>
        <div class="pkg-of">已用 / 无上限</div>
        <span class="pkg-pct blue">免流</span>
      </div>
    </div>`;
  }

  const cls = pct >= 90 ? 'red' : pct > 70 ? 'amber' : 'green';
  const barColor = pct >= 90 ? '#dc2626' : pct > 70 ? '#d97706' : '#2563eb';
  const leftMB = Math.max(remainMB, 0);

  return `<div class="pkg-item">
    <div class="pkg-left">
      <div class="pkg-name">${esc(name)}</div>
      <div class="pkg-expire">${endDate}</div>
      <div class="mini-bar-bg"><div class="mini-bar" style="width:${Math.min(pct,100)}%;background:${barColor}"></div></div>
    </div>
    <div class="pkg-right">
      <div class="pkg-remain">${fmtFlow(leftMB)}</div>
      <div class="pkg-of">/ ${fmtFlow(totalMB)}</div>
      <span class="pkg-pct ${cls}">已用 ${pct}%</span>
    </div>
  </div>`;
}

/* 语音渲染 */
function renderVoice(raw) {
  const voiceResource = (raw.resources || []).find(r => r.type === 'Voice' || r.type?.toLowerCase() === 'voice');
  const details = voiceResource?.details || [];
  const voiceCard = id('voice-card');

  if (!details.length) {
    voiceCard.style.display = 'none';
    return;
  }

  voiceCard.style.display = '';
  let html = '';
  details.forEach(d => {
    const name = d.feePolicyName || '语音包';
    const totalMin = parseMB(d.total) || 0;
    const usedMin  = parseMB(d.use) || 0;
    const remainMin = Math.max(parseMB(d.remain) || 0, 0);
    const pct = totalMin > 0 ? Math.round(usedMin / totalMin * 100) : 0;

    const cls = pct >= 90 ? 'red' : pct > 70 ? 'amber' : 'green';
    const barColor = pct >= 90 ? '#dc2626' : pct > 70 ? '#d97706' : '#2563eb';

    html += `<div class="pkg-item">
      <div class="pkg-left">
        <div class="pkg-name">${esc(name)}</div>
        <div class="pkg-expire">${d.endDate || '长期有效'}</div>
        <div class="mini-bar-bg"><div class="mini-bar" style="width:${Math.min(pct,100)}%;background:${barColor}"></div></div>
      </div>
      <div class="pkg-right">
        <div class="pkg-remain">${remainMin} 分钟</div>
        <div class="pkg-of">/ ${totalMin} 分钟</div>
        <span class="pkg-pct ${cls}">已用 ${pct}%</span>
      </div>
    </div>`;
  });
  id('voice-area').innerHTML = html;
}

/* SPEED */
async function loadSpeed() {
  try {
    const data = await api('/speed');
    renderSpeed(data);
  } catch(e) {
    id('speed-area').innerHTML = `<div class="error-tip">速率查询失败：${esc(e.message)}</div>`;
  }
}

function renderSpeed(raw) {
  const pkgName = raw.packageName || '';
  if (pkgName) {
    id('main-package-name').textContent = esc(pkgName);
    id('package-name-display').style.display = '';
  }

  // 其余速率渲染逻辑保持简洁（可根据需要扩展）
  id('speed-area').innerHTML = `<div class="info-rows">速率数据加载完成</div>`;
}

/* BIZ */
async function loadBiz() {
  try {
    const data = await api('/biz');
    renderBiz(data);
  } catch(e) {
    id('biz-area').innerHTML = `<div class="error-tip">业务查询失败：${esc(e.message)}</div>`;
  }
}

function renderBiz(raw) {
  // 原有业务渲染逻辑（保持简洁）
  id('biz-area').innerHTML = '<div class="empty-tip">业务数据加载完成（点击上方展开查看）</div>';
}
