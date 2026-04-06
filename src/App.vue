<template>
  <div class="page">
    <header class="header">
      <div>
        <div class="header-title">联通流量面板</div>
        <div class="login-sub">登录后查看套餐流量、速率与已订业务</div>
      </div>

      <div v-if="isLoggedIn" class="header-user">
        <span>{{ state.phone || '已登录' }}</span>
        <button class="btn-ghost" @click="logout">退出登录</button>
      </div>
    </header>

    <section v-if="!isLoggedIn">
      <div class="login-wrap">
        <div class="login-title">登录</div>
        <div class="login-sub">支持短信验证码登录 / ECS Token 登录</div>

        <div class="tabs">
          <button class="tab-btn" :class="{ active: loginTab === 'sms' }" @click="loginTab = 'sms'">
            短信登录
          </button>
          <button class="tab-btn" :class="{ active: loginTab === 'token' }" @click="loginTab = 'token'">
            Token 登录
          </button>
        </div>

        <div v-if="loginTab === 'sms'">
          <div class="form-group">
            <input v-model.trim="form.phone" type="tel" placeholder="请输入联通手机号" maxlength="11" />
          </div>

          <template v-if="state.smsStep === 'verify'">
            <div class="form-group">
              <input v-model.trim="form.code" type="text" placeholder="请输入短信验证码" maxlength="8" />
            </div>
            <div class="form-group form-end">
              <button class="btn-ghost" :disabled="state.countdown > 0" @click="sendSms">
                {{ state.countdown > 0 ? `${state.countdown}s 后重发` : '重新发送' }}
              </button>
            </div>
          </template>

          <div class="form-group">
            <button class="btn-primary full" @click="handleSmsLogin" :disabled="loading.login">
              {{ loading.login ? (state.smsStep === 'send' ? '发送中...' : '登录中...') : (state.smsStep === 'send' ? '获取验证码' : '登 录') }}
            </button>
          </div>

          <div class="msg" :class="{ show: !!msg.sms.text, ok: msg.sms.type === 'ok', err: msg.sms.type === 'err' }">
            {{ msg.sms.text }}
          </div>
        </div>

        <div v-else>
          <div class="form-group">
            <input v-model.trim="form.tokenPhone" type="tel" placeholder="手机号（可选，用于界面显示）" maxlength="11" />
          </div>

          <div class="form-group">
            <input v-model.trim="form.token" type="text" placeholder="请输入 ECS Token" />
          </div>

          <div class="form-group">
            <button class="btn-primary full" @click="handleTokenLogin" :disabled="loading.tokenLogin">
              {{ loading.tokenLogin ? '验证中...' : '验证并登录' }}
            </button>
          </div>

          <div class="msg" :class="{ show: !!msg.token.text, ok: msg.token.type === 'ok', err: msg.token.type === 'err' }">
            {{ msg.token.text }}
          </div>
        </div>
      </div>
    </section>

    <section v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ flowSummary.remainText }}</div>
          <div class="stat-label">剩余流量</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ flowSummary.usedText }}</div>
          <div class="stat-label">已用流量</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ flowSummary.totalText }}</div>
          <div class="stat-label">套餐总量</div>
        </div>
        <div class="stat-card active">
          <div class="stat-value">{{ flowSummary.percent }}%</div>
          <div class="stat-label">使用率</div>
        </div>
      </div>

      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">流量余量</div>
          <div class="panel-tools">
            <button class="refresh-btn" @click="refreshAll" :disabled="loading.refresh">
              {{ loading.refresh ? '刷新中...' : '⟳ 刷新' }}
            </button>
          </div>
        </div>

        <div class="flow-summary-box">
          <div class="main-bar-bg">
            <div
              class="main-bar"
              :style="{ width: `${Math.min(flowSummary.percent, 100)}%`, background: colorByPercent(flowSummary.percent) }"
            ></div>
          </div>
          <div class="bar-labels">
            <span>已用 {{ flowSummary.usedText }}</span>
            <span>共 {{ flowSummary.totalText }}</span>
          </div>
        </div>

        <template v-if="flowCards.length">
          <div class="flow-grid">
            <div
              v-for="(item, idx) in visibleFlowCards"
              :key="item.name + '_' + idx + '_' + item.total + '_' + item.used"
              class="flow-card"
            >
              <div class="flow-card-head">
                <div class="flow-card-title">{{ item.name }}</div>
                <div class="flow-card-icon">{{ item.voice ? '☎' : '≋' }}</div>
              </div>

              <div class="flow-card-value">{{ fmtFlow(item.used) }}</div>

              <div class="flow-card-sub">
                <div>总：{{ item.unlimited ? '∞' : fmtFlow(item.total) }}</div>
                <div>剩：{{ fmtFlow(item.left) }}</div>
              </div>

              <div class="flow-card-tags">
                <span class="flow-tag" :class="item.voice ? 'gray' : item.exclusive ? 'green' : 'gray'">
                  {{ item.voice ? '语音' : item.exclusive ? '专属' : '通用' }}
                </span>
                <span class="flow-tag" :class="item.shared ? 'gray' : 'slate'">
                  {{ item.shared ? '共享' : '非共享' }}
                </span>
                <span class="flow-tag" :class="item.unlimited ? 'yellow' : 'gray'">
                  {{ item.unlimited ? '无限量' : '有上限' }}
                </span>
              </div>

              <div class="flow-card-foot">
                <span>总量</span>
                <span>{{ item.unlimited ? '无限量' : item.percent.toFixed(2) + '%' }}</span>
              </div>

              <div class="flow-card-bar-bg">
                <div
                  class="flow-card-bar"
                  :style="{
                    width: `${item.unlimited ? 100 : Math.min(item.percent, 100)}%`,
                    background: item.unlimited
                      ? 'linear-gradient(90deg,#8b5cf6,#ef4444,#f59e0b,#84cc16,#06b6d4,#6366f1)'
                      : colorByPercent(item.percent)
                  }"
                ></div>
              </div>
            </div>
          </div>

          <div v-if="restFlowCards.length" class="flow-more-head">
            <span>其他流量包 ({{ restFlowCards.length }})</span>
            <button class="flow-toggle-btn" @click="showMoreFlows = !showMoreFlows">
              {{ showMoreFlows ? '收起' : '展开' }}
            </button>
          </div>

          <div v-if="restFlowCards.length && showMoreFlows" class="flow-grid flow-grid-more">
            <div
              v-for="(item, idx) in restFlowCards"
              :key="'rest_' + item.name + '_' + idx + '_' + item.total + '_' + item.used"
              class="flow-card compact"
            >
              <div class="flow-card-head">
                <div class="flow-card-title">{{ item.name }}</div>
                <div class="flow-card-icon">{{ item.voice ? '☎' : '≋' }}</div>
              </div>

              <div class="flow-card-value">{{ fmtFlow(item.used) }}</div>

              <div class="flow-card-sub">
                <div>总：{{ item.unlimited ? '∞' : fmtFlow(item.total) }}</div>
                <div>剩：{{ fmtFlow(item.left) }}</div>
              </div>

              <div class="flow-card-tags">
                <span class="flow-tag" :class="item.voice ? 'gray' : item.exclusive ? 'green' : 'gray'">
                  {{ item.voice ? '语音' : item.exclusive ? '专属' : '通用' }}
                </span>
                <span class="flow-tag" :class="item.shared ? 'gray' : 'slate'">
                  {{ item.shared ? '共享' : '非共享' }}
                </span>
                <span class="flow-tag" :class="item.unlimited ? 'yellow' : 'gray'">
                  {{ item.unlimited ? '无限量' : '有上限' }}
                </span>
              </div>

              <div class="flow-card-foot">
                <span>总量</span>
                <span>{{ item.unlimited ? '无限量' : item.percent.toFixed(2) + '%' }}</span>
              </div>

              <div class="flow-card-bar-bg">
                <div
                  class="flow-card-bar"
                  :style="{
                    width: `${item.unlimited ? 100 : Math.min(item.percent, 100)}%`,
                    background: item.unlimited
                      ? 'linear-gradient(90deg,#8b5cf6,#ef4444,#f59e0b,#84cc16,#06b6d4,#6366f1)'
                      : colorByPercent(item.percent)
                  }"
                ></div>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="empty-tip">暂无流量包信息</div>
      </section>

      <div class="two-col">
        <section class="panel">
          <div class="panel-head">
            <div class="panel-title">速率 & QCI</div>
            <div class="panel-tools">
              <span class="badge">{{ speedInfo.net || '5G' }}</span>
            </div>
          </div>

          <div class="speed-pair">
            <div class="speed-block modern">
              <div class="speed-icon dl">↓</div>
              <div>
                <div class="speed-val">{{ speedInfo.dl || '—' }}</div>
                <div class="speed-unit">Mbps 下行</div>
              </div>
            </div>
            <div class="speed-block modern">
              <div class="speed-icon ul">↑</div>
              <div>
                <div class="speed-val">{{ speedInfo.ul || '—' }}</div>
                <div class="speed-unit">Mbps 上行</div>
              </div>
            </div>
          </div>

          <div class="info-rows">
            <div class="info-row">
              <span class="info-key">QCI 等级</span>
              <span class="info-val">{{ speedInfo.qci || '—' }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">网络类型</span>
              <span class="info-val">{{ speedInfo.net || '—' }}</span>
            </div>
            <div class="info-row">
              <span class="info-key">限速状态</span>
              <span class="info-val">
                <span class="pkg-pct" :class="speedInfo.limit ? 'amber' : 'green'">
                  {{ speedInfo.limit ? '已限速' : '正常' }}
                </span>
              </span>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div class="panel-title">已订业务</div>
            <div class="panel-tools">
              <span class="badge" v-if="bizList.length">{{ bizList.length }} 项</span>
            </div>
          </div>

          <div v-if="bizList.length">
            <div v-for="(b, idx) in bizList" :key="idx + '_' + (b.productId || b.productName || b.name)" class="biz-card">
              <div class="biz-card-left">
                <div class="biz-dot" :class="idx % 2 === 0 ? 'blue' : 'green'"></div>
                <div class="biz-content">
                  <div class="biz-name">{{ getBizName(b) }}</div>
                  <div class="biz-sub">
                    <span>{{ getBizDate(b) || '已订购业务' }}</span>
                    <span class="biz-status">{{ getBizStatus(b) }}</span>
                  </div>
                </div>
              </div>
              <div class="biz-card-right">
                <span class="biz-tag">{{ getBizPriceText(b) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="empty-tip">暂无已订业务</div>
        </section>
      </div>

      <footer class="footer">
        数据来自联通官方接口 · 本地反向代理转发
      </footer>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'

const state = reactive({
  phone: '',
  token: '',
  smsStep: 'send',
  countdown: 0,
  timer: null,
})

const form = reactive({
  phone: '',
  code: '',
  token: '',
  tokenPhone: '',
})

const msg = reactive({
  sms: { text: '', type: '' },
  token: { text: '', type: '' },
})

const loading = reactive({
  login: false,
  tokenLogin: false,
  refresh: false,
})

const loginTab = ref('sms')
const showMoreFlows = ref(true)
const isLoggedIn = computed(() => !!state.token)

const bizList = ref([])
const flowCards = ref([])

const flowSummary = reactive({
  remain: 0,
  used: 0,
  total: 0,
  percent: 0,
  remainText: '—',
  usedText: '—',
  totalText: '—',
})

const speedInfo = reactive({
  dl: '—',
  ul: '—',
  qci: '—',
  net: '5G',
  limit: false,
})

const visibleFlowCards = computed(() => flowCards.value.slice(0, 4))
const restFlowCards = computed(() => flowCards.value.slice(4))

async function api(path, extra = {}) {
  const res = await fetch('/api' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { 'x-ecs-token': state.token } : {}),
    },
    body: JSON.stringify({
      mobileNumber: state.phone,
      ...extra
    }),
  })

  const data = await res.json()
  console.log(`[API] ${path}`, data)

  if (!res.ok || (data.code && !['0000', '200', 200, '1000', 'success', 'SUCCESS'].includes(data.code))) {
    throw new Error(data.message || data.resultMessage || data.msg || `请求失败 (${res.status})`)
  }

  return data
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

function dig(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      const found = dig(v, ...keys)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function findArray(obj, ...preferKeys) {
  if (!obj || typeof obj !== 'object') return []
  for (const k of preferKeys) {
    if (Array.isArray(obj[k]) && typeof obj[k][0] === 'object') return obj[k]
  }
  for (const [, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = findArray(v, ...preferKeys)
      if (found.length) return found
    }
  }
  return []
}

function uniqBy(arr, getKey) {
  const map = new Map()
  arr.forEach(item => {
    const key = getKey(item)
    if (!map.has(key)) map.set(key, item)
  })
  return [...map.values()]
}

function parseMB(v) {
  if (v === undefined || v === null || v === '') return 0
  if (typeof v === 'number') return v
  const s = String(v).trim().toUpperCase().replace(/,/g, '')
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  if (s.endsWith('TB') || s.endsWith('T')) return n * 1024 * 1024
  if (s.endsWith('GB') || s.endsWith('G')) return n * 1024
  if (s.endsWith('KB') || s.endsWith('K')) return n / 1024
  return n
}

function fmtFlow(mb) {
  if (mb === undefined || mb === null || isNaN(mb)) return '—'
  if (mb >= 1024 * 1024) return (mb / 1024 / 1024).toFixed(2) + ' TB'
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB'
  return mb.toFixed(2).replace(/\.00$/, '') + ' MB'
}

function fmtNumber(v) {
  if (v === undefined || v === null || v === '') return '—'
  const n = parseFloat(v)
  return Number.isFinite(n) ? String(n) : String(v)
}

function colorByPercent(percent) {
  if (percent >= 100) return '#111827'
  if (percent > 85) return '#ef4444'
  if (percent > 60) return '#f59e0b'
  return '#2563eb'
}

function setMsg(key, text, type) {
  msg[key].text = text
  msg[key].type = type
  setTimeout(() => {
    if (msg[key].text === text) {
      msg[key].text = ''
      msg[key].type = ''
    }
  }, 5000)
}

function extractPriceFromName(name) {
  const s = String(name || '')
  const m = s.match(/(\d+(?:\.\d+)?)元/)
  return m ? m[1] : ''
}

function pickBizList(data) {
  if (Array.isArray(data?.mainProductInfo)) return data.mainProductInfo
  if (Array.isArray(data?.data?.mainProductInfo)) return data.data.mainProductInfo
  return findArray(data, 'mainProductInfo', 'list', 'orderList', 'serviceList', 'bizList', 'items', 'records', 'productList')
}

function collectFlowPackages(obj, arr = []) {
  if (!obj || typeof obj !== 'object') return arr
  const candidateArrays = ['flowSumList', 'XsBResources', 'details', 'resources', 'list', 'items']
  for (const key of candidateArrays) {
    if (Array.isArray(obj[key])) {
      obj[key].forEach((item, idx) => {
        if (item && typeof item === 'object') {
          arr.push({ ...item, __source: key, __index: idx })
          collectFlowPackages(item, arr)
        }
      })
    }
  }
  return arr
}

function matchBizName(flowName) {
  if (!bizList.value.length) return ''
  const direct = bizList.value.find(b => {
    const name = getBizName(b)
    return name && flowName && (flowName.includes(name) || name.includes(flowName))
  })
  return direct ? getBizName(direct) : ''
}

function normalizeUnicomFlowItem(p, idx = 0) {
  let left = parseMB(firstNonEmpty(p.xcanusevalue, p.canusevalue, p.leftFlow, p.remainFlow, p.left, p.remainSize, p.surplusFlow, p.balance))
  let used = parseMB(firstNonEmpty(p.xusedvalue, p.usedFlow, p.used, p.usedSize, p.useFlow, p.usedTraffic, p.usedAmount))
  let total = parseMB(firstNonEmpty(p.xtotalvalue, p.total, p.packageFlow, p.flowSize, p.totalFlow, p.totalSize, p.allSize))

  if (!total && (left || used)) total = left + used
  if (!left && total && used) left = Math.max(total - used, 0)

  let name = firstNonEmpty(p.feePolicyName, p.feePolicyTypeName, p.packageName, p.name, p.productName, p.offerName, p.pkgName, p.resourceName, p.policyName)

  if (!name) {
    if (p.__source === 'flowSumList') name = idx === 0 ? '套餐总流量' : `套餐流量${idx + 1}`
    else if (p.__source === 'XsBResources') name = `专属流量包${idx + 1}`
    else if (p.__source === 'details') name = `流量包${idx + 1}`
    else name = `流量包${idx + 1}`
  }

  const bizMatchedName = matchBizName(name)
  if (!/总流量|专属流量包|流量包\d+/.test(name) && bizMatchedName) {
    name = bizMatchedName
  }

  const percent = total > 0 ? Math.round((used / total) * 10000) / 100 : 0
  const textName = String(name || '')

  return {
    name,
    used,
    left,
    total,
    percent,
    unlimited: /无限|不限量/.test(textName),
    exclusive: /专属|定向|免流|头条|腾讯|百度|抖音|快手|爱奇艺|优酷/.test(textName) || p.__source === 'XsBResources',
    voice: /语音|分钟|通话/.test(textName),
    shared: !(/专属|定向|免流/.test(textName) || p.__source === 'XsBResources'),
    raw: p
  }
}

async function handleSmsLogin() {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    setMsg('sms', '请输入有效的联通手机号', 'err')
    return
  }

  state.phone = form.phone

  if (state.smsStep === 'send') {
    loading.login = true
    try {
      await api('/send-sms')
      setMsg('sms', '验证码已发送，请注意查收', 'ok')
      state.smsStep = 'verify'
      startCountdown()
    } catch (e) {
      setMsg('sms', e.message, 'err')
    } finally {
      loading.login = false
    }
    return
  }

  if (!form.code) {
    setMsg('sms', '请输入验证码', 'err')
    return
  }

  loading.login = true
  try {
    const data = await api('/login-sms', { randomNum: form.code })
    state.token =
      data.token ||
      data.ecs_token ||
      data.accessToken ||
      data.result?.token ||
      data.result?.ecs_token ||
      data.data?.token ||
      data.data?.ecs_token ||
      ''
    await loadAll()
  } catch (e) {
    setMsg('sms', e.message, 'err')
  } finally {
    loading.login = false
  }
}

async function sendSms() {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) return
  state.phone = form.phone
  try {
    await api('/send-sms')
    startCountdown()
    setMsg('sms', '验证码已重新发送', 'ok')
  } catch (e) {
    setMsg('sms', e.message, 'err')
  }
}

function startCountdown() {
  state.countdown = 60
  clearInterval(state.timer)
  state.timer = setInterval(() => {
    state.countdown--
    if (state.countdown <= 0) clearInterval(state.timer)
  }, 1000)
}

async function handleTokenLogin() {
  if (!form.token) {
    setMsg('token', '请输入 ECS Token', 'err')
    return
  }

  state.token = form.token
  state.phone = form.tokenPhone

  loading.tokenLogin = true
  try {
    await api('/flow')
    await loadAll()
  } catch (e) {
    state.token = ''
    setMsg('token', 'Token 无效或已过期：' + e.message, 'err')
  } finally {
    loading.tokenLogin = false
  }
}

function logout() {
  state.phone = ''
  state.token = ''
  state.smsStep = 'send'
  state.countdown = 0
  clearInterval(state.timer)

  form.phone = ''
  form.code = ''
  form.token = ''
  form.tokenPhone = ''

  bizList.value = []
  flowCards.value = []

  flowSummary.remain = 0
  flowSummary.used = 0
  flowSummary.total = 0
  flowSummary.percent = 0
  flowSummary.remainText = '—'
  flowSummary.usedText = '—'
  flowSummary.totalText = '—'

  speedInfo.dl = '—'
  speedInfo.ul = '—'
  speedInfo.qci = '—'
  speedInfo.net = '5G'
  speedInfo.limit = false
}

async function loadFlow() {
  const data = await api('/flow')
  const sumList = Array.isArray(data?.flowSumList) ? data.flowSumList : []
  const summary = sumList[0] || {}

  let totalLeft = parseMB(summary.xcanusevalue)
  let totalUsed = parseMB(summary.xusedvalue)
  let totalFlow = parseMB(summary.xtotalvalue)

  if (!totalFlow && (totalLeft || totalUsed)) totalFlow = totalLeft + totalUsed

  flowSummary.remain = totalLeft
  flowSummary.used = totalUsed
  flowSummary.total = totalFlow
  flowSummary.percent = totalFlow > 0 ? Math.round((totalUsed / totalFlow) * 100) : 0
  flowSummary.remainText = fmtFlow(totalLeft)
  flowSummary.usedText = fmtFlow(totalUsed)
  flowSummary.totalText = fmtFlow(totalFlow)

  const rawItems = collectFlowPackages(data)
  let cards = rawItems
    .map((item, idx) => normalizeUnicomFlowItem(item, idx))
    .filter(item => item.name && (item.total > 0 || item.used > 0 || item.left > 0))

  cards = uniqBy(cards, item => `${item.name}_${item.total}_${item.used}_${item.left}`)

  if (cards.length > 1) {
    cards = cards.filter(item => {
      const same =
        Math.abs(item.left - totalLeft) < 0.01 &&
        Math.abs(item.used - totalUsed) < 0.01 &&
        Math.abs(item.total - totalFlow) < 0.01
      if (!same) return true
      return /总|主套餐|套餐总流量|总流量/.test(item.name)
    })
  }

  cards.sort((a, b) => {
    const score = x => {
      if (/总|主套餐|套餐总流量|总流量/.test(x.name)) return 1
      if (!x.exclusive) return 2
      if (x.exclusive) return 3
      return 9
    }
    return score(a) - score(b)
  })

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
    }]
  }

  flowCards.value = cards
}

async function loadSpeed() {
  const data = await api('/speed')
  const downRaw = firstNonEmpty(
    dig(data, 'downRate', 'downloadRate', 'downSpeed', 'downloadSpeed', 'downBandwidth', 'dlRate'),
    data?.rateResource?.rate
  )
  speedInfo.dl = typeof downRaw === 'string'
    ? downRaw.replace(/Mbps/i, '').trim()
    : fmtNumber(downRaw)

  const upRaw = firstNonEmpty(
    dig(data, 'upRate', 'uploadRate', 'upSpeed', 'uploadSpeed', 'upBandwidth', 'ulRate'),
    data?.upRate
  )
  speedInfo.ul = fmtNumber(upRaw)

  speedInfo.qci = firstNonEmpty(dig(data, 'qci', 'QCI', 'qciLevel', 'qciValue', 'qciCode'), '—')
  speedInfo.net = firstNonEmpty(dig(data, 'networkType', 'netType', 'network', 'accessType', 'netTypeName'), data?.terminalResource?.terminal, '5G')

  const stateFlag = firstNonEmpty(
    dig(data, 'limitFlag', 'isLimit', 'speedLimit', 'isLimitSpeed', 'limitStatus'),
    data?.networkStirchResource?.state
  )
  speedInfo.limit = ['0', 0, 'true', true, 'yes', 'limited', 'LIMITED'].includes(stateFlag)
}

async function loadBiz() {
  const data = await api('/biz')
  bizList.value = pickBizList(data)
}

async function loadAll() {
  await Promise.allSettled([loadBiz(), loadFlow(), loadSpeed()])
}

async function refreshAll() {
  loading.refresh = true
  try {
    await loadAll()
  } finally {
    loading.refresh = false
  }
}

function getBizName(b) {
  return firstNonEmpty(b.serviceName, b.name, b.productName, b.offerName, b.bizName, b.spName, '业务')
}
function getBizDate(b) {
  return firstNonEmpty(b.subscribeDate, b.createDate, b.orderDate, b.startDate, b.orderTime, b.orderTimeStr, '')
}
function getBizStatus(b) {
  if (b.orderStatus === '0') return '生效中'
  if (b.orderStatus === '1') return '处理中'
  return '已订购'
}
function getBizPriceText(b) {
  let price = firstNonEmpty(b.price, b.fee, b.month_fee, b.monthFee, b.chargeFee, b.cost, b.amount, b.productFee)
  if (!price) price = extractPriceFromName(getBizName(b))
  return price ? `¥${price}/月` : '套餐'
}
</script>

<style scoped>
:root{
  --bg:#f5f7fb;
  --card:#ffffff;
  --text:#0f172a;
  --text-2:#475569;
  --text-3:#94a3b8;
  --line:#e9edf5;
}
*{box-sizing:border-box}
.page{
  min-height:100vh;
  background:#f5f7fb;
  color:#0f172a;
  font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",Segoe UI,Roboto,Helvetica,Arial,sans-serif;
  width:min(1180px, calc(100% - 32px));
  margin:0 auto;
  padding:12px 0 32px;
}
.header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:8px 0 18px}
.header-title{font-size:24px;font-weight:800}
.header-user{display:flex;align-items:center;gap:12px}
.login-sub{color:#94a3b8;font-size:14px;margin-top:6px}
.btn-primary,.btn-ghost,.refresh-btn,.flow-toggle-btn,.tab-btn{border:none;outline:none;cursor:pointer;transition:all .2s ease}
.btn-primary{background:#2563eb;color:#fff;border-radius:14px;padding:12px 18px;font-weight:700}
.btn-primary.full{width:100%}
.btn-primary:disabled{opacity:.7;cursor:not-allowed}
.btn-ghost{background:#fff;border:1px solid #e9edf5;color:#475569;border-radius:14px;padding:10px 16px}
.login-wrap{width:min(460px, calc(100% - 16px));margin:40px auto;background:#fff;border:1px solid #e9edf5;border-radius:28px;box-shadow:0 10px 30px rgba(15,23,42,.06);padding:28px}
.login-title{font-size:28px;font-weight:800;margin-bottom:8px}
.tabs{display:flex;gap:8px;background:#f8fafc;border-radius:16px;padding:6px;margin:20px 0}
.tab-btn{flex:1;background:transparent;border-radius:12px;padding:10px 12px;font-weight:700;color:#475569}
.tab-btn.active{background:#fff;color:#2563eb;box-shadow:0 4px 12px rgba(37,99,235,.10)}
.form-group{margin-bottom:14px}
.form-end{display:flex;justify-content:flex-end}
input{width:100%;border:1px solid #e9edf5;background:#fff;border-radius:16px;padding:14px 16px;font-size:15px}
input:focus{border-color:#93c5fd;box-shadow:0 0 0 4px rgba(59,130,246,.10);outline:none}
.msg{min-height:20px;margin-top:8px;font-size:13px;opacity:0;transition:.2s}
.msg.show{opacity:1}
.msg.ok{color:#059669}
.msg.err{color:#ef4444}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:22px}
.stat-card{background:#fff;border:1px solid #e9edf5;border-radius:22px;box-shadow:0 10px 30px rgba(15,23,42,.06);padding:28px 20px 22px;text-align:center}
.stat-card.active{background:rgba(37,99,235,.08);border-color:#3b82f6}
.stat-value{font-size:24px;font-weight:800}
.stat-label{margin-top:10px;color:#475569;font-size:14px}
.panel{background:#fff;border:1px solid #e9edf5;border-radius:24px;box-shadow:0 10px 30px rgba(15,23,42,.06);padding:26px;margin-bottom:22px}
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
.panel-title{font-size:18px;font-weight:800}
.panel-tools{display:flex;align-items:center;gap:10px}
.refresh-btn{background:#fff;color:#64748b;border:1px solid #e9edf5;padding:10px 16px;border-radius:14px}
.flow-summary-box{margin-bottom:18px}
.main-bar-bg{width:100%;height:12px;background:#eef2f7;border-radius:999px;overflow:hidden}
.main-bar{height:100%;border-radius:999px;transition:width .35s ease}
.bar-labels{margin-top:12px;display:flex;justify-content:space-between;color:#64748b;font-size:14px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.flow-grid{display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px}
.flow-grid-more{margin-top:16px}
.flow-card{background:#fff;border-radius:22px;padding:24px 26px;border:1px solid #e9edf5;box-shadow:0 8px 24px rgba(15,23,42,.06)}
.flow-card.compact{padding:22px}
.flow-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.flow-card-title{font-size:16px;line-height:1.5;color:#111827;font-weight:500;word-break:break-word}
.flow-card-icon{width:66px;height:66px;border-radius:20px;background:#f5f5f7;display:flex;align-items:center;justify-content:center;font-size:30px;color:#111827;flex-shrink:0}
.flow-card-value{margin-top:10px;font-size:38px;line-height:1.08;font-weight:800;color:#111827;letter-spacing:-1px}
.flow-card-sub{margin-top:14px;display:flex;flex-direction:column;gap:6px;color:#64748b;font-size:14px}
.flow-card-tags{margin-top:16px;display:flex;flex-wrap:wrap;gap:10px}
.flow-tag{display:inline-flex;align-items:center;justify-content:center;padding:5px 12px;border-radius:999px;font-size:14px;line-height:1;border:1px solid transparent;white-space:nowrap}
.flow-tag.green{color:#059669;background:#ecfdf5;border-color:#86efac}
.flow-tag.gray{color:#334155;background:#f8fafc;border-color:#dbe3ee}
.flow-tag.slate{color:#475569;background:#f1f5f9;border-color:#cbd5e1}
.flow-tag.yellow{color:#b45309;background:#fff7ed;border-color:#fbbf24}
.flow-card-foot{margin-top:22px;display:flex;justify-content:space-between;align-items:center;color:#475569;font-size:14px}
.flow-card-bar-bg{margin-top:10px;width:100%;height:11px;background:#eff2f7;border-radius:999px;overflow:hidden}
.flow-card-bar{height:100%;border-radius:999px;transition:width .35s ease}
.flow-more-head{margin-top:20px;margin-bottom:10px;padding:6px 2px;display:flex;justify-content:space-between;align-items:center;color:#1e293b;font-size:18px;font-weight:500}
.flow-toggle-btn{background:transparent;color:#64748b;font-size:14px}
.speed-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
.speed-block.modern{display:flex;align-items:center;gap:14px;border-radius:18px;background:linear-gradient(180deg,#f8fafc,#eef2ff);border:1px solid #e5e7eb;padding:18px}
.speed-icon{width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:22px}
.speed-icon.dl{color:#2563eb;background:#dbeafe}
.speed-icon.ul{color:#059669;background:#dcfce7}
.speed-val{font-size:34px;font-weight:800;line-height:1}
.speed-unit{margin-top:8px;color:#64748b;font-size:14px}
.info-rows{display:flex;flex-direction:column}
.info-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid #eef2f7}
.info-key{color:#64748b;font-size:15px}
.info-val{color:#111827;font-size:15px;font-weight:500}
.pkg-pct{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;font-size:14px;font-weight:700}
.pkg-pct.green{background:#dcfce7;color:#15803d}
.pkg-pct.amber{background:#fef3c7;color:#b45309}
.biz-card{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid #eef2f7}
.biz-card:last-child{border-bottom:none}
.biz-card-left{display:flex;align-items:flex-start;gap:12px;min-width:0}
.biz-dot{width:10px;height:10px;border-radius:999px;margin-top:8px;flex-shrink:0}
.biz-dot.blue{background:#3b82f6;box-shadow:0 0 0 6px rgba(59,130,246,.10)}
.biz-dot.green{background:#10b981;box-shadow:0 0 0 6px rgba(16,185,129,.10)}
.biz-content{min-width:0}
.biz-name{font-size:18px;font-weight:700;color:#111827;line-height:1.4;word-break:break-word}
.biz-sub{margin-top:6px;display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:#94a3b8}
.biz-status{color:#059669;font-weight:600}
.biz-card-right{flex-shrink:0}
.biz-tag{display:inline-flex;align-items:center;padding:8px 14px;border-radius:999px;background:#eff6ff;color:#2563eb;font-weight:700;font-size:14px}
.badge{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:#eff6ff;color:#2563eb;font-size:13px;font-weight:700}
.empty-tip{padding:26px 12px;text-align:center;color:#94a3b8;font-size:14px}
.footer{padding:18px 0 28px;text-align:center;color:#94a3b8;font-size:13px}
@media (max-width:980px){.stats-grid{grid-template-columns:repeat(2,1fr)}.two-col{grid-template-columns:1fr}}
@media (max-width:768px){.page{width:min(100% - 20px,100%)}.stats-grid{grid-template-columns:1fr 1fr;gap:12px}.panel{padding:18px;border-radius:20px}.flow-grid{grid-template-columns:1fr}.speed-pair{grid-template-columns:1fr}.flow-card-value{font-size:32px}.speed-val{font-size:28px}.biz-card{flex-direction:column;align-items:flex-start}}
</style>