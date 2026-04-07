const S = {
  phone: '',
  token: '',
  smsStep: 'send',
  countdown: 0,
  timer: null
};

function id(x) {
  return document.getElementById(x);
}

function show(el, visible) {
  const node = typeof el === 'string' ? id(el) : el;
  if (!node) return;
  node.style.display = visible ? '' : 'none';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function fmtFlow(mb) {
  mb = Number(mb || 0);
  if (Math.abs(mb) >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
  if (Math.abs(mb) >= 1024) return (mb / 1024).toFixed(2) + ' GB';
  return mb.toFixed(0) + ' MB';
}

function parseMB(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;

  const str = String(v).trim().toUpperCase();
  const num = parseFloat(str.replace(/[^0-9.\-]/g, ''));
  if (Number.isNaN(num)) return null;

  if (str.includes('TB')) return num * 1024 * 1024;
  if (str.includes('GB')) return num * 1024;
  if (str.includes('MB')) return num;
  if (str.includes('KB')) return num / 1024;

  return num;
}

function progressColor(pct) {
  if (pct > 85) return '#dc2626';
  if (pct > 60) return '#d97706';
  return '#2563eb';
}

async function api(url, body) {
  const resp = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(S.token ? { Authorization: `Bearer ${S.token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.message || `请求失败: ${resp.status}`);
  }
  if (data?.success === false || data?.code === 1) {
    throw new Error(data?.message || '接口返回失败');
  }
  return data;
}

/* ===== 登录成功后加载 ===== */
function onLoginSuccess() {
  show('page-login', false);
  show('page-dash', true);
  show('header-user', true);
  if (id('header-phone')) {
    id('header-phone').textContent = S.phone || '已登录';
  }
  loadAll();
}

/* ===== 退出 ===== */
function logout() {
  Object.assign(S, { phone: '', token: '', smsStep: 'send', countdown: 0 });
  clearInterval(S.timer);
  show('page-login', true);
  show('page-dash', false);
  show('header-user', false);
}

/* ===== 数据加载 ===== */
function loadAll() {
  loadFlow();
  // 你原来如果还有 loadSpeed / loadBiz，可继续保留
  if (typeof loadSpeed === 'function') loadSpeed();
  if (typeof loadBiz === 'function') loadBiz();
}

async function refreshAll() {
  const btn = id('btn-refresh');
  if (btn) btn.classList.add('spinning');
  if (id('pkg-list')) {
    id('pkg-list').innerHTML = '<div class="loading-row">刷新中...</div>';
  }
  try {
    await loadFlow();
    if (typeof loadSpeed === 'function') await loadSpeed();
    if (typeof loadBiz === 'function') await loadBiz();
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

/* ===== 顶部卡片 ===== */
function setSummaryProgress(sumLeft, sumUsed, sumTotal) {
  const sumPct = sumTotal > 0 ? Math.round(sumUsed / sumTotal * 100) : 0;
  const remainPct = sumTotal > 0 ? Math.round(sumLeft / sumTotal * 100) : 0;
  const color = progressColor(sumPct);

  if (id('s-remain')) id('s-remain').textContent = fmtFlow(sumLeft);
  if (id('s-used')) id('s-used').textContent = fmtFlow(sumUsed);
  if (id('s-total')) id('s-total').textContent = fmtFlow(sumTotal);
  if (id('s-pct')) id('s-pct').textContent = `${sumPct}%`;

  if (id('s-remain-bar')) id('s-remain-bar').style.width = `${Math.max(0, Math.min(remainPct, 100))}%`;
  if (id('s-used-bar')) id('s-used-bar').style.width = `${Math.max(0, Math.min(sumPct, 100))}%`;
  if (id('s-total-bar')) id('s-total-bar').style.width = sumTotal > 0 ? '100%' : '0%';

  if (id('s-pct-bar')) {
    id('s-pct-bar').style.width = `${Math.max(0, Math.min(sumPct, 100))}%`;
    id('s-pct-bar').style.background = color;
  }

  if (id('bar-used-lbl')) id('bar-used-lbl').textContent = `已用 ${fmtFlow(sumUsed)}`;
  if (id('bar-total-lbl')) id('bar-total-lbl').textContent = `共 ${fmtFlow(sumTotal)}`;

  if (id('main-bar')) {
    id('main-bar').style.width = `${Math.max(0, Math.min(sumPct, 100))}%`;
    id('main-bar').style.background = color;
  }
}

/* ===== 套餐项渲染 ===== */
function renderPkgItem(d) {
  const name = d.feePolicyName || d.feeName || d.name || '未命名流量包';
  const endDate = d.endDate || '长期有效';

  const total = parseMB(d.total ?? d.xcanusevalue ?? d.canUseValue);
  const used = parseMB(d.use ?? d.xusedvalue ?? d.usedValue) ?? 0;
  const remain = parseMB(d.remain ?? d.xremainvalue ?? d.remainValue);

  const flowType = String(d.flowType ?? d.flowtype ?? '');
  const isDirected = flowType === '2';

  if (isDirected && (!total || total <= 0)) {
    return `
      <div class="pkg-item">
        <div class="pkg-left">
          <div class="pkg-name">${esc(name)}</div>
          <div class="pkg-expire">${esc(endDate)}</div>
        </div>
        <div class="pkg-right">
          <div class="pkg-remain">${fmtFlow(used)}</div>
          <div class="pkg-of">已用 / 无上限</div>
          <span class="pkg-pct blue">免流</span>
        </div>
      </div>
    `;
  }

  const totalVal = total ?? 0;
  const remainVal = remain ?? Math.max(totalVal - used, 0);
  const pct = totalVal > 0 ? Math.round(used / totalVal * 100) : 0;
  const safePct = Math.max(0, Math.min(pct, 100));
  const color = progressColor(safePct);
  const tagClass = safePct >= 100 ? 'red' : 'green';

  return `
    <div class="pkg-item">
      <div class="pkg-left">
        <div class="pkg-name">${esc(name)}</div>
        <div class="pkg-expire">${esc(endDate)}</div>
        <div class="mini-bar-bg">
          <div class="mini-bar" style="width:${safePct}%;background:${color};height:100%;border-radius:999px;"></div>
        </div>
      </div>
      <div class="pkg-right">
        <div class="pkg-remain">${fmtFlow(remainVal)}</div>
        <div class="pkg-of">/ ${fmtFlow(totalVal)}</div>
        <span class="pkg-pct ${tagClass}">已用 ${safePct}%</span>
      </div>
    </div>
  `;
}

/* ===== 流量查询 ===== */
async function loadFlow() {
  try {
    const raw = await api('/flow');

    const flowResource = (raw.resources || []).find(r => r.type === 'flow');
    const details = flowResource?.details || [];

    const sumList = raw.flowSumList || raw.fresSumList || [];
    const generalSum = sumList.find(s =>
      s.flowtype === '1' || (s.elemtype === '3' && s.flowtype === '1')
    );

    const sumTotal = parseMB(generalSum?.xcanusevalue) ?? 0;
    const sumUsed = parseMB(generalSum?.xusedvalue) ?? 0;
    const sumLeft = Math.max(parseMB(generalSum?.xremainvalue) ?? (sumTotal - sumUsed), 0);

    setSummaryProgress(sumLeft, sumUsed, sumTotal);

    const general = details.filter(d => String(d.flowType ?? d.flowtype ?? '') === '1' && !d.hide);
    const directed = details.filter(d => String(d.flowType ?? d.flowtype ?? '') === '2' && !d.hide);

    let html = '';

    if (general.length) {
      html += `<div class="flow-section-title">通用流量</div>`;
      html += general.map(renderPkgItem).join('');
    }

    if (directed.length) {
      html += `<div class="flow-section-title">定向流量</div>`;
      html += directed.map(renderPkgItem).join('');
    }

    id('pkg-list').innerHTML = html || '<div class="empty-tip">暂无流量包明细</div>';
  } catch (e) {
    if (id('pkg-list')) {
      id('pkg-list').innerHTML = `<div class="empty-tip">流量查询失败：${esc(e.message)}</div>`;
    }
  }
}

/* ===== 页面初始化 ===== */
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = id('btn-refresh');
  const logoutBtn = id('btn-logout');

  if (refreshBtn) refreshBtn.addEventListener('click', refreshAll);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  // 如果你项目里已有 token，就直接加载
  loadAll();
});