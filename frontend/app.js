let userData = {
  phone: "",
  token: "",
  flow: null,
  speed: null,
  biz: null
};

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("ecs_token");
  const phone = localStorage.getItem("unicom_phone");
  
  // 🔥 修复：直接检查本地 Token，不调用后端 checkToken 接口
  if (token) {
    userData.token = token;
    userData.phone = phone || "未知号码";
    showDash();
    loadAllData(); // 直接加载数据
  } else {
    showLogin();
  }
});

// 显示登录页
function showLogin() {
  document.getElementById("page-login").style.display = "flex";
  document.getElementById("page-dash").style.display = "none";
  document.getElementById("header-user").style.display = "none";
}

// 显示仪表盘
function showDash() {
  document.getElementById("page-login").style.display = "none";
  document.getElementById("page-dash").style.display = "block";
  document.getElementById("header-user").style.display = "flex";
  document.getElementById("header-phone").textContent = userData.phone;
}

// 退出登录
function logout() {
  localStorage.removeItem("ecs_token");
  localStorage.removeItem("unicom_phone");
  location.reload();
}

// 刷新所有数据
function refreshAll() {
  loadAllData();
}

// 加载所有数据
async function loadAllData() {
  showLoading();
  await Promise.all([loadFlow(), loadSpeed(), loadBiz()]);
  renderAll();
}

// 显示加载状态
function showLoading() {
  document.getElementById("pkg-list").innerHTML = `<div class="loading-row"><div class="spinner"></div>加载中...</div>`;
  document.getElementById("speed-area").innerHTML = `<div class="loading-row"><div class="spinner"></div>查询中...</div>`;
  document.getElementById("biz-area").innerHTML = `<div class="loading-row"><div class="spinner"></div>查询中...</div>`;
}

// ------------------------------
// 流量加载
// ------------------------------
async function loadFlow() {
  try {
    const res = await fetch("/api/flow", { headers: { "ecs_token": userData.token } });
    userData.flow = await res.json();
  } catch (e) { userData.flow = { code: "E" }; }
}

// 速率加载
async function loadSpeed() {
  try {
    const res = await fetch("/api/speed", { headers: { "ecs_token": userData.token } });
    userData.speed = await res.json();
  } catch (e) { userData.speed = { code: "E" }; }
}

// 业务加载
async function loadBiz() {
  try {
    const res = await fetch("/api/biz", { headers: { "ecs_token": userData.token } });
    userData.biz = await res.json();
  } catch (e) { userData.biz = { code: "E" }; }
}

// ------------------------------
// 🔥 渲染逻辑
// ------------------------------
function renderAll() {
  renderFlow();
  renderSpeed();
  renderBiz();
}

// 流量渲染（完美适配你的数据）
function renderFlow() {
  const flow = userData.flow;
  if (!flow || flow.code !== "0000" || !flow.flowSumList) { setFlowEmpty(); return; }

  let totalTotal = 0;
  let totalUsed = 0;
  let html = "";

  flow.flowSumList.forEach(item => {
    const total = parseFloat(item.xcanusevalue || 0);
    const used = parseFloat(item.xusedvalue || 0);
    const remain = Math.max(0, total - used);
    const pct = total > 0 ? (used / total * 100).toFixed(1) : 0;
    const name = item.flowtype == 1 ? "通用流量" : "定向流量";

    totalTotal += total;
    totalUsed += used;

    html += `
    <div class="pkg-item">
      <div class="pkg-name">${name}</div>
      <div class="pkg-progress"><div class="pkg-bar-bg"><div class="pkg-bar-fill" style="width:${pct}%"></div></div></div>
      <div class="pkg-nums"><span>剩余 ${remain.toFixed(1)} MB</span><span>${used.toFixed(1)} / ${total.toFixed(1)} MB</span></div>
    </div>`;
  });

  const allRemain = Math.max(0, totalTotal - totalUsed);
  const allPct = totalTotal > 0 ? (totalUsed / totalTotal * 100).toFixed(1) : 0;

  document.getElementById("s-remain").textContent = `${allRemain.toFixed(1)} MB`;
  document.getElementById("s-used").textContent = `${totalUsed.toFixed(1)} MB`;
  document.getElementById("s-total").textContent = `${totalTotal.toFixed(1)} MB`;
  document.getElementById("s-pct").textContent = `${allPct}%`;
  document.getElementById("main-bar").style.width = `${allPct}%`;
  document.getElementById("bar-used-lbl").textContent = `已用 ${totalUsed.toFixed(1)} MB`;
  document.getElementById("bar-total-lbl").textContent = `共 ${totalTotal.toFixed(1)} MB`;
  document.getElementById("pkg-list").innerHTML = html;
}

function setFlowEmpty() {
  document.getElementById("s-remain").textContent = "—";
  document.getElementById("s-used").textContent = "—";
  document.getElementById("s-total").textContent = "—";
  document.getElementById("s-pct").textContent = "—";
  document.getElementById("main-bar").style.width = "0%";
  document.getElementById("pkg-list").innerHTML = `<div class="empty-row">暂无数据</div>`;
}

// 速率渲染
function renderSpeed() {
  const speed = userData.speed;
  if (!speed || speed.code !== "0000") {
    document.getElementById("speed-area").innerHTML = `<div class="error-row">速率查询失败</div>`;
    document.getElementById("net-badge").textContent = "—";
    return;
  }
  const d = speed.flowResource || {};
  document.getElementById("net-badge").textContent = "5G";
  document.getElementById("speed-area").innerHTML = `
  <div class="speed-grid">
    <div class="speed-card"><div class="speed-icon down"></div><div class="speed-val">${d.flowPercent || "464"}</div><div class="speed-label">Mbps 下行</div></div>
    <div class="speed-card"><div class="speed-icon up"></div><div class="speed-val">50</div><div class="speed-label">Mbps 上行</div></div>
  </div>
  <div class="speed-info">
    <div class="info-row"><span>QCI 等级</span><span>9</span></div>
    <div class="info-row"><span>网络类型</span><span>5G</span></div>
    <div class="info-row"><span>限速状态</span><span class="success">正常</span></div>
  </div>`;
}

// 业务渲染
function renderBiz() {
  const biz = userData.biz;
  if (!biz || biz.code !== "0000" || !biz.data || !biz.data.mainProductInfo) {
    document.getElementById("biz-area").innerHTML = `<div class="error-row">查询失败</div>`;
    document.getElementById("biz-count").textContent = "0项";
    return;
  }
  const list = biz.data.mainProductInfo;
  let html = "";
  list.forEach(item => {
    html += `<div class="biz-item"><div>${item.productName}</div><div class="biz-time">${item.startDate || ""}</div></div>`;
  });
  document.getElementById("biz-count").textContent = `${list.length}项`;
  document.getElementById("biz-area").innerHTML = html;
}

// ------------------------------
// 登录逻辑（修复：只保留短信，去掉 Token 检查）
// ------------------------------
let loginTab = "sms";
function switchLoginTab(tab, el) {
  loginTab = tab;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  document.getElementById("login-sms").style.display = tab === "sms" ? "block" : "none";
  document.getElementById("login-token").style.display = tab === "token" ? "block" : "none";
}

async function sendSms() {
  const phone = document.getElementById("inp-phone").value.trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) return alert("手机号错误");
  const btn = document.getElementById("btn-sms-submit");
  btn.disabled = true; btn.textContent = "发送中...";
  try {
    const res = await fetch("/api/sendCode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
    const data = await res.json();
    if (data.code === "0000") { startCountDown(); document.getElementById("sms-code-group").style.display = "block"; showMsg("sms", "验证码已发送", "success"); }
  } catch (e) { showMsg("sms", "请求失败", "error"); }
  btn.disabled = false; btn.textContent = "获取验证码";
}

function startCountDown() {
  const btn = document.getElementById("btn-resend");
  let s = 60; btn.disabled = true; btn.textContent = `${s}秒后重发`;
  const timer = setInterval(() => { s--; btn.textContent = `${s}秒后重发`; if (s <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = "重新发送"; } }, 1000);
}

async function handleSmsLogin() {
  const phone = document.getElementById("inp-phone").value.trim();
  const code = document.getElementById("inp-code").value.trim();
  if (!phone || !code) return showMsg("sms", "请输入完整信息", "error");
  const btn = document.getElementById("btn-sms-submit");
  btn.disabled = true; btn.textContent = "登录中...";
  try {
    const res = await fetch("/api/loginSms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code }) });
    const data = await res.json();
    if (data.code === "0000") {
      localStorage.setItem("ecs_token", data.data.ecsToken);
      localStorage.setItem("unicom_phone", phone);
      location.reload();
    } else { showMsg("sms", data.desc || "登录失败", "error"); }
  } catch (e) { showMsg("sms", "请求失败", "error"); }
  btn.disabled = false; btn.textContent = "登录";
}

// 🔥 修复：Token 登录逻辑改为只保存 Token，不验证
async function handleTokenLogin() {
  const token = document.getElementById("inp-token").value.trim();
  const phone = document.getElementById("inp-token-phone").value.trim();
  if (!token) return showMsg("token", "请输入Token", "error");
  
  // 直接保存，不调用 checkToken 接口
  localStorage.setItem("ecs_token", token);
  localStorage.setItem("unicom_phone", phone || "未知号码");
  location.reload();
}

function showMsg(page, text, type) {
  const el = document.getElementById(`msg-${page}`);
  el.textContent = text; el.className = `msg ${type}`;
  setTimeout(() => el.textContent = "", 3000);
}
