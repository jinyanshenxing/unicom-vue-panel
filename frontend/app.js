function id(x) {
  return document.getElementById(x);
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
  const n = Number(mb || 0);
  if (!isFinite(n)) return '0 MB';
  if (n >= 1024) {
    const gb = n / 1024;
    return gb >= 100 ? gb.toFixed(0) + ' GB' : gb.toFixed(2) + ' GB';
  }
  return n >= 100 ? n.toFixed(0) + ' MB' : n.toFixed(2) + ' MB';
}

function fmtVoice(min) {
  const n = Number(min || 0);
  if (!isFinite(n) || n <= 0) return '0分钟';
  if (n >= 60) {
    const h = Math.floor(n / 60);
    const m = n % 60;
    return m ? `${h}小时${m}分钟` : `${h}小时`;
  }
  return `${n}分钟`;
}

function parseMB(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim().toUpperCase();
  const num = parseFloat(s.replace(/[^\d.-]/g, ''));
  if (!isFinite(num)) return 0;
  if (s.includes('GB') || s.endsWith('G')) return num * 1024;
  if (s.includes('KB') || s.endsWith('K')) return num / 1024;
  return num;
}

function setBar(el, pct) {
  if (!el) return;
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  el.style.width = p + '%';
  el.style.background = p >= 85 ? '#dc2626' : p > 60 ? '#d97706' : '#2563eb';
}

async function api(url, options = {}) {
  const token = localStorage.getItem('ecs_token') || '';
  const mobile = localStorage.getItem('mobile_display') || '';

  const headers = Object.assign({}, options.headers || {}, {
    'Content-Type': 'application/json',
    'x-ecs-token': token,
    'x-mobile': mobile
  });

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return await res.json();
}

function row(label, value) {
  return `<div class="info-row"><span>${label}</span><span>${value}</span></div>`;
}

function showDash() {
  id('login-card').style.display = 'none';
  id('dash').style.display = 'block';

  const mobile = localStorage.getItem('mobile_display') || '';
  if (mobile) {
    id('phone-tag').textContent = mobile;
    id('phone-tag').style.display = 'inline-flex';
  }
}

function showLogin() {
  id('login-card').style.display = 'block';
  id('dash').style.display = 'none';
  id('phone-tag').style.display = 'none';
}

async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
    renderVoice(data);
  } catch (e) {
    id('pkg-list').innerHTML = `<div class="error-tip">流量查询失败：${esc(e.message)}</div>`;
  }
}

function renderFlow(raw) {
  const flowResource = (raw.resources || []).find(r => r.type === 'flow');
  const details = flowResource?.details || [];

  const sumList = raw.flowSumList || raw.fresSumList || [];
  const generalSum = sumList.find(s => s.flowtype === '1' || (s.elemtype === '3' && s.flowtype === '1'));

  const sumTotal = parseMB(generalSum?.xcanusevalue || generalSum?.total || 0);
  const sumUsed = parseMB(generalSum?.xusedvalue || generalSum?.use || 0);
  const sumRemain = Math.max(0, parseMB(generalSum?.xremainvalue || generalSum?.remain || (sumTotal - sumUsed)));
  const sumPct = sumTotal > 0 ? Math.round(sumUsed / sumTotal * 100) : 0;

  id('s-remain').textContent = fmtFlow(sumRemain);
  id('s-used').textContent = fmtFlow(sumUsed);
  id('s-total').textContent = fmtFlow(sumTotal);
  id('s-pct').textContent = sumPct + '%';

  id('main-used-label').textContent = '已用 ' + fmtFlow(sumUsed);
  id('main-total-label').textContent = '共 ' + fmtFlow(sumTotal);
  setBar(id('main-bar'), sumPct);

  const html = details
    .filter(item => item.hide !== '1')
    .map(item => {
      const name = item.feePolicyName || item.name || item.productName || '未命名套餐';
      return `
        <div class="pkg-item simple-pkg-item">
          <div class="pkg-name">${esc(name)}</div>
        </div>
      `;
    })
    .join('');

  id('pkg-list').innerHTML = html || `<div class="error-tip">暂无流量套餐信息</div>`;
}

function renderVoice(raw) {
  const list =
    raw.voiceSumList ||
    raw.callSumList ||
    raw.telSumList ||
    raw.voiceList ||
    [];

  const item = Array.isArray(list) ? (list[0] || {}) : {};
  const total = Number(item.canUseValue || item.total || item.xcanusevalue || 0);
  const used = Number(item.usedValue || item.use || item.xusedvalue || 0);
  const remain = Math.max(0, Number(item.remain || item.xremainvalue || (total - used) || 0));
  const pct = total > 0 ? Math.round(used / total * 100) : 0;

  id('v-remain').textContent = fmtVoice(remain);
  id('v-used').textContent = fmtVoice(used);
  id('v-total').textContent = fmtVoice(total);
  id('v-pct').textContent = pct + '%';

  id('voice-used-label').textContent = '已用 ' + fmtVoice(used);
  id('voice-total-label').textContent = '共 ' + fmtVoice(total);
  setBar(id('voice-bar'), pct);
}

async function loadSpeed() {
  try {
    const data = await api('/speed');

    const down = data?.rateResource?.rate || data?.down || '—';
    const up = data?.up || '—';
    const pkgName = data?.pkgName || data?.productName || '';
    const netType = data?.terminalResource?.terminal || data?.netType || '—';
    const has5G = data?.networkSwitchResource?.state === '1';
    const usedGB = parseFloat(data?.flowResource?.flowPersent || 0) || 0;
    const mobile = localStorage.getItem('mobile_display') || '';
    const isWarn = !!data?.isWarn;

    id('speed-area').innerHTML = `
      <div class="speed-pair">
        <div class="speed-block">
          <div class="speed-icon dl">↓</div>
          <div>
            <div class="speed-val">${esc(down)}</div>
            <div class="speed-unit">Mbps 峰值下行</div>
          </div>
        </div>
        <div class="speed-block">
          <div class="speed-icon ul">↑</div>
          <div>
            <div class="speed-val">${esc(up)}</div>
            <div class="speed-unit">Mbps 上行</div>
          </div>
        </div>
      </div>

      <div class="info-rows">
        ${pkgName ? row('当前套餐', esc(pkgName)) : ''}
        ${row('终端类型', esc(netType))}
        ${row('5G 覆盖', has5G ? '<span class="pkg-pct green">已覆盖</span>' : '<span class="pkg-pct amber">未检测</span>')}
        ${row('限速状态', isWarn ? '<span class="pkg-pct amber">已限速</span>' : '<span class="pkg-pct green">正常</span>')}
        ${usedGB > 0 ? row('当月总用量', usedGB.toFixed(2) + ' GB') : ''}
        ${mobile ? row('号码', esc(mobile)) : ''}
      </div>
    `;
  } catch (e) {
    id('speed-area').innerHTML = `<div class="error-tip">速率查询失败：${esc(e.message)}</div>`;
  }
}

async function loadBiz() {
  try {
    const raw = await api('/biz');
    renderBiz(raw);
  } catch (e) {
    id('biz-area').innerHTML = `<div class="error-tip">业务查询失败：${esc(e.message)}</div>`;
  }
}

function renderBiz(raw) {
  const d = raw.data || raw.result?.data || {};
  const main = Array.isArray(d.mainProductInfo) ? d.mainProductInfo : [];
  const other = Array.isArray(d.otherProductInfo) ? d.otherProductInfo : [];

  const items = [...main, ...other.filter(x => x.isSubprodInfo !== 'true')];

  const statusMap = {
    '0': '正常',
    '1': '已退订',
    '4': '待生效'
  };

  const html = items.map(item => {
    const name = item.productName || item.prodName || '未命名业务';
    const st = statusMap[item.cancelFlag] || '';
    return `
      <div class="biz-item">
        <div class="biz-name">${esc(name)}</div>
        <div class="biz-status">${esc(st)}</div>
      </div>
    `;
  }).join('');

  id('biz-area').innerHTML = html || `<div class="error-tip">暂无已订业务</div>`;
}

function initBizCollapse() {
  const btn = id('biz-toggle');
  const wrap = id('biz-wrap');
  const arrow = id('biz-arrow');

  btn.addEventListener('click', () => {
    const opened = wrap.style.display !== 'none';
    wrap.style.display = opened ? 'none' : 'block';
    arrow.textContent = opened ? '▼' : '▲';
  });
}

function bindEvents() {
  id('btn-refresh-flow').addEventListener('click', loadFlow);

  id('btn-login').addEventListener('click', async () => {
    const token = id('ecs-token').value.trim();
    const mobileDisplay = id('mobile-display').value.trim();

    if (!token) {
      alert('请填写 ECS Token');
      return;
    }

    localStorage.setItem('ecs_token', token);
    localStorage.setItem('mobile_display', mobileDisplay);

    showDash();
    await Promise.allSettled([loadFlow(), loadSpeed(), loadBiz()]);
  });

  id('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('ecs_token');
    localStorage.removeItem('mobile_display');
    location.reload();
  });

  id('btn-send-code').addEventListener('click', () => {
    alert('当前示例版未接入短信登录接口，请使用 ECS Token 登录');
  });
}

async function init() {
  bindEvents();
  initBizCollapse();

  const token = localStorage.getItem('ecs_token');
  if (token) {
    showDash();
    await Promise.allSettled([loadFlow(), loadSpeed(), loadBiz()]);
  } else {
    showLogin();
  }
}

init();