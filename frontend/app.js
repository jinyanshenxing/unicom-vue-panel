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

function parseMB(v) {
  if (v === null || v === undefined || v === '') return null;
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

function fmtFlow(mb) {
  mb = Number(mb || 0);
  if (mb >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB';
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
  return Math.round(mb) + ' MB';
}

function progressColor(pct) {
  if (pct > 85) return '#dc2626';
  if (pct > 60) return '#d97706';
  return '#2563eb';
}

async function api(url, data) {
  const resp = await fetch(url, {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined
  });

  const json = await resp.json();
  if (!resp.ok || json?.code === 1 || json?.success === false) {
    throw new Error(json?.message || '请求失败');
  }
  return json;
}

function setSummaryCards(sumLeft, sumUsed, sumTotal) {
  const pct = sumTotal > 0 ? Math.round(sumUsed / sumTotal * 100) : 0;
  const safePct = Math.max(0, Math.min(pct, 100));

  id('s-remain').textContent = fmtFlow(sumLeft);
  id('s-used').textContent = fmtFlow(sumUsed);
  id('s-total').textContent = fmtFlow(sumTotal);
  id('s-pct').textContent = safePct + '%';

  const remainPct = sumTotal > 0 ? Math.round(sumLeft / sumTotal * 100) : 0;

  const remainBar = id('s-remain-bar');
  if (remainBar) remainBar.style.width = Math.max(0, Math.min(remainPct, 100)) + '%';

  const usedBar = id('s-used-bar');
  if (usedBar) usedBar.style.width = safePct + '%';

  const totalBar = id('s-total-bar');
  if (totalBar) totalBar.style.width = sumTotal > 0 ? '100%' : '0%';

  const pctBar = id('s-pct-bar');
  const pctFill = id('s-pct-fill');
  const color = progressColor(safePct);

  if (pctBar) {
    pctBar.style.width = safePct + '%';
    pctBar.style.background = color;
  }

  if (pctFill) {
    pctFill.style.width = safePct + '%';
  }
}

function renderPackage(d, isDirected = false) {
  const name = d.feePolicyName || d.name || '未命名流量包';
  const totalMB = parseMB(d.total);
  const usedMB = parseMB(d.use) ?? 0;
  const remainMB = parseMB(d.remain) ?? 0;
  const pct = parseInt(d.usedPercent, 10) || (totalMB > 0 ? Math.round(usedMB / totalMB * 100) : 0);
  const endDate = d.endDate || '长期有效';
  const limited = d.limited;

  // 定向/无限流量
  if (isDirected && (limited === '1' || totalMB === 0 || totalMB === null)) {
    return `
      <div class="pkg-item unlimited-item">
        <div class="pkg-left">
          <div class="pkg-name">${esc(name)}</div>
          <div class="pkg-expire">${esc(endDate)}</div>
        </div>
        <div class="pkg-right">
          <div class="pkg-remain">${fmtFlow(usedMB)}</div>
          <div class="pkg-of">已用 / 无上限</div>
          <span class="pkg-pct blue">免流</span>
        </div>
      </div>
    `;
  }

  const safePct = Math.max(0, Math.min(pct, 100));
  const color = safePct >= 100 ? '#dc2626' : safePct > 60 ? '#d97706' : '#2563eb';
  const tagClass = safePct >= 100 ? 'red' : 'green';

  return `
    <div class="pkg-item">
      <div class="pkg-left">
        <div class="pkg-name">${esc(name)}</div>
        <div class="pkg-expire">${esc(endDate)}</div>
        <div class="mini-bar-bg">
          <div class="mini-bar" style="width:${safePct}%;background:${color}"></div>
        </div>
      </div>
      <div class="pkg-right">
        <div class="pkg-remain">${fmtFlow(remainMB)}</div>
        <div class="pkg-of">/ ${fmtFlow(totalMB || 0)}</div>
        <span class="pkg-pct ${tagClass}">已用 ${safePct}%</span>
      </div>
    </div>
  `;
}

function renderFlow(raw) {
  // 从 resources 中取 flow 明细 [1]
  const flowResource = (raw.resources || []).find(r => r.type === 'flow');
  const details = flowResource?.details || [];

  // 从 flowSumList / fresSumList 取汇总 [1]
  const sumList = raw.flowSumList || raw.fresSumList || [];
  const generalSum = sumList.find(s => s.flowtype === '1' || (s.elemtype === '3' && s.flowtype === '1'));

  const sumTotal = parseMB(generalSum?.xcanusevalue) ?? 0;
  const sumUsed = parseMB(generalSum?.xusedvalue) ?? 0;
  const sumLeft = Math.max(parseMB(generalSum?.xremainvalue) ?? (sumTotal - sumUsed), 0);
  const sumPct = sumTotal > 0 ? Math.round(sumUsed / sumTotal * 100) : 0;

  // 顶部卡片
  setSummaryCards(sumLeft, sumUsed, sumTotal);

  // 主进度条
  id('bar-used-lbl').textContent = `已用 ${fmtFlow(sumUsed)}`;
  id('bar-total-lbl').textContent = `共 ${fmtFlow(sumTotal)}`;

  const bar = id('main-bar');
  if (bar) {
    bar.style.width = Math.min(sumPct, 100) + '%';
    bar.style.background = progressColor(sumPct);
  }

  // 明细分组
  const general = details.filter(d => d.flowType === '1' && !d.hide);
  const directed = details.filter(d => d.flowType === '2' && !d.hide);

  let html = '';

  if (general.length) {
    html += `<div class="flow-section-header">通用流量</div>`;
    html += general.map(d => renderPackage(d, false)).join('');
  }

  if (directed.length) {
    html += `<div class="flow-section-header">定向流量</div>`;
    html += directed.map(d => renderPackage(d, true)).join('');
  }

  id('pkg-list').innerHTML = html || '<div class="empty-tip">暂无流量包明细</div>';
}

async function loadFlow() {
  try {
    const data = await api('/flow');
    renderFlow(data);
  } catch (e) {
    id('pkg-list').innerHTML = `<div class="empty-tip">流量查询失败：${esc(e.message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadFlow();

  const btnRefresh = id('btn-refresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', loadFlow);
  }
});