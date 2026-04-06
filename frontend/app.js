'use strict';

/* ===== State ===== */
const S = {
  phone: '',
  token: '',
  smsStep: 'send',
  countdown: 0,
  timer: null,
  bizList: []
};

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

  if (!res.ok || (data.code && !['0000', '200', 200, '1000', 'success', 'SUCCESS'].includes(data.code))) {
    throw new Error(data.message || data.resultMessage || data.msg || `请求失败 (${res.status})`);
  }

  return data;
}

/* ===== Base Helpers ===== */
const id = i => document.getElementById(i);
const val = i => (id(i)?.value || '').trim();

const esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const row = (k, v) => `<div class="info-row"><span class="info-key">${k}</span><span class="info-val">${v}</span></div>`;

const numOf = v => (v !== undefined && v !== null && v !== '') ? (parseFloat(v) || 0) : 0;

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function dig(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;

  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }

  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      const found = dig(v, ...keys);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

function findArray(obj, ...preferKeys) {
  if (!obj || typeof obj !== 'object') return [];

  for (const k of preferKeys) {
    if (Array.isArray(obj[k]) && typeof obj[k][0] === 'object') return obj[k];
  }

  for (const [, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v;
  }

  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = findArray(v, ...preferKeys);
      if (found.length) return found;
    }
  }

  return [];
}

function uniqBy(arr, getKey) {
  const m = new Map();
  arr.forEach(item => {
    const key = getKey(item);
    if (!m.has(key)) m.set(key, item);
  });
  return [...m.values()];
}

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

function fmtFlow(mb) {
  if (mb === undefined || mb === null || isNaN(mb)) return '—';
  if (mb >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
  return mb.toFixed(2).replace(/\.00$/, '') + ' MB';
}

function fmtNumber(v) {
  if (v === undefined || v === null || v === '') return '—';
  const n = parseFloat(v);
  return Number.isFinite(n) ? String(n) : String(v);
}

function colorByPercent(percent) {
  if (percent >= 100) return '#111827';
  if (percent > 85) return '#ef4444';
  if (percent > 60) return '#f59e0b';
  return '#2563eb';
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
  el._t = setTimeout(() => {
    el.textContent = '';
    el.className = 'msg';
  }, 5000);
}

function extractPriceFromName(name) {
  const s = String(name || '');
  const m = s.match(/(\d+(?:\.\d+)?)元/);
  return m ? m[1] : '';
}

function pickBizList(data) {
  if (Array.isArray(data?.mainProductInfo)) return data.mainProductInfo;
  if (Array.isArray(data?.data?.mainProductInfo)) return data.data.mainProductInfo;
  return findArray(
    data,
    'mainProductInfo',
    'list',
    'orderList',
    'serviceList',
    'bizList',
    'items',
    'records',
    'productList'
  );
}

/* ===== Flow Package Parsing ===== */
function collectFlowPackages(obj, arr = []) {
  if (!obj || typeof obj !== 'object') return arr;

  const candidateArrays = [
    'flowSumList',
    'XsBResources',
    'details',
    'resources',
    'list',
    'items'
  ];

  for (const key of candidateArrays) {
    if (Array.isArray(obj[key])) {
      obj[key].forEach((item, idx) => {
        if (item && typeof item === 'object') {
          arr.push({
            ...item,
            __source: key,
            __index: idx
          });

          collectFlowPackages(item, arr);
        }
      });
    }
  }

  return arr;
}

function matchBizName(flowName) {
  if (!S.bizList || !S.bizList.length) return '';

  const direct = S.bizList.find(b => {
    const name = firstNonEmpty(b.productName, b.name, b.serviceName, b.offerName, '');
    return name && flowName && (flowName.includes(name) || name.includes(flowName));
  });
  if (direct) return firstNonEmpty(direct.productName, direct.name, direct.serviceName, direct.offerName, '');

  return '';
}

function normalizeUnicomFlowItem(p, idx = 0) {
  let left = parseMB(firstNonEmpty(
    p.xcanusevalue,
    p.canusevalue,
    p.leftFlow,
    p.remainFlow,
    p.left,
    p.remainSize,
    p.surplusFlow,
    p.balance
  ));

  let used = parseMB(firstNonEmpty(
    p.xusedvalue,
    p.usedFlow,
    p.used,
    p.usedSize,
    p.useFlow,
    p.usedTraffic,
    p.usedAmount
  ));

  let total = parseMB(firstNonEmpty(
    p.xtotalvalue,
    p.total,
    p.packageFlow,
    p.flowSize,
    p.totalFlow,
    p.totalSize,
    p.allSize
  ));

  if (!total && (left || used)) total = left + used;
  if (!left && total && used) left = Math.max(total - used, 0);

  let name = firstNonEmpty(
    p.feePolicyName,
    p.feePolicyTypeName,
    p.packageName,
    p.name,
    p.productName,
    p.offerName,
    p.pkgName,
    p.resourceName,
    p.policyName
  );

  if (!name) {
    if (p.__source === 'flowSumList') name = idx === 0 ? '套餐总流量' : `套餐流量${idx + 1}`;
    else if (p.__source === 'XsBResources') name = `专属流量包${idx + 1}`;
    else if (p.__source === 'details') name = `流量包${idx + 1}`;
    else name = `流量包${idx + 1}`;
  }

  const bizMatchedName = matchBizName(name);
  if (!/总流量|专属流量包|流量包\d+/.test(name) && bizMatchedName) {
    name = bizMatchedName;
  }

  const percent = total > 0 ? Math.round((used / total) * 10000) / 100 : 0;
  const textName = String(name || '');

  return {
    name,
    used,
    left,
    total,
    percent,
    source: p.__source || '',
    unlimited: /无限|不限量/.test(textName),
    exclusive: /专属|定向|免流|头条|腾讯|百度|抖音|快手|爱奇艺|优酷/.test(textName) || p.__source === 'XsBResources',
    voice: /语音|分钟|通话/.test(textName),
    shared: !(/专属|定向|免流/.test(textName) || p.__source === 'XsBResources'),
    raw: p
  };
}

function renderFlowTags(item) {
  const tags = [];

  if (item.voice) {
    tags.push('<span class="flow-tag gray">语音</span>');
  } else if (item.exclusive) {
    tags.push('<span class="flow-tag green">专属</span>');
  } else {
    tags.push('<span class="flow-tag gray">通用</span>');
  }

  tags.push(`<span class="flow-tag ${item.shared ? 'gray' : 'slate'}">${item.shared ? '共享' : '非共享'}</span>`);
  tags.push(`<span class="flow-tag ${item.unlimited ? 'yellow' : 'gray'}">${item.unlimited ? '无限量' : '有上限'}</span>`);

  return tags.join('');
}

function renderFlowCard(item, compact = false) {
  const icon = item.voice ? '☎' : '≋';
  const barBg = item.unlimited
    ? 'linear-gradient(90deg,#8b5cf6,#ef4444,#f59e0b,#84cc16,#06b6d4,#6366f1)'
    : colorByPercent(item.percent);

  return `
    <div class="flow-card ${compact ? 'compact' : ''}">
      <div class="flow-card-head">
        <div class="flow-card-title">${esc(item.name)}</div>
        <div class="flow-card-icon">${icon}</div>
      </div>

      <div class="flow-card-value">${esc(fmtFlow(item.used))}</div>

      <div class="flow-card-sub">
        <div>总：${esc(item.unlimited ? '∞' : fmtFlow(item.total))}</div>
        <div>剩：${esc(fmtFlow(item.left))}</div>
      </div>

      <div class="flow-card-tags">
        ${renderFlowTags(item)}
      </div>

      <div class="flow-card-foot">
        <span>总量</span>
        <span>${item.unlimited ? '无限量' : `${item.percent.toFixed(2)}%`}</span>
      </div>

      <div class="flow-card-bar-bg">
        <div class="flow-card-bar" style="width:${item.unlimited ? 100 : Math.min(item.percent, 100)}%;background:${barBg}"></div>
      </div>
    </div>
  `;
}

function toggleMoreFlows(btn) {
  const box = id('more-flow-list');
  if (!box) return;
  const hidden = box.classList.toggle('collapsed');
  btn.textContent = hidden ? '展开' : '收起';
}
window.toggleMoreFlows = toggleMoreFlows;

/* ===== Login ===== */
function switchLoginTab(type, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  show('login-sms', type === 'sms');
  show('login-token', type === 'token');
}
window.switchLoginTab = switchLoginTab;

async function handleSmsLogin() {
  const phone = val('inp-phone');
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showMsg('msg-sms', '请输入有效的联通手机号', 'err');
    return;
  }

  S.phone = phone;

  if (S.smsStep === 'send') {
    const btn = id('btn-sms-submit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '发送中...';
    }

    try {
      await api('/send-sms');
      showMsg('msg-sms', '验证码已发送，请注意查收', 'ok');
      show('sms-code-group', true);
      if (btn) btn.textContent = '登 录';
      S.smsStep = 'verify';
      startCountdown();
    } catch (e) {
      showMsg('msg-sms', e.message, 'err');
      if (btn) btn.textContent = '获取验证码';
    }

    if (btn) btn.disabled = false;
    return;
  }

  const code = val('inp-code');
  if (!code) {
    showMsg('msg-sms', '请输入验证码', 'err');
    return;
  }

  const btn = id('btn-sms-submit');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '登录中...';
  }

  try {
    const data = await api('/login-sms', { randomNum: code });
    S.token =
      data.token ||
      data.ecs_token ||
      data.accessToken ||
      data.result?.token ||
      data.result?.ecs_token ||
      data.data?.token ||
      data.data?.ecs_token ||
      '';

    console.log('[login] token prefix =', S.token ? S.token.slice(0, 20) + '...' : '(none)');
    onLoginSuccess();
  } catch (e) {
    showMsg('msg-sms', e.message, 'err');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '登 录';
    }
  }
}
window.handleSmsLogin = handleSmsLogin;

async function sendSms() {
  const phone = val('inp-phone');
  if (!/^1[3-9]\d{9}$/.test(phone)) return;

  S.phone = phone;

  try {
    await api('/send-sms');
    startCountdown();
    showMsg('msg-sms', '验证码已重新发送', 'ok');
  } catch (e) {
    showMsg('msg-sms', e.message, 'err');
  }
}
window.sendSms = sendSms;

function startCountdown() {
  S.countdown = 60;
  const btn = id('btn-resend');
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = `${S.countdown}s 后重发`;

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
  if (!token) {
    showMsg('msg-token', '请输入 ECS Token', 'err');
    return;
  }

  S.token = token;
  S.phone = val('inp-token-phone');

  const btn = document.querySelector('#login-token .btn-primary');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '验证中...';
  }

  try {
    await api('/flow');
    onLoginSuccess();
  } catch (e) {
    showMsg('msg-token', 'Token 无效或已过期：' + e.message, 'err');
    S.token = '';
    if (btn) {
      btn.disabled = false;
      btn.textContent = '验证并登录';
    }
  }
}
window.handleTokenLogin = handleTokenLogin;

function onLoginSuccess() {
  show('page-login', false);
  show('page-dash', true);
  show('header-user', true);
  if (id('header-phone')) id('header-phone').textContent = S.phone || '已登录';
  loadAll();
}

function logout() {
  Object.assign(S, { phone: '', token: '', smsStep: 'send', countdown: 0, bizList: [] });
  clearInterval(S.timer);

  show('page-login', true);
  show('page-dash', false);
  show('header-user', false);
  show('sms-code-group', false);

  if (id('btn-sms-submit')) id('btn-sms-submit').textContent = '获取验证码';
  ['inp-phone', 'inp-code', 'inp-token', 'inp-token-phone'].forEach(i => {
    if (id(i)) id(i).value = '';
  });
}
window.logout = logout;

/* ===== Data ===== */
function loadAll() {
  // 先加载业务，便于给流量包辅助命名
  Promise.allSettled([loadBiz(true), loadFlow(), loadSpeed()]).then(() => {});
}
window.loadAll = loadAll;

async function refreshAll() {
  const btn = id('btn-refresh');
  if (btn) btn.classList.add('spinning');

  if (id('pkg-list')) id('pkg-list').innerHTML = '<div class="loading-row"><div class="spinner"></div>刷新中...</div>';
  if (id('speed-area')) id('speed-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';
  if (id('biz-area')) id('biz-area').innerHTML = '<div class="loading-row"><div class="spinner"></div>查询中...</div>';

  await Promise.allSettled([loadBiz(true), loadFlow(), loadSpeed()]);

  if (btn) btn.classList.remove('spinning');
}
window.refreshAll = refreshAll;

/* ── Flow ── */
async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
  } catch (e) {
    if (id('pkg-list')) {
      id('pkg-list').innerHTML = `<div class="error-tip">流量查询失败：${esc(e.message)}<br>
      <small style="color:var(--text-3)">请按 F12 → Console 查看 [API] /flow 原始响应</small></div>`;
    }
  }
}

function renderFlow(data) {
  const sumList = Array.isArray(data?.flowSumList) ? data.flowSumList : [];
  const summary = sumList[0] || {};

  let totalLeft = parseMB(summary.xcanusevalue);
  let totalUsed = parseMB(summary.xusedvalue);
  let totalFlow = parseMB(summary.xtotalvalue);

  if (!totalFlow && (totalLeft || totalUsed)) totalFlow = totalLeft + totalUsed;

  const totalPct = totalFlow > 0 ? Math.round((totalUsed / totalFlow) * 100) : 0;

  if (id('s-remain')) id('s-remain').textContent = fmtFlow(totalLeft);
  if (id('s-used')) id('s-used').textContent = fmtFlow(totalUsed);
  if (id('s-total')) id('s-total').textContent = fmtFlow(totalFlow);
  if (id('s-pct')) id('s-pct').textContent = totalPct + '%';

  if (id('bar-used-lbl')) id('bar-used-lbl').textContent = '已用 ' + fmtFlow(totalUsed);
  if (id('bar-total-lbl')) id('bar-total-lbl').textContent = '共 ' + fmtFlow(totalFlow);

  const bar = id('main-bar');
  if (bar) {
    bar.style.width = Math.min(totalPct, 100) + '%';
    bar.style.background = colorByPercent(totalPct);
  }

  // 收集所有流量包
  const rawItems = collectFlowPackages(data);
  console.log('[flow] raw package count=', rawItems.length, rawItems);

  let cards = rawItems
    .map((item, idx) => normalizeUnicomFlowItem(item, idx))
    .filter(item => item.name && (item.total > 0 || item.used > 0 || item.left > 0));

  cards = uniqBy(cards, item => `${item.name}_${item.total}_${item.used}_${item.left}`);

  // 过滤和 summary 完全重复但无区分意义的项
  if (cards.length > 1) {
    cards = cards.filter(item => {
      const same =
        Math.abs(item.left - totalLeft) < 0.01 &&
        Math.abs(item.used - totalUsed) < 0.01 &&
        Math.abs(item.total - totalFlow) < 0.01;

      if (!same) return true;
      return /总|主套餐|套餐总流量|总流量/.test(item.name);
    });
  }

  // 排序：总流量 -> 通用 -> 专属 -> 其他
  cards.sort((a, b) => {
    const score = x => {
      if (/总|主套餐|套餐总流量|总流量/.test(x.name)) return 1;
      if (!x.exclusive) return 2;
      if (x.exclusive) return 3;
      return 9;
    };
    return score(a) - score(b);
  });

  // 兜底
  if (!cards.length && totalFlow > 0) {
    cards = [{
      name: '套餐总流量',
      used: totalUsed,
      left: totalLeft,
      total: totalFlow,
      percent: totalFlow > 0 ? Math.round((totalUsed / totalFlow) * 10000) / 100 : 0,
      unlimited: false,
      exclusive: false,
      voice: false,
      shared: true
    }];
  }

  const firstCards = cards.slice(0, 4);
  const restCards = cards.slice(4);

  let html = '<div class="flow-grid">';
  html += firstCards.map(item => renderFlowCard(item)).join('');
  html += '</div>';

  if (restCards.length) {
    html += `
      <div class="flow-more-head">
        <span>其他流量包 (${restCards.length})</span>
        <button class="flow-toggle-btn" onclick="toggleMoreFlows(this)">收起</button>
      </div>
      <div id="more-flow-list" class="flow-grid flow-grid-more">
        ${restCards.map(item => renderFlowCard(item, true)).join('')}
      </div>
    `;
  }

  if (id('pkg-list')) {
    id('pkg-list').innerHTML = html || '<div class="empty-tip">暂无流量包信息</div>';
  }
}

/* ── Speed ── */
async function loadSpeed() {
  try {
    const data = await api('/speed');
    renderSpeed(data);
  } catch (e) {
    if (id('speed-area')) {
      id('speed-area').innerHTML = `<div class="error-tip">速率查询失败：${esc(e.message)}</div>`;
    }
  }
}

function renderSpeed(data) {
  const downRaw = firstNonEmpty(
    dig(data, 'downRate', 'downloadRate', 'downSpeed', 'downloadSpeed', 'downBandwidth', 'dlRate'),
    data?.rateResource?.rate
  );

  const dl = typeof downRaw === 'string'
    ? downRaw.replace(/Mbps/i, '').trim()
    : numOf(downRaw);

  const ul = numOf(firstNonEmpty(
    dig(data, 'upRate', 'uploadRate', 'upSpeed', 'uploadSpeed', 'upBandwidth', 'ulRate'),
    data?.upRate
  ));

  const qci = firstNonEmpty(
    dig(data, 'qci', 'QCI', 'qciLevel', 'qciValue', 'qciCode'),
    '—'
  );

  const net = firstNonEmpty(
    dig(data, 'networkType', 'netType', 'network', 'accessType', 'netTypeName'),
    data?.terminalResource?.terminal,
    '5G'
  );

  const state = firstNonEmpty(
    dig(data, 'limitFlag', 'isLimit', 'speedLimit', 'isLimitSpeed', 'limitStatus'),
    data?.networkStirchResource?.state
  );

  const limitFlag = ['0', 0, 'true', true, 'yes', 'limited', 'LIMITED'].includes(state);

  if (id('net-badge')) id('net-badge').textContent = net;

  if (id('speed-area')) {
    id('speed-area').innerHTML = `
      <div class="speed-pair">
        <div class="speed-block modern">
          <div class="speed-icon dl">↓</div>
          <div>
            <div class="speed-val">${esc(fmtNumber(dl || '—'))}</div>
            <div class="speed-unit">Mbps 下行</div>
          </div>
        </div>
        <div class="speed-block modern">
          <div class="speed-icon ul">↑</div>
          <div>
            <div class="speed-val">${esc(fmtNumber(ul || '—'))}</div>
            <div class="speed-unit">Mbps 上行</div>
          </div>
        </div>
      </div>
      <div class="info-rows">
        ${row('QCI 等级', esc(String(qci)))}
        ${row('网络类型', esc(String(net)))}
        ${row('限速状态', limitFlag
          ? '<span class="pkg-pct amber">已限速</span>'
          : '<span class="pkg-pct green">正常</span>')}
      </div>
    `;
  }
}

/* ── Biz ── */
async function loadBiz(silent = false) {
  try {
    const data = await api('/biz');
    S.bizList = pickBizList(data);
    renderBiz(S.bizList);
  } catch (e) {
    S.bizList = [];
    if (!silent && id('biz-area')) {
      id('biz-area').innerHTML = `<div class="error-tip">业务查询失败：${esc(e.message)}</div>`;
    } else if (id('biz-area')) {
      id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>';
    }
  }
}

function renderBiz(list) {
  list = Array.isArray(list) ? list : [];

  console.log('[biz] items count=', list.length, ' first=', list[0]);

  if (id('biz-count')) {
    id('biz-count').textContent = list.length ? list.length + ' 项' : '';
  }

  if (!list.length) {
    if (id('biz-area')) id('biz-area').innerHTML = '<div class="empty-tip">暂无已订业务</div>';
    return;
  }

  if (id('biz-area')) {
    id('biz-area').innerHTML = list.map((b, idx) => {
      const name = firstNonEmpty(
        b.serviceName,
        b.name,
        b.productName,
        b.offerName,
        b.bizName,
        b.spName,
        '业务'
      );

      const date = firstNonEmpty(
        b.subscribeDate,
        b.createDate,
        b.orderDate,
        b.startDate,
        b.orderTime,
        b.orderTimeStr,
        ''
      );

      let price = firstNonEmpty(
        b.price,
        b.fee,
        b.month_fee,
        b.monthFee,
        b.chargeFee,
        b.cost,
        b.amount,
        b.productFee
      );

      if (!price) price = extractPriceFromName(name);

      const statusText =
        b.orderStatus === '0' ? '生效中' :
        b.orderStatus === '1' ? '处理中' :
        '已订购';

      return `
        <div class="biz-card">
          <div class="biz-card-left">
            <div class="biz-dot ${idx % 2 === 0 ? 'blue' : 'green'}"></div>
            <div class="biz-content">
              <div class="biz-name">${esc(String(name))}</div>
              <div class="biz-sub">
                ${date ? `<span>${esc(String(date))}</span>` : '<span>已订购业务</span>'}
                <span class="biz-status">${statusText}</span>
              </div>
            </div>
          </div>
          <div class="biz-card-right">
            <span class="biz-tag">${price ? `¥${esc(String(price))}/月` : '套餐'}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}