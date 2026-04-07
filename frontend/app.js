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
console.log([API] ${path}, data);
if (!res.ok || (data.code && !['0000','200',200,'1000','success','SUCCESS'].includes(data.code))) {
throw new Error(data.message || data.resultMessage || data.msg || 请求失败 (${res.status}));
}
return data;
}

/* ===== Helpers ===== */
const id = i => document.getElementById(i);
const val = i => id(i).value.trim();
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const row = (k, v) => <div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>;

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

// 解析 MB 数值,返回数字或 null(无法解析时)
function parseMB(v) {
if (v === undefined || v === null) return null;
const n = parseFloat(String(v).replace(/,/g, ''));
return Number.isFinite(n) ? n : null;
}

function fmtFlow(mb) {
if (mb === null || mb === undefined || !Number.isFinite(mb)) return '—';
if (mb === 0) return '0 MB';
if (Math.abs(mb) >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
if (Math.abs(mb) >= 1024) return (mb / 1024).toFixed(2) + ' GB';
return mb.toFixed(0) + ' MB';
}

function normalizeRate(v) {
if (!v) return '—';
const m = String(v).trim().match(/([\d.]+)\s*([A-Za-z/]+)?/);
if (!m) return v;
const num = m[1], unit = m[2] || 'Mbps';
return /mbps/i.test(unit) ? num : ${num} ${unit};
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
showMsg('msg-sms','验证码已发送,请注意查收','ok');
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
|| data.data?.token || data.data?.ecs_token || '';
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
btn.disabled = true; btn.textContent = ${S.countdown}s 后重发;
clearInterval(S.timer);
S.timer = setInterval(() => {
S.countdown--;
btn.textContent = ${S.countdown}s 后重发;
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
showMsg('msg-token','Token 无效或已过期:' + e.message,'err');
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
id('pkg-list').innerHTML = '<div class="loading-row"><div class="spinner"></div>刷新中...</div>';
id('speed-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
id('biz-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
await Promise.allSettled([loadFlow(), loadSpeed(), loadBiz()]);
btn.classList.remove('spinning');
}

/* ══════════════════════════════════════════════════════
FLOW
真实结构(已确认):
resources: [
{ type:"flow", details: [
{ feePolicyName, flowType, total, use, remain, usedPercent, limited, endDate, ... }
]
},
{ type:"Voice", details:[...] },
{ type:"smsList", details:[] }
]
flowSumList: [
{ flowtype:"1", xcanusevalue:"4005.79", xusedvalue:"90.21" }, // 通用汇总 MB
{ flowtype:"2", xcanusevalue:"0.00", xusedvalue:"574808.19"} // 定向汇总 MB(xcanusevalue=0.00 → 无上限)
]

detail 字段:
feePolicyName → 名称
flowType → "1"通用 "2"定向
total → 总量 MB("0.00" 且 flowType=2 → 无上限)
use → 已用 MB
remain → 剩余 MB(可能为负,定向免流超出不额外计费)
usedPercent → 百分比字符串
limited → "0"有限 "1"无限/定向
endDate → 到期
hide → 是否隐藏
══════════════════════════════════════════════════════ */
async function loadFlow() {
try {
const data = await api('/flow');
renderFlow(data);
} catch(e) {
id('pkg-list').innerHTML = <div class="error-tip">流量查询失败:${esc(e.message)}</div>;
}
}

function renderFlow(raw) {
// ── 从 resources 里找 type=flow 的那组 ──
const flowResource = (raw.resources || []).find(r => r.type === 'flow');
const details = flowResource?.details || [];

// ── 从 flowSumList 拿汇总(通用流量) ──
const sumList = raw.flowSumList || raw.fresSumList || [];
const generalSum = sumList.find(s => s.flowtype === '1' || s.elemtype === '3' && s.flowtype === '1');
const directedSum = sumList.find(s => s.flowtype === '2');

const sumTotal = parseMB(generalSum?.xcanusevalue) ?? 0;
const sumUsed = parseMB(generalSum?.xusedvalue) ?? 0;
const sumLeft = Math.max(sumTotal - sumUsed, 0);
const sumPct = sumTotal > 0 ? Math.round(sumUsed / sumTotal * 100) : 0;

// ── 顶部卡片:只展示通用流量汇总 ──
id('s-remain').textContent = fmtFlow(sumLeft);
id('s-used').textContent = fmtFlow(sumUsed);
id('s-total').textContent = fmtFlow(sumTotal);
id('s-pct').textContent = sumPct + '%';
id('bar-used-lbl').textContent = '已用 ' + fmtFlow(sumUsed);
id('bar-total-lbl').textContent = '共 ' + fmtFlow(sumTotal);

const bar = id('main-bar');
bar.style.width = Math.min(sumPct, 100) + '%';
bar.style.background = sumPct > 85 ? '#dc2626' : sumPct > 60 ? '#d97706' : '#2563eb';

if (!details.length) {
id('pkg-list').innerHTML = '<div class="empty-tip">暂无流量包明细</div>';
return;
}

// ── 分组:通用(flowType=1) / 定向(flowType=2) ──
const general = details.filter(d => d.flowType === '1' && !d.hide);
const directed = details.filter(d => d.flowType === '2' && !d.hide);

let html = '';

// 通用流量组
if (general.length) {
html += <div class="flow-section-header"> <span class="flow-dot dot-blue"></span>通用流量 </div>;
html += general.map(d => renderDetail(d, false)).join('');
}

// 定向流量组
if (directed.length) {
const dirUsedMB = parseMB(directedSum?.xusedvalue) ?? 0;
html += <div class="flow-section-header" style="margin-top:4px"> <span class="flow-dot dot-amber"></span>定向流量 <span class="mini-tag amber">无上限</span> <span style="margin-left:auto;font-size:11px;font-weight:400;color:var(--text-3)">当月已用 ${fmtFlow(dirUsedMB)}</span> </div>;
html += directed.map(d => renderDetail(d, true)).join('');
}

id('pkg-list').innerHTML = html;
}

function renderDetail(d, isDirected) {
const name = d.feePolicyName || d.addUpItemName || '流量包';
const totalMB = parseMB(d.total);
const usedMB = parseMB(d.use) ?? 0;
const remainMB= parseMB(d.remain) ?? 0;
const pct = parseInt(d.usedPercent, 10) || (totalMB > 0 ? Math.round(usedMB / totalMB * 100) : 0);
const endDate = (d.endDate === '长期有效' || !d.endDate) ? '' : d.endDate;

// 定向免流:total=0 表示无上限,limited=1 也表示无上限定向
const unlimited = isDirected && (totalMB === 0 || totalMB === null || d.limited === '1');

if (unlimited) {
return <div class="pkg-item pkg-item--directed"> <div class="pkg-left"> <div class="pkg-name">${esc(name)}</div> <div class="pkg-expire">${endDate || '长期有效'}</div> <div class="mini-bar-bg" style="width:100px"> <div class="mini-bar" style="width:100%;background:var(--amber-txt);opacity:.3"></div> </div> </div> <div class="pkg-right"> <div class="pkg-remain" style="color:var(--text-2)">${fmtFlow(usedMB)}</div> <div class="pkg-of">已用 / 无上限</div> <span class="pkg-pct blue">免流</span> </div> </div>;
}

// 有上限流量包
const cls = pct >= 100 ? 'red' : pct > 85 ? 'red' : pct > 60 ? 'amber' : 'green';
const barColor = pct >= 100 ? '#dc2626' : pct > 85 ? '#dc2626' : pct > 60 ? '#d97706' : '#2563eb';
const leftMB = Math.max(remainMB, 0); // remain 可能为负(超额),显示 0

return <div class="pkg-item"> <div class="pkg-left"> <div class="pkg-name">${esc(name)}</div> <div class="pkg-expire">${endDate || '长期有效'}</div> <div class="mini-bar-bg"> <div class="mini-bar" style="width:${Math.min(pct, 100)}%;background:${barColor}"></div> </div> </div> <div class="pkg-right"> <div class="pkg-remain">${fmtFlow(leftMB)}</div> <div class="pkg-of">/ ${fmtFlow(totalMB)}</div> <span class="pkg-pct ${cls}">已用 ${pct}%</span> </div> </div>;
}

/* ══════════════════════════════════════════════════════
SPEED (字段已确认)
rateResource.rate = "500Mbps"
flowResource.flowPersent = "524.78" GB
terminalResource.terminal = "5G"
networkSwitchResource.state = "1"
══════════════════════════════════════════════════════ */
async function loadSpeed() {
try {
const data = await api('/speed');
renderSpeed(data);
} catch(e) {
id('speed-area').innerHTML = <div class="error-tip">速率查询失败:${esc(e.message)}</div>;
}
}

function renderSpeed(raw) {
const fr = raw.flowResource || {};
const rr = raw.rateResource || {};
const nsr = raw.networkSwitchResource || {};
const tr = raw.terminalResource || {};

const down = normalizeRate(rr.rate || fr.rate);
const up = normalizeRate(rr.upRate || raw.upRate || '');
const netType = tr.terminal || raw.corner || '5G';
const has5G = nsr.state === '1';
const isWarn = String(fr.isWarn || '0') === '1';
const usedGB = parseFloat(fr.flowPersent) || 0;
const pkgName = raw.packageName || '';
const mobile = fr.mobile || '';

id('net-badge').textContent = netType;
id('speed-area').innerHTML = <div class="speed-pair"> <div class="speed-block"> <div class="speed-icon dl">↓</div> <div><div class="speed-val">${esc(down)}</div><div class="speed-unit">Mbps 峰值下行</div></div> </div> <div class="speed-block"> <div class="speed-icon ul">↑</div> <div><div class="speed-val">${esc(up)}</div><div class="speed-unit">Mbps 上行</div></div> </div> </div> <div class="info-rows"> ${pkgName ? row('当前套餐', esc(pkgName)) : ''} ${row('终端类型', esc(netType))} ${row('5G 覆盖', has5G ? '<span class="pkg-pct green">已覆盖</span>' : '<span class="pkg-pct amber">未检测</span>')} ${row('限速状态', isWarn ? '<span class="pkg-pct amber">已限速</span>' : '<span class="pkg-pct green">正常</span>')} ${usedGB > 0 ? row('当月总用量', usedGB.toFixed(2) + ' GB') : ''} ${mobile ? row('号码', esc(mobile)) : ''} </div>;
}

/* ══════════════════════════════════════════════════════
BIZ (字段已确认)
data.mainProductInfo → 主套餐
data.otherProductInfo → 其他(isSubprodInfo=true 为子产品)
cancelFlag: "0"正常 "4"待生效 "1"已退订
══════════════════════════════════════════════════════ */
async function loadBiz() {
try {
const data = await api('/biz');
renderBiz(data);
} catch(e) {
id('biz-area').innerHTML = <div class="error-tip">业务查询失败:${esc(e.message)}</div>;
}
}

function renderBiz(raw) {
const d = raw.data || raw.result?.data || {};
const main = Array.isArray(d.mainProductInfo) ? d.mainProductInfo : [];
const other = Array.isArray(d.otherProductInfo) ? d.otherProductInfo : [];

const items = [...main, ...other.filter(b => b.isSubprodInfo !== 'true')];
const subs = other.filter(b => b.isSubprodInfo === 'true').map(b => b.productName || '');

const statusTag = flag => ({ '0':'<span class="pkg-pct green">正常</span>', '4':'<span class="pkg-pct blue">待生效</span>', '1':'<span class="pkg-pct red">已退订</span>' }[flag] || '');

id('biz-count').textContent = items.length ? items.length + ' 项' : '';
if (!items.length) { id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>'; return; }

id('biz-area').innerHTML = items.map((b, idx) => {
const name = b.productName || b.serviceName || b.name || '业务';
const fee = b.productFee || b.price || b.fee || '';
const start = (b.startDate || b.subscribeDate || b.createDate || '').slice(0,10);
const end = (b.endDate || '').slice(0,10);
const stag = statusTag(b.cancelFlag || b.orderStatus);
const showSubs = idx === 0 && subs.length > 0;

return `<div class="biz-item"> <div style="flex:1;min-width:0"> <div class="biz-name">${esc(name)} ${stag}</div> <div class="biz-date">${start ? '订购 ' + start : ''}${end ? ' · 到期 ' + end : ''}</div> ${showSubs ? `<div class="biz-subs">${subs.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''} </div> <div class="biz-price">${fee ? '¥' + esc(String(fee)) + '/月' : '免费'}</div> </div>`;
}).join('');
}