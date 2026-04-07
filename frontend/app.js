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
  console.log(`[API] ${path}`, JSON.stringify(data).slice(0, 800));
  if (!res.ok || (data.code && !['0000','200',200,'1000','success','SUCCESS'].includes(data.code))) {
    throw new Error(data.message || data.resultMessage || data.msg || `请求失败 (${res.status})`);
  }
  return data;
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
           || data.data?.token   || data.data?.ecs_token || '';
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
  id('pkg-list').innerHTML   = '<div class="loading-row"><div class="spinner"></div>刷新中...</div>';
  id('speed-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  id('biz-area').innerHTML   = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  await Promise.allSettled([loadFlow(), loadSpeed(), loadBiz()]);
  btn.classList.remove('spinning');
}

/* ─────────────────────────────────────────────
 * FLOW
 * 真实响应（已确认）：
 * {
 *   flowSumList: [
 *     { elemtype:"3", flowtype:"1", xcanusevalue:"4005.79", xusedvalue:"90.21" },  // 通用流量 MB
 *     { elemtype:"3", flowtype:"2", xcanusevalue:"",        xusedvalue:"558008.16" } // 定向流量 MB
 *   ],
 *   XsbResources: [{ details:[], rzbAllUse:"0.0" }],  // 隐藏包（details 为空时跳过）
 *   RzbResources: [{ details:[], rzbAllUse:"0.0" }],
 * }
 * ───────────────────────────────────────────── */
async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
  } catch (e) {
    id('pkg-list').innerHTML = `<div class="error-tip">流量查询失败：${esc(e.message)}</div>`;
  }
}

function renderFlow(raw) {
  const pkgItems = [];
  let total = 0, used = 0, left = 0;

  // ── 1. flowSumList：通用 / 定向流量，单位 MB ──
  const ftName = { '1': '通用流量', '2': '定向流量', '3': '其他流量' };
  const sumList = raw.flowSumList || [];
  sumList.forEach(item => {
    const t = parseMB(item.xcanusevalue);   // 总量
    const u = parseMB(item.xusedvalue);     // 已用
    // xcanusevalue 为空字符串时跳过（定向流量无上限的情况）
    if (t === 0 && u === 0) return;
    const l = Math.max(t - u, 0);
    total += t; used += u; left += l;
    pkgItems.push({
      name  : ftName[item.flowtype] || `流量(${item.flowtype})`,
      t, u, l, expire: '', hidden: false,
    });
  });

  // ── 2. XsbResources / RzbResources：隐藏流量包 ──
  const hiddenSources = [
    ...(raw.XsbResources || []),
    ...(raw.RzbResources || []),
  ];
  hiddenSources.forEach(pkg => {
    (pkg.details || []).forEach(d => {
      const t = parseMB(d.xcanusevalue || d.total || d.size);
      const u = parseMB(d.xusedvalue   || d.used);
      if (t === 0 && u === 0) return;
      const l = Math.max(t - u, 0);
      total += t; used += u; left += l;
      pkgItems.push({
        name  : d.packageName || d.name || pkg.name || '隐藏流量包',
        t, u, l,
        expire: d.expireDate || d.endDate || '',
        hidden: true,
      });
    });
  });

  // ── 汇总卡片 ──
  const pct = total > 0 ? Math.round(used / total * 100) : 0;
  id('s-remain').textContent = fmtGB(left);
  id('s-used').textContent   = fmtGB(used);
  id('s-total').textContent  = fmtGB(total);
  id('s-pct').textContent    = pct + '%';
  id('bar-used-lbl').textContent  = '已用 ' + fmtGB(used);
  id('bar-total-lbl').textContent = '共 '   + fmtGB(total);

  const bar = id('main-bar');
  bar.style.width      = Math.min(pct, 100) + '%';
  bar.style.background = pct > 85 ? '#dc2626' : pct > 60 ? '#d97706' : '#2563eb';

  if (!pkgItems.length) {
    id('pkg-list').innerHTML = '<div class="empty-tip">暂无流量包数据</div>';
    return;
  }

  id('pkg-list').innerHTML = pkgItems.map(p => {
    const pp       = p.t > 0 ? Math.round(p.u / p.t * 100) : 0;
    const cls      = pp > 85 ? 'red' : pp > 60 ? 'amber' : 'green';
    const barColor = pp > 85 ? '#dc2626' : pp > 60 ? '#d97706' : '#2563eb';
    const hiddenTag = p.hidden
      ? '<span class="mini-tag amber">隐藏包</span>' : '';
    return `<div class="pkg-item">
      <div class="pkg-left">
        <div class="pkg-name">${esc(p.name)} ${hiddenTag}</div>
        ${p.expire
          ? `<div class="pkg-expire">到期 ${p.expire}</div>`
          : '<div class="pkg-expire">&nbsp;</div>'}
        <div class="mini-bar-bg">
          <div class="mini-bar" style="width:${Math.min(pp,100)}%;background:${barColor}"></div>
        </div>
      </div>
      <div class="pkg-right">
        <div class="pkg-remain">${fmtGB(p.l)}</div>
        <div class="pkg-of">/ ${fmtGB(p.t)}</div>
        <span class="pkg-pct ${cls}">已用 ${pp}%</span>
      </div>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
 * SPEED
 * 真实响应（已确认）：
 * {
 *   desc: "ok",
 *   flowResource:  { newUnit:"GB", flowPersent:"515.02", dynamicFlowTitle:"已用流量", isWarn:"0", mobile:"186****5993" },
 *   rateResource:  { rate:"500Mbps", button:"去提速", url:"..." },
 *   packageName:   "流邦卡19元套餐",
 *   corner:        "5G",
 *   networkSwitchResource: { state:"1", button:"查看5G覆盖", url:"..." },
 *   terminalResource:      { terminal:"5G", button:"特惠购机", url:"..." },
 * }
 * ───────────────────────────────────────────── */
async function loadSpeed() {
  try {
    const data = await api('/speed');
    renderSpeed(data);
  } catch (e) {
    id('speed-area').innerHTML = `<div class="error-tip">速率查询失败：${esc(e.message)}</div>`;
  }
}

function renderSpeed(raw) {
  const fr  = raw.flowResource           || {};
  const rr  = raw.rateResource           || {};
  const nsr = raw.networkSwitchResource  || {};
  const tr  = raw.terminalResource       || {};

  // 解析速率字符串，如 "500Mbps" → 500
  const parseRate = s => {
    if (!s) return null;
    const n = parseFloat(String(s).replace(/[^\d.]/g, ''));
    return isNaN(n) ? null : n;
  };

  // 下行：套餐速率上限，rateResource.rate
  const dl = parseRate(rr.rate || fr.rate);
  // 上行：接口一般不单独给，置空
  const ul = parseRate(rr.upRate || raw.upRate || '');

  // 当月用量：flowResource.flowPersent（单位由 newUnit 决定，实测是 GB）
  const usedAmount = parseFloat(fr.flowPersent) || 0;
  const usedUnit   = fr.newUnit || 'GB';

  // 网络 / 终端类型
  const netType = tr.terminal || raw.corner || raw.netType || '5G';

  // 限速：isWarn=1 表示已达限速
  const isWarn = fr.isWarn === '1' || fr.isWarn === 1;

  // 套餐名
  const pkgName = raw.packageName || '';

  // 5G 覆盖状态：networkSwitchResource.state=1 表示覆盖
  const has5G = nsr.state === '1';

  id('net-badge').textContent = netType;

  id('speed-area').innerHTML = `
    <div class="speed-pair">
      <div class="speed-block">
        <div class="speed-icon dl">↓</div>
        <div>
          <div class="speed-val">${dl !== null ? dl : '—'}</div>
          <div class="speed-unit">Mbps 峰值下行</div>
        </div>
      </div>
      <div class="speed-block">
        <div class="speed-icon ul">↑</div>
        <div>
          <div class="speed-val">${ul !== null ? ul : '—'}</div>
          <div class="speed-unit">Mbps 上行</div>
        </div>
      </div>
    </div>
    <div class="info-rows">
      ${pkgName ? row('当前套餐', pkgName) : ''}
      ${row('终端类型', netType)}
      ${row('5G 覆盖', has5G
        ? '<span class="pkg-pct green">已覆盖</span>'
        : '<span class="pkg-pct amber">未检测</span>')}
      ${row('限速状态', isWarn
        ? '<span class="pkg-pct amber">已限速</span>'
        : '<span class="pkg-pct green">正常</span>')}
      ${usedAmount > 0 ? row(`当月用量 (${usedUnit})`, usedAmount.toFixed(2)) : ''}
      ${fr.mobile ? row('号码', fr.mobile) : ''}
    </div>`;
}

/* ─────────────────────────────────────────────
 * BIZ
 * 真实响应（已确认）：
 * {
 *   data: {
 *     mainProductInfo: [
 *       { orderTime:"", productId:"90413283", endDate:"", orderStatus:"0",
 *         detailFlag:"0", productFee:"", productName:"流邦卡19元套餐", startDate:"2021-03-05" }
 *     ],
 *     otherProductInfo: [
 *       { discntArr:[], orderTime:"", productId:"91408537", endDate:"2026-06-30 23:59:59",
 *         isSubprodInfo:"true", productFee:"", cancelFlag:"4",
 *         productName:"预存200元得权益N选二（北京）-立即生效", startDate:"2026-01-20 13:12:41" },
 *       ...
 *     ]
 *   }
 * }
 * ───────────────────────────────────────────── */
async function loadBiz() {
  try {
    const data = await api('/biz');
    renderBiz(data);
  } catch (e) {
    id('biz-area').innerHTML = `<div class="error-tip">业务查询失败：${esc(e.message)}</div>`;
  }
}

function renderBiz(raw) {
  const d = raw.data || raw.result?.data || {};

  const main  = Array.isArray(d.mainProductInfo)  ? d.mainProductInfo  : [];
  const other = Array.isArray(d.otherProductInfo) ? d.otherProductInfo : [];

  // 主套餐排最前，子产品过滤掉（isSubprodInfo=true 只是折叠信息）
  // cancelFlag=4 表示"立即生效/待生效"，正常显示
  const list = [
    ...main,
    ...other.filter(b => b.isSubprodInfo !== 'true'),
  ];
  // 子产品作为附属信息单独收集，用于展示在主条目下
  const subMap = {};
  other.filter(b => b.isSubprodInfo === 'true').forEach(b => {
    const pid = b.productId;
    if (!subMap[pid]) subMap[pid] = [];
    subMap[pid].push(b.productName || '');
  });

  id('biz-count').textContent = list.length ? list.length + ' 项' : '';

  if (!list.length) {
    id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>';
    return;
  }

  id('biz-area').innerHTML = list.map(b => {
    const name  = b.productName || b.name || b.serviceName || '业务';
    const fee   = b.productFee  || b.price || b.fee || '';
    const start = (b.startDate  || b.orderTime || '').slice(0, 10);
    const end   = (b.endDate    || '').slice(0, 10);
    // cancelFlag: 0=正常, 4=待生效/立即生效, 1=已退订
    const statusMap = { '0':'<span class="pkg-pct green">正常</span>', '4':'<span class="pkg-pct blue">待生效</span>', '1':'<span class="pkg-pct red">已退订</span>' };
    const statusTag = statusMap[b.cancelFlag] || statusMap[b.orderStatus] || '';
    const subs = subMap[b.productId] || [];

    return `<div class="biz-item">
      <div style="flex:1;min-width:0">
        <div class="biz-name">${esc(name)} ${statusTag}</div>
        <div class="biz-date">
          ${start ? '订购 ' + start : ''}${end ? ' · 到期 ' + end : ''}
        </div>
        ${subs.length ? `<div class="biz-subs">${subs.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="biz-price">${fee ? '¥' + fee + '/月' : '免费'}</div>
    </div>`;
  }).join('');
}

/* ===== Helpers ===== */
const id  = i => document.getElementById(i);
const val = i => id(i).value.trim();
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const row = (k, v) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`;

// 解析流量值，单位 MB（联通接口 flowSumList 里的值直接是 MB 数字字符串）
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

function fmtGB(mb) {
  if (!mb && mb !== 0) return '—';
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
