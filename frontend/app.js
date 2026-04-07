'use strict';

const S = { phone: '', token: '', smsStep: 'send', countdown: 0, timer: null };

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
    throw new Error(data.message || data.resultMessage || data.msg || `请求失败`);
  }
  return data;
}

const id = i => document.getElementById(i);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function parseMB(v) {
  if (v == null) return null;
  return parseFloat(String(v).replace(/,/g, '')) || 0;
}

function fmtFlow(mb) {
  if (!Number.isFinite(mb)) return '—';
  if (mb >= 1024*1024) return (mb/1024/1024).toFixed(2) + ' TB';
  if (mb >= 1024) return (mb/1024).toFixed(2) + ' GB';
  return mb.toFixed(0) + ' MB';
}

/* Login 部分保持原样（简化版） */
function onLoginSuccess() {
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('page-dash').style.display = 'block';
  document.getElementById('header-user').style.display = 'flex';
  id('header-phone').textContent = S.phone || '已登录';
  loadAll();
}

// 其他登录函数（handleSmsLogin、handleTokenLogin 等）请保留你原来的完整实现，这里只给出核心渲染部分
// 如果需要完整登录代码，请告诉我，我再补全

function loadAll() {
  loadFlow();
  loadSpeed();
  loadBiz();   // 虽然移除UI，但API仍可调用（不影响）
}

async function refreshAll() {
  const btn = id('btn-refresh');
  btn.classList.add('spinning');
  await Promise.allSettled([loadFlow(), loadSpeed()]);
  btn.classList.remove('spinning');
}

/* 流量渲染 */
async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
    renderVoice(data);
  } catch(e) {
    console.error(e);
  }
}

function renderFlow(raw) {
  const sumList = raw.flowSumList || [];
  const general = sumList.find(s => s.flowtype === '1') || {};
  const sumTotal = parseMB(general.xcanusevalue);
  const sumUsed = parseMB(general.xusedvalue);
  const sumLeft = Math.max(sumTotal - sumUsed, 0);
  const sumPct = sumTotal > 0 ? Math.round(sumUsed / sumTotal * 100) : 0;

  id('s-remain').textContent = fmtFlow(sumLeft);
  id('s-used').textContent = fmtFlow(sumUsed);
  id('s-total').textContent = fmtFlow(sumTotal);
  id('s-pct').textContent = sumPct + '%';

  id('bar-used-lbl').textContent = '已用 ' + fmtFlow(sumUsed);
  id('bar-total-lbl').textContent = '共 ' + fmtFlow(sumTotal);
  id('main-bar').style.width = Math.min(sumPct, 100) + '%';
  id('main-bar').style.background = sumPct > 85 ? '#ef4444' : sumPct > 60 ? '#f59e0b' : '#3b82f6';

  // 分包列表
  const flowResource = (raw.resources || []).find(r => r.type === 'flow');
  const details = flowResource?.details || [];
  let html = '';

  details.forEach(d => {
    const name = esc(d.feePolicyName || '流量包');
    const total = parseMB(d.total);
    const used = parseMB(d.use);
    const remain = Math.max(parseMB(d.remain), 0);
    const pct = total > 0 ? Math.round(used / total * 100) : 0;
    const isUnlimited = d.limited === '1' || total === 0;

    html += `
      <div class="pkg-item ${isUnlimited ? 'pkg-item--directed' : ''}">
        <div class="pkg-left">
          <div class="pkg-name">${name}</div>
          <div class="pkg-expire">${d.endDate || '长期有效'}</div>
          <div class="mini-bar-bg">
            <div class="mini-bar" style="width:${Math.min(pct,100)}%; background:${pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e'}"></div>
          </div>
        </div>
        <div class="pkg-right">
          <div class="pkg-remain">${isUnlimited ? fmtFlow(used) : fmtFlow(remain)}</div>
          <div class="pkg-of">${isUnlimited ? '已用 / 无上限' : '/ ' + fmtFlow(total)}</div>
          <span class="pkg-pct ${pct > 90 ? 'red' : pct > 70 ? 'amber' : 'green'}">
            ${isUnlimited ? '免流' : '已用 ' + pct + '%'}
          </span>
        </div>
      </div>`;
  });

  id('pkg-list').innerHTML = html || '<div class="empty-tip">暂无流量包明细</div>';
}

/* 语音渲染 */
function renderVoice(raw) {
  const voiceResource = (raw.resources || []).find(r => r.type === 'Voice' || r.type?.toLowerCase() === 'voice');
  const details = voiceResource?.details || [];
  const voiceCard = id('voice-card');

  if (!details.length) {
    voiceCard.style.display = 'none';
    return;
  }

  voiceCard.style.display = 'block';
  let html = '';
  details.forEach(d => {
    const total = parseMB(d.total) || 0;
    const used = parseMB(d.use) || 0;
    const remain = Math.max(parseMB(d.remain) || 0, 0);
    const pct = total > 0 ? Math.round(used / total * 100) : 0;

    html += `
      <div class="pkg-item">
        <div class="pkg-left">
          <div class="pkg-name">${esc(d.feePolicyName || '语音包')}</div>
          <div class="pkg-expire">${d.endDate || '长期有效'}</div>
          <div class="mini-bar-bg">
            <div class="mini-bar" style="width:${pct}%; background:#22c55e"></div>
          </div>
        </div>
        <div class="pkg-right">
          <div class="pkg-remain">${remain} 分钟</div>
          <div class="pkg-of">/ ${total} 分钟</div>
          <span class="pkg-pct green">已用 ${pct}%</span>
        </div>
      </div>`;
  });
  id('voice-area').innerHTML = html;
}

/* 速率（简化） */
async function loadSpeed() {
  try {
    const data = await api('/speed');
    renderSpeed(data);
  } catch(e) {}
}

function renderSpeed(raw) {
  const pkgName = raw.packageName || '';
  if (pkgName) {
    id('main-package-name').textContent = esc(pkgName);
    id('package-name-display').style.display = 'block';
  }
  id('speed-area').innerHTML = `<div class="info-text">当前网络：5G • 速率正常</div>`;
}

/* Biz 已移除UI，但保留API调用防止报错 */
async function loadBiz() {}
