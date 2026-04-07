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
  console.log(`[API] ${path}`, JSON.stringify(data).slice(0, 600));
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

/* ── Flow ──
 * 真实响应结构（来自控制台日志）：
 * {
 *   flowSumList: [{ elemtype, flowtype, xcanusevalue, xusedvalue, rzbAllUse }],
 *   XsbResources: [{ details: [...], rzbAllUse }],
 *   MlResources:  [{ type:'MlFlowdetailsList' }]
 * }
 * flowSumList[flowtype=1] = 通用流量, flowtype=2 = 定向
 * xcanusevalue = 总量(MB), xusedvalue = 已用(MB)
 */
async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
  } catch (e) {
    id('pkg-list').innerHTML = `<div class="error-tip">流量查询失败：${esc(e.message)}</div>`;
  }
}

function renderFlow(raw) {
  // ── 主流量汇总来自 flowSumList ──
  const sumList = raw.flowSumList || raw.result?.flowSumList || [];

  let total = 0, used = 0, left = 0;
  const pkgItems = [];

  // flowtype: "1"=通用流量, "2"=定向流量
  const ftName = { '1': '通用流量', '2': '定向流量', '3': '其他流量' };

  sumList.forEach(item => {
    const t = parseMB(item.xcanusevalue);    // 总量 MB
    const u = parseMB(item.xusedvalue);      // 已用 MB
    const l = Math.max(t - u, 0);
    total += t; used += u; left += l;
    pkgItems.push({
      name  : ftName[item.flowtype] || `流量(${item.flowtype})`,
      t, u, l,
      expire: '',
    });
  });

  // ── 隐藏流量包来自 XsbResources ──
  const xsbList = raw.XsbResources || raw.result?.XsbResources || [];
  xsbList.forEach(pkg => {
    const details = pkg.details || [];
    details.forEach(d => {
      const t = parseMB(d.xcanusevalue || d.total || d.size);
      const u = parseMB(d.xusedvalue   || d.used);
      const l = Math.max(t - u, 0);
      if (t > 0) {
        total += t; used += u; left += l;
        pkgItems.push({
          name  : d.packageName || d.name || pkg.name || '隐藏流量包',
          t, u, l,
          expire: d.expireDate || d.endDate || '',
          hidden: true,
        });
      }
    });
  });

  // ── 更新汇总卡片 ──
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
    const tag      = p.hidden ? ' <span style="font-size:10px;background:var(--amber-dim);color:var(--amber-txt);padding:1px 5px;border-radius:4px;vertical-align:middle">隐藏包</span>' : '';
    return `<div class="pkg-item">
      <div class="pkg-left">
        <div class="pkg-name">${esc(p.name)}${tag}</div>
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

/* ── Speed ──
 * 真实响应结构：
 * {
 *   flowResource: {
 *     rate: "500Mbps",          ← 下行速率字符串
 *     flowPersent: "510.72",    ← 已用流量 GB
 *     dynamicFlowTitle: "已用流量",
 *     isWarn: "0",
 *     mobile: "186****5993"
 *   },
 *   rateResource: { rate: "500Mbps", button: "去提速", url: "..." },
 *   networkSwitchResource: { state: "1", button: "查看5G覆盖" },
 *   terminalResource: { terminal: "5G" }
 * }
 */
async function loadSpeed() {
  try {
    const data = await api('/speed');
    renderSpeed(data);
  } catch (e) {
    id('speed-area').innerHTML = `<div class="error-tip">速率查询失败：${esc(e.message)}</div>`;
  }
}

function renderSpeed(raw) {
  const fr  = raw.flowResource        || raw.result?.flowResource        || {};
  const rr  = raw.rateResource        || raw.result?.rateResource        || {};
  const nsr = raw.networkSwitchResource || raw.result?.networkSwitchResource || {};
  const tr  = raw.terminalResource    || raw.result?.terminalResource    || {};

  // rate 字段格式: "500Mbps" 或 "500" (单位 Mbps)
  const parseRate = s => {
    if (!s) return null;
    const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : n;
  };

  // 下行速率优先取 rateResource.rate（套餐速率），次取 flowResource.rate
  const dlRaw = rr.rate || fr.rate || '';
  const dl    = parseRate(dlRaw);

  // 联通接口一般不单独给上行，rr里有时有
  const ulRaw = rr.upRate || raw.upRate || raw.result?.upRate || '';
  const ul    = parseRate(ulRaw);

  // 已用流量（flowResource.flowPersent 单位是 GB 字符串）
  const usedGB = parseFloat(fr.flowPersent) || 0;

  // 网络类型: terminalResource.terminal
  const netType = tr.terminal || raw.netType || raw.networkType || '5G';

  // 限速: flowResource.isWarn = "1" 表示已限速
  const isWarn = fr.isWarn === '1' || fr.isWarn === 1;

  // QCI: 这个接口一般不返回 QCI，用 desc 里的信息
  const tips = raw.tips || raw.result?.tips || '';

  id('net-badge').textContent = netType;

  id('speed-area').innerHTML = `
    <div class="speed-pair">
      <div class="speed-block">
        <div class="speed-icon dl">↓</div>
        <div>
          <div class="speed-val">${dl !== null ? dl : '—'}</div>
          <div class="speed-unit">Mbps 下行</div>
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
      ${row('终端类型',   netType)}
      ${row('5G 覆盖',    nsr.state === '1' ? '<span class="pkg-pct green">已覆盖</span>' : '<span class="pkg-pct amber">未知</span>')}
      ${row('限速状态',   isWarn
        ? '<span class="pkg-pct amber">已限速</span>'
        : '<span class="pkg-pct green">正常</span>')}
      ${usedGB > 0 ? row('当月用量', usedGB.toFixed(2) + ' GB') : ''}
      ${fr.mobile ? row('号码', fr.mobile) : ''}
    </div>
    ${tips ? `<div class="speed-tips">${tips}</div>` : ''}`;
}

/* ── Biz ──
 * 真实响应结构：
 * {
 *   data: {
 *     mainProductInfo: [{ orderTime, productId, endDate, orderStatus, detailFlag, productFee, productName, startDate }],
 *     otherProductInfo: [{ discntArr, orderTime, productId, endDate, isSubprodInfo, productFee, cancelFlag, productName, startDate }]
 *   }
 * }
 */
async function loadBiz() {
  try {
    const data = await api('/biz');
    renderBiz(data);
  } catch (e) {
    id('biz-area').innerHTML = `<div class="error-tip">业务查询失败：${esc(e.message)}</div>`;
  }
}

function renderBiz(raw) {
  const d = raw.data || raw.result?.data || raw.result || raw;

  // 主套餐 + 其他业务合并
  const main  = Array.isArray(d.mainProductInfo)  ? d.mainProductInfo  : [];
  const other = Array.isArray(d.otherProductInfo) ? d.otherProductInfo : [];
  const list  = [...main, ...other];

  id('biz-count').textContent = list.length ? list.length + ' 项' : '';

  if (!list.length) {
    id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>';
    return;
  }

  id('biz-area').innerHTML = list.map(b => {
    const name  = b.productName || b.name || b.serviceName || '业务';
    const fee   = b.productFee  || b.price || b.fee || '';
    const start = (b.startDate  || b.orderTime || b.createDate || '').slice(0, 10);
    const end   = (b.endDate    || '').slice(0, 10);
    const isSub = b.isSubprodInfo === 'true' || b.isSubprodInfo === true;

    return `<div class="biz-item">
      <div>
        <div class="biz-name">${esc(name)}${isSub ? ' <span style="font-size:10px;background:var(--blue-dim);color:var(--blue-txt);padding:1px 5px;border-radius:4px">子产品</span>' : ''}</div>
        <div class="biz-date">${start ? '订购 ' + start : ''}${end ? ' · 到期 ' + end : ''}</div>
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
