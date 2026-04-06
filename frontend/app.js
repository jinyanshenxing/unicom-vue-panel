let userData = {
  phone: "",
  token: "",
  flow: null
};

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

function showLogin() {
  document.getElementById("page-login").style.display = "flex";
  document.getElementById("page-dash").style.display = "none";
  document.getElementById("header-user").style.display = "none";
}

function showDash() {
  document.getElementById("page-login").style.display = "none";
  document.getElementById("page-dash").style.display = "block";
  document.getElementById("header-user").style.display = "flex";
  document.getElementById("header-phone").textContent = userData.phone || "联通用户";
}

function logout() {
  localStorage.removeItem("ecs_token");
  localStorage.removeItem("unicom_phone");
  location.reload();
}

function refreshAll() {
  loadAllData();
}

async function loadAllData() {
  showLoading();
  await loadFlow();
  renderAll();
}

function showLoading() {
  document.getElementById("pkg-list").innerHTML = `<div class="loading-row"><div class="spinner"></div>加载中...</div>`;
  document.getElementById("speed-area").innerHTML = `<div class="empty-row">查询关闭</div>`;
  document.getElementById("biz-area").innerHTML = `<div class="empty-row">查询关闭</div>`;
}

// ------------------------------
// 加载流量（完美适配你的接口）
// ------------------------------
async function loadFlow() {
  try {
    const res = await fetch("/api/flow", {
      headers: { ecs_token: userData.token }
    });
    const data = await res.json();
    userData.flow = data;
  } catch (e) {
    userData.flow = { code: "E" };
  }
}

// ------------------------------
// 渲染全部
// ------------------------------
function renderAll() {
  renderFlow();
}

// ------------------------------
// 渲染流量（100% 匹配你的页面）
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

  list.forEach(item => {
    const total = parseFloat(item.xcanusevalue || 0);
    const used = parseFloat(item.xusedvalue || 0);
    const remain = total - used;
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
        <span>剩余 ${remain.toFixed(1)} MB</span>
        <span>${used.toFixed(1)} / ${total.toFixed(1)} MB</span>
      </div>
    </div>`;
  });

  const allRemain = totalTotal - totalUsed;
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

// ------------------------------
// 登录逻辑
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
  btn.disabled = false; btn.textContent = "获取验证码";
}

function startCountDown() {
  const btn = document.getElementById("btn-resend");
  let s = 60;
  btn.disabled = true; btn.textContent = `${s}秒后重发`;
  const timer = setInterval(() => {
    s--; btn.textContent = `${s}秒后重发`;
    if (s <= 0) { clearInterval(timer); btn.disabled = false; btn.textContent = "重新发送"; }
  }, 1000);
}

async function handleSmsLogin() {
  const phone = document.getElementById("inp-phone").value.trim();
  const code = document.getElementById("inp-code").value.trim();
  if (!phone || !code) return showMsg("sms", "请输入完整信息", "error");
  const btn = document.getElementById("btn-sms-submit");
  btn.disabled = true; btn.textContent = "登录中...";
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
  btn.disabled = false; btn.textContent = "登录";
}

async function handleTokenLogin() {
  const token = document.getElementById("inp-token").value.trim();
  const phone = document.getElementById("inp-token-phone").value.trim();
  if (!token) return showMsg("token", "请输入Token", "error");
  try {
    const res = await fetch("/api/checkToken", {
      method: "POST",
      headers: { ecs_token: token }
    });
    const data = await res.json();
    if (data.code === "0000") {
      localStorage.setItem("ecs_token", token);
      localStorage.setItem("unicom_phone", phone);
      location.reload();
    } else {
      showMsg("token", "Token无效", "error");
    }
  } catch (e) {
    showMsg("token", "校验失败", "error");
  }
}

function showMsg(page, text, type) {
  const el = document.getElementById(`msg-${page}`);
  el.textContent = text; el.className = `msg ${type}`;
  setTimeout(() => el.textContent = "", 3000);
}
