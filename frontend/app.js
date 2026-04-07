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
  el._t = setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 5000);
}

function parseMB(v) {
  if (v === undefined || v === null || v === '') return null; // null = 未知/无限
  if (typeof v === 'number') return v;
  const s = String(v).trim().toUpperCase().replace(/,/g,'');
  if (s === '' || s === '-' || s === 'UNLIMITED' || s === '无限') return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (s.endsWith('TB') || s.endsWith('T')) return n * 1024 * 1024;
  if (s.endsWith('GB') || s.endsWith('G')) return n * 1024;
  if (s.endsWith('MB') || s.endsWith('M')) return n;
  if (s.endsWith('KB') || s.endsWith('K')) return n / 1024;
  return n; // 默认 MB
}

function fmtFlow(mb) {
  if (mb === null || mb === undefined || !Number.isFinite(mb)) return '无限';
  if (mb === 0) return '0 MB';
  if (mb >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
  if (mb >= 1024)        return (mb / 1024).toFixed(2) + ' GB';
  return mb.toFixed(0) + ' MB';
}

function normalizeRate(v) {
  if (!v) return '—';
  const s = String(v).trim();
  const m = s.match(/([\d.]+)\s*([A-Za-z/]+)?/);
  if (!m) return s;
  const num = m[1], unit = (m[2] || 'Mbps');
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
  try { await api('/send-sms'); startCountdown(); showMsg('msg-sms','验证码已重新发送','ok'); }
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
    if (S.countdown <= 0) { clearInterval(S.timer); btn.textContent = '重新发送'; btn.disabled = false; }
  }, 1000);
}

async function handleTokenLogin() {
  const token = val('inp-token').trim();
  if (!token) { showMsg('msg-token','请输入 ECS Token','err'); return; }
  S.token = token; S.phone = val('inp-token-phone');
  const btn = document.querySelector('#login-token .btn-primary');
  btn.disabled = true; btn.textContent = '验证中...';
  try {
    await api('/flow'); onLoginSuccess();
  } catch(e) {
    showMsg('msg-token','Token 无效或已过期：' + e.message,'err');
    S.token = ''; btn.disabled = false; btn.textContent = '验证并登录';
  }
}

function onLoginSuccess() {
  show('page-login', false); show('page-dash', true); show('header-user', true);
  id('header-phone').textContent = S.phone || '已登录';
  loadAll();
}

function logout() {
  Object.assign(S, { phone:'', token:'', smsStep:'send', countdown:0 });
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
  id('pkg-list').innerHTML   = '<div class="loading-row"><div class="spinner"></div>刷新中...</div>';
  id('speed-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  id('biz-area').innerHTML   = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  await Promise.allSettled([loadFlow(), loadSpeed(), loadBiz()]);
  btn.classList.remove('spinning');
}

/* ══════════════════════════════════════════════
   FLOW
   flowSumList 结构（已确认）：
   [
     { flowtype:"1", xcanusevalue:"4005.79", xusedvalue:"90.21" },   // 通用流量 MB
     { flowtype:"2", xcanusevalue:"",        xusedvalue:"564808.17" } // 定向流量 MB，无上限
   ]
   规则：
   - xcanusevalue 空字符串 → 无上限，parseMB 返回 null
   - 汇总卡片只统计有上限（xcanusevalue 非空）的流量
   - 定向流量只显示已用，不计入总量/使用率
   ══════════════════════════════════════════════ */
async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
  } catch(e) {
    id('pkg-list').innerHTML = `<div class="error-tip">流量查询失败：${esc(e.message)}</div>`;
  }
}

const FLOW_TYPE_NAME = { '1':'通用流量', '2':'定向流量', '3':'其他流量' };

function renderFlow(raw) {
  const sumList = Array.isArray(raw.flowSumList) ? raw.flowSumList : [];

  // 解析每条流量记录
  const flows = sumList.map(item => {
    const totalMB = parseMB(item.xcanusevalue); // null = 无上限
    const usedMB  = parseMB(item.xusedvalue) ?? 0;
    const leftMB  = totalMB !== null ? Math.max(totalMB - usedMB, 0) : null;
    const pct     = totalMB > 0 ? Math.round(usedMB / totalMB * 100) : 0;
    return {
      type    : item.flowtype,
      name    : FLOW_TYPE_NAME[item.flowtype] || `流量 (${item.flowtype})`,
      totalMB,   // null = 无上限
      usedMB,
      leftMB,    // null = 无上限
      pct,
      unlimited : totalMB === null,
    };
  });

  // 汇总：只统计有上限的流量（通用流量）
  const limited = flows.filter(f => !f.unlimited);
  const sumTotal = limited.reduce((a, f) => a + (f.totalMB ?? 0), 0);
  const sumUsed  = limited.reduce((a, f) => a + f.usedMB, 0);
  const sumLeft  = limited.reduce((a, f) => a + (f.leftMB ?? 0), 0);
  const sumPct   = sumTotal > 0 ? Math.round(sumUsed / sumTotal * 100) : 0;

  // 更新顶部卡片（只反映有上限流量）
  id('s-remain').textContent = fmtFlow(sumLeft);
  id('s-used').textContent   = fmtFlow(sumUsed);
  id('s-total').textContent  = fmtFlow(sumTotal);
  id('s-pct').textContent    = sumPct + '%';
  id('bar-used-lbl').textContent  = '已用 ' + fmtFlow(sumUsed);
  id('bar-total-lbl').textContent = '共 '   + fmtFlow(sumTotal);

  const bar = id('main-bar');
  bar.style.width      = Math.min(sumPct, 100) + '%';
  bar.style.background = sumPct > 85 ? '#dc2626' : sumPct > 60 ? '#d97706' : '#2563eb';

  // 渲染每条流量
  if (!flows.length) {
    id('pkg-list').innerHTML = '<div class="empty-tip">暂无流量数据</div>';
    return;
  }

  id('pkg-list').innerHTML = flows.map(f => renderFlowItem(f)).join('');
}

function renderFlowItem(f) {
  if (f.unlimited) {
    // 无上限：只显示已用，不显示进度条和百分比
    return `<div class="pkg-item">
      <div class="pkg-left">
        <div class="pkg-name">
          <span class="flow-dot dot-amber"></span>${esc(f.name)}
          <span class="mini-tag amber">无上限</span>
        </div>
        <div class="pkg-expire">当月已用</div>
        <div class="mini-bar-bg"><div class="mini-bar" style="width:0%"></div></div>
      </div>
      <div class="pkg-right">
        <div class="pkg-remain">${fmtFlow(f.usedMB)}</div>
        <div class="pkg-of">不限总量</div>
        <span class="pkg-pct blue">无限制</span>
      </div>
    </div>`;
  }

  const cls      = f.pct > 85 ? 'red' : f.pct > 60 ? 'amber' : 'green';
  const dotCls   = f.pct > 85 ? 'dot-red' : f.pct > 60 ? 'dot-amber' : 'dot-green';
  const barColor = f.pct > 85 ? '#dc2626' : f.pct > 60 ? '#d97706' : '#2563eb';

  return `<div class="pkg-item">
    <div class="pkg-left">
      <div class="pkg-name">
        <span class="flow-dot ${dotCls}"></span>${esc(f.name)}
      </div>
      <div class="pkg-expire">&nbsp;</div>
      <div class="mini-bar-bg">
        <div class="mini-bar" style="width:${Math.min(f.pct,100)}%;background:${barColor}"></div>
      </div>
    </div>
    <div class="pkg-right">
      <div class="pkg-remain">${fmtFlow(f.leftMB)}</div>
      <div class="pkg-of">/ ${fmtFlow(f.totalMB)}</div>
      <span class="pkg-pct ${cls}">已用 ${f.pct}%</span>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════
   SPEED
   rateResource.rate = "500Mbps"
   flowResource.flowPersent = "524.78" (GB)
   terminalResource.terminal = "5G"
   networkSwitchResource.state = "1"
   ══════════════════════════════════════════════ */
async function loadSpeed() {
  try {
    const data = await api('/speed');
    renderSpeed(data);
  } catch(e) {
    id('speed-area').innerHTML = `<div class="error-tip">速率查询失败：${esc(e.message)}</div>`;
  }
}

function renderSpeed(raw) {
  const fr  = raw.flowResource           || {};
  const rr  = raw.rateResource           || {};
  const nsr = raw.networkSwitchResource  || {};
  const tr  = raw.terminalResource       || {};

  const down    = normalizeRate(rr.rate || fr.rate);
  const up      = normalizeRate(rr.upRate || raw.upRate || '');
  const netType = tr.terminal || raw.corner || '5G';
  const has5G   = nsr.state === '1';
  const isWarn  = String(fr.isWarn || '0') === '1';
  const usedGB  = parseFloat(fr.flowPersent) || 0;
  const pkgName = raw.packageName || '';
  const mobile  = fr.mobile || '';

  id('net-badge').textContent = netType;
  id('speed-area').innerHTML = `
    <div class="speed-pair">
      <div class="speed-block">
        <div class="speed-icon dl">↓</div>
        <div><div class="speed-val">${esc(down)}</div><div class="speed-unit">Mbps 峰值下行</div></div>
      </div>
      <div class="speed-block">
        <div class="speed-icon ul">↑</div>
        <div><div class="speed-val">${esc(up)}</div><div class="speed-unit">Mbps 上行</div></div>
      </div>
    </div>
    <div class="info-rows">
      ${pkgName ? row('当前套餐', esc(pkgName)) : ''}
      ${row('终端类型', esc(netType))}
      ${row('5G 覆盖', has5G ? '<span class="pkg-pct green">已覆盖</span>' : '<span class="pkg-pct amber">未检测</span>')}
      ${row('限速状态', isWarn ? '<span class="pkg-pct amber">已限速</span>' : '<span class="pkg-pct green">正常</span>')}
      ${usedGB > 0 ? row('当月用量', usedGB.toFixed(2) + ' GB') : ''}
      ${mobile ? row('号码', esc(mobile)) : ''}
    </div>`;
}

/* ══════════════════════════════════════════════
   BIZ
   data.mainProductInfo  → 主套餐
   data.otherProductInfo → 其他业务（isSubprodInfo=true 为子产品，折叠显示）
   cancelFlag: "0"=正常, "4"=待生效, "1"=已退订
   ══════════════════════════════════════════════ */
async function loadBiz() {
  try {
    const data = await api('/biz');
    renderBiz(data);
  } catch(e) {
    id('biz-area').innerHTML = `<div class="error-tip">业务查询失败：${esc(e.message)}</div>`;
  }
}

function renderBiz(raw) {
  const d     = raw.data || raw.result?.data || {};
  const main  = Array.isArray(d.mainProductInfo)  ? d.mainProductInfo  : [];
  const other = Array.isArray(d.otherProductInfo) ? d.otherProductInfo : [];

  // 主条目：排除 isSubprodInfo=true
  const items = [
    ...main,
    ...other.filter(b => b.isSubprodInfo !== 'true'),
  ];

  // 子产品归属到父 productId（这里 otherProductInfo 里所有 isSubprodInfo=true 的项统一放在第一个主套餐下）
  const subs = other.filter(b => b.isSubprodInfo === 'true').map(b => b.productName || '');

  const statusTag = flag => {
    const map = { '0':'<span class="pkg-pct green">正常</span>', '4':'<span class="pkg-pct blue">待生效</span>', '1':'<span class="pkg-pct red">已退订</span>' };
    return map[flag] || '';
  };

  id('biz-count').textContent = items.length ? items.length + ' 项' : '';

  if (!items.length) { id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>'; return; }

  id('biz-area').innerHTML = items.map((b, idx) => {
    const name  = b.productName || b.serviceName || b.name || '业务';
    const fee   = b.productFee  || b.price || b.fee || '';
    const start = (b.startDate || b.subscribeDate || b.createDate || '').slice(0,10);
    const end   = (b.endDate   || '').slice(0,10);
    const stag  = statusTag(b.cancelFlag || b.orderStatus);
    // 子产品只挂在第一个主条目下
    const showSubs = idx === 0 && subs.length > 0;

    return `<div class="biz-item">
      <div style="flex:1;min-width:0">
        <div class="biz-name">${esc(name)} ${stag}</div>
        <div class="biz-date">
          ${start ? '订购 ' + start : ''}${end ? ' · 到期 ' + end : ''}
        </div>
        ${showSubs ? `<div class="biz-subs">${subs.map(s=>`<span>${esc(s)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="biz-price">${fee ? '¥' + esc(String(fee)) + '/月' : '免费'}</div>
    </div>`;
  }).join('');
}