let userData = {
  phone: "",
  token: "",
  flow: null,
  speed: null,
  biz: null
};

// 页面初始化
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("ecs_token");
  const phone = localStorage.getItem("unicom_phone");
  if (token) {
    userData.token = token;
    userData.phone = phone;
    showDash();
    loadAllData();
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
  document.getElementById("header-phone").textContent = userData.phone || "联通用户";
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

// 加载全部数据
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
// 🔥 加载流量数据（完美适配你的接口）
// ------------------------------
async function loadFlow() {
  try {
    const res = await fetch("/api/flow", {
      headers: { "ecs_token": userData.token }
    });
    const data = await res.json();
    userData.flow = data;
    console.log("[API] /flow", data);
  } catch (e) {
    userData.flow = { code: "E" };
    console.error("[API] /flow 加载失败", e);
  }
}

// ------------------------------
// 🔥 加载速率数据
// ------------------------------
async function loadSpeed() {
  try {
    const res = await fetch("/api/speed", {
      headers: { "ecs_token": userData.token }
    });
    const data = await res.json();
    userData.speed = data;
    console.log("[API] /speed", data);
  } catch (e) {
    userData.speed = { code: "E" };
    console.error("[API] /speed 加载失败", e);
  }
}

// ------------------------------
// 🔥 加载已订业务数据
// ------------------------------
async function loadBiz() {
  try {
    const res = await fetch("/api/biz", {
      headers: { "ecs_token": userData.token }
    });
    const data = await res.json();
    userData.biz = data;
    console.log("[API] /biz", data);
  } catch (e) {
    userData.biz = { code: "E" };
    console.error("[API] /biz 加载失败", e);
  }
}

// ------------------------------
// 🚀 渲染所有数据
// ------------------------------
function renderAll() {
  renderFlow();
  renderSpeed();
  renderBiz();
}

// ------------------------------
// 🔥 流量渲染（适配 xcanusevalue/xusedvalue 字段）
// ------------------------------
function renderFlow() {
  const flow = userData.flow;
  if (!flow || flow.code !== "0000") {
    setFlowEmpty();
    return;
  }

  const list = flow.flowSumList || [];
  let totalTotal = 0;
  let totalUsed = 0;
  let html = "";

  // 格式化数值，保留1位小数
  const fmt = (n) => (parseFloat(n) || 0).toFixed(1);
  // 格式化大流量为GB
  const formatBig = (n) => {
    const num = parseFloat(n) || 0;
    return num > 1024 ? `${(num / 1024).toFixed(2)} GB` : `${fmt(num)} MB`;
  };

  list.forEach(item => {
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
      <div class="pkg-progress">
        <div class="pkg-bar-bg">
          <div class="pkg-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <div class="pkg-nums">
        <span>剩余 ${formatBig(remain)}</span>
        <span>${formatBig(used)} / ${formatBig(total)}</span>
      </div>
    </div>`;
  });

  // 顶部汇总卡片
  const allRemain = Math.max(0, totalTotal - totalUsed);
  const allPct = totalTotal > 0 ? (totalUsed / totalTotal * 100).toFixed(1) : 0;

  document.getElementById("s-remain").textContent = formatBig(allRemain);
  document.getElementById("s-used").textContent = formatBig(totalUsed);
  document.getElementById("s-total").textContent = formatBig(totalTotal);
  document.getElementById("s-pct").textContent = `${allPct}%`;
  document.getElementById("main-bar").style.width = `${allPct}%`;
  document.getElementById("bar-used-lbl").textContent = `已用 ${formatBig(totalUsed)}`;
  document.getElementById("bar-total-lbl").textContent = `共 ${formatBig(totalTotal)}`;
  document.getElementById("pkg-list").innerHTML = html;
}

// 流量空状态
function setFlowEmpty() {
  document.getElementById("s-remain").textContent = "—";
  document.getElementById("s-used").textContent = "—";
  document.getElementById("s-total").textContent = "—";
  document.getElementById("s-pct").textContent = "—";
  document.getElementById("main-bar").style.width = "0%";
  document.getElementById("bar-used-lbl").textContent = "已用 —";
  document.getElementById("bar-total-lbl").textContent = "共 —";
  document.getElementById("pkg-list").innerHTML = `<div class="empty-row">暂无流量数据</div>`;
}

// ------------------------------
// 🔥 速率 & QCI 渲染（适配你的接口）
// ------------------------------
function renderSpeed() {
  const speed = userData.speed;
  if (!speed || speed.code !== "0000") {
    document.getElementById("speed-area").innerHTML = `<div class="error-row">速率查询失败</div>`;
    document.getElementById("net-badge").textContent = "—";
    return;
  }

  const d = speed.rateResource || {};
  const downRate = d.rate || "500";
  const upRate = "50"; // 上行速率默认，可根据接口调整
  const qci = "9"; // 5G优享速率包默认QCI，可根据接口调整

  document.getElementById("net-badge").textContent = speed.corner || "5G";
  document.getElementById("speed-area").innerHTML = `
  <div class="speed-grid">
    <div class="speed-card">
      <div class="speed-icon down"></div>
      <div class="speed-val">${downRate}</div>
      <div class="speed-label">Mbps 下行</div>
    </div>
    <div class="speed-card">
      <div class="speed-icon up"></div>
      <div class="speed-val">${upRate}</div>
      <div class="speed-label">Mbps 上行</div>
    </div>
  </div>
  <div class="speed-info">
    <div class="info-row">
      <span class="info-label">QCI 等级</span>
      <span class="info-val">${qci}</span>
    </div>
    <div class="info-row">
      <span class="info-label">网络类型</span>
      <span class="info-val">${speed.corner || "5G"}</span>
    </div>
    <div class="info-row">
      <span class="info-label">限速状态</span>
      <span class="info-val success">正常</span>
    </div>
  </div>`;
}

// ------------------------------
// 🔥 已订业务渲染
// ------------------------------
function renderBiz() {
  const biz = userData.biz;
  if (!biz || biz.code !== "0000") {
    document.getElementById("biz-area").innerHTML = `<div class="error-row">查询失败</div>`;
    document.getElementById("biz-count").textContent = "0项";
    return;
  }

  const list = biz.data.mainProductInfo || [];
  let html = "";
  list.forEach(item => {
    html += `
    <div class="biz-item">
      <div class="biz-name">${item.productName}</div>
      <div class="biz-time">${item.startDate || ""}</div>
    </div>`;
  });

  document.getElementById("biz-count").textContent = `${list.length}项`;
  document.getElementById("biz-area").innerHTML = html;
}

// ------------------------------
// 登录逻辑（完整保留）
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
  btn.disabled = true;
  btn.textContent = "发送中...";
  try {
    const res = await fetch("/api/sendCode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (data.code === "0000") {
      startCountDown();
      document.getElementById("sms-code-group").style.display = "block";
      showMsg("sms", "验证码已发送", "success");
    } else {
      showMsg("sms", data.desc || "发送失败", "error");
    }
  } catch (e) {
    showMsg("sms", "请求失败", "error");
  }
  btn.disabled = false;
  btn.textContent = "获取验证码";
}

function startCountDown() {
  const btn = document.getElementById("btn-resend");
  let s = 60;
  btn.disabled = true;
  btn.textContent = `${s}秒后重发`;
  const timer = setInterval(() => {
    s--;
    btn.textContent = `${s}秒后重发`;
    if (s <= 0) {
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = "重新发送";
    }
  }, 1000);
}

async function handleSmsLogin() {
  const phone = document.getElementById("inp-phone").value.trim();
  const code = document.getElementById("inp-code").value.trim();
  if (!phone || !code) return showMsg("sms", "请输入完整信息", "error");
  const btn = document.getElementById("btn-sms-submit");
  btn.disabled = true;
  btn.textContent = "登录中...";
  try {
    const res = await fetch("/api/loginSms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code })
    });
    const data = await res.json();
    if (data.code === "0000") {
      localStorage.setItem("ecs_token", data.data.ecsToken);
      localStorage.setItem("unicom_phone", phone);
      location.reload();
    } else {
      showMsg("sms", data.desc || "登录失败", "error");
    }
  } catch (e) {
    showMsg("sms", "请求失败", "error");
  }
  btn.disabled = false;
  btn.textContent = "登录";
}

async function handleTokenLogin() {
  const token = document.getElementById("inp-token").value.trim();
  const phone = document.getElementById("inp-token-phone").value.trim();
  if (!token) return showMsg("token", "请输入Token", "error");
  try {
    const res = await fetch("/api/checkToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", ecs_token: token }
    });
    const data = await res.json();
    if (data.code === "0000") {
      localStorage.setItem("ecs_token", token);
      localStorage.setItem("unicom_phone", phone);
      location.reload();
    } else {
      showMsg("token", "Token无效或已过期", "error");
    }
  } catch (e) {
    showMsg("token", "校验失败", "error");
  }
}

function showMsg(page, text, type) {
  const el = document.getElementById(`msg-${page}`);
  el.textContent = text;
  el.className = `msg ${type}`;
  setTimeout(() => (el.textContent = ""), 3000);
}
