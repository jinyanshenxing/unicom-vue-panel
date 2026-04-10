<template>
  <div class="min-h-screen pb-20">
    <!-- 顶部导航 -->
    <header class="sticky top-0 z-40 border-b backdrop-blur-sm"
            :style="isDark
              ? 'background:rgba(13,13,13,0.85); border-color:#2a2a2a'
              : 'background:rgba(244,244,245,0.85); border-color:#e4e4e7'">
      <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-md flex items-center justify-center text-white text-sm font-bold"
               style="background:#e60012">U</div>
          <span class="font-display text-sm tracking-widest" :style="isDark ? 'color:#fff' : 'color:#18181b'">余量面板</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-display text-xs hidden sm:block" :style="isDark ? 'color:#888' : 'color:#71717a'">{{ maskedPhone }}</span>
          <button @click="refresh" :disabled="store.loading"
                  class="w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200"
                  :style="isDark ? 'border-color:#2a2a2a; color:#888' : 'border-color:#e4e4e7; color:#71717a'"
                  title="刷新">
            <svg class="w-4 h-4" :class="store.loading ? 'animate-spin' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
          <button @click="store.logout"
                  class="w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200"
                  :style="isDark ? 'border-color:#2a2a2a; color:#888' : 'border-color:#e4e4e7; color:#71717a'"
                  title="退出">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div class="max-w-2xl mx-auto px-4 pt-6 space-y-6">

      <!-- 骨架屏 -->
      <div v-if="store.loading && !hasData" class="space-y-4">
        <div v-for="i in 4" :key="i" class="h-32 rounded-2xl animate-pulse"
             :style="isDark ? 'background:#161616; border:1px solid #2a2a2a' : 'background:#e4e4e7; border:1px solid #d4d4d8'"></div>
      </div>

      <!-- 错误提示 -->
      <div v-if="store.error" class="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 font-display text-sm">
        <div class="flex items-center gap-2 mb-1"><span>⚠</span><span class="font-medium">请求失败</span></div>
        <p class="text-xs opacity-70">{{ store.error }}</p>
        <p class="text-xs opacity-50 mt-1">请确认 Token 是否过期，或后端代理是否正常</p>
      </div>

      <!-- 速率 & QCI -->
      <section v-if="speedData">
        <SectionTitle :is-dark="isDark">速率 & QCI</SectionTitle>
        <div class="grid grid-cols-2 gap-3 mt-3">
          <FlowCard :is-dark="isDark" title="当前速率" :display-value="speedRate" icon="⚡" color="#e60012" :tag="speedData?.data?.speedLevel || speedData?.speedLevel" />
          <FlowCard :is-dark="isDark" title="QCI 等级" :display-value="qciValue" icon="📶" color="#ff6622" :tag="qciTag" />
        </div>
        <div v-if="speedDetails.length" class="mt-3 rounded-2xl border p-4"
             :style="isDark ? 'background:#161616; border-color:#2a2a2a' : 'background:#fff; border-color:#e4e4e7'">
          <div class="text-xs font-display tracking-widest uppercase mb-3" :style="isDark ? 'color:#888' : 'color:#71717a'">速率详情</div>
          <div class="space-y-0">
            <div v-for="item in speedDetails" :key="item.label"
                 class="flex justify-between items-center py-2 border-b last:border-0"
                 :style="isDark ? 'border-color:#2a2a2a22' : 'border-color:#f4f4f522'">
              <span class="text-xs font-display" :style="isDark ? 'color:#888' : 'color:#71717a'">{{ item.label }}</span>
              <span class="text-sm font-display" :style="isDark ? 'color:#fff' : 'color:#18181b'">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 流量余量 -->
      <section v-if="flowPackages.length">
        <SectionTitle :is-dark="isDark">流量余量</SectionTitle>
        <div class="space-y-3 mt-3">
          <div v-for="(pkg, idx) in flowPackages" :key="idx"
               class="rounded-2xl border p-4 transition-all duration-200"
               :style="isDark
                 ? 'background:#161616; border-color:#2a2a2a'
                 : 'background:#fff; border-color:#e4e4e7'">
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="text-xs font-display mb-1" :style="isDark ? 'color:#888' : 'color:#71717a'">{{ pkg.name || '流量包' }}</div>
                <div class="text-xl font-display" :style="isDark ? 'color:#fff' : 'color:#18181b'">{{ formatFlow(pkg.left) }}</div>
                <div class="text-xs mt-0.5" :style="isDark ? 'color:#666' : 'color:#a1a1aa'">剩余 / 共 {{ formatFlow(pkg.total) }}</div>
              </div>
              <span class="inline-block px-2 py-0.5 rounded text-xs font-display"
                    :style="pkg.isHidden ? 'background:#ff660022;color:#ff6600' : 'background:#e6001222;color:#e60012'">
                {{ pkg.isHidden ? '隐藏包' : '流量包' }}
              </span>
            </div>
            <div class="h-1.5 rounded-full overflow-hidden" :style="isDark ? 'background:rgba(0,0,0,0.4)' : 'background:#f4f4f5'">
              <div class="h-full rounded-full transition-all duration-1000"
                   :style="`width:${calcPercent(pkg.used,pkg.total)}%; background:${pkg.isHidden ? '#ff6600' : '#e60012'}`"></div>
            </div>
            <div class="flex justify-between text-xs font-display mt-1.5" :style="isDark ? 'color:#666' : 'color:#a1a1aa'">
              <span>已用 {{ formatFlow(pkg.used) }}</span>
              <span>{{ calcPercent(pkg.used, pkg.total) }}%</span>
            </div>
            <div v-if="pkg.expireDate" class="mt-2 text-xs font-display" :style="isDark ? 'color:#555' : 'color:#a1a1aa'">
              有效期至 {{ pkg.expireDate }}
            </div>
          </div>
        </div>
      </section>

      <!-- 已订业务 -->
      <section v-if="orderedList.length">
        <SectionTitle :is-dark="isDark">已订业务</SectionTitle>
        <div class="mt-3 rounded-2xl border overflow-hidden"
             :style="isDark ? 'background:#161616; border-color:#2a2a2a' : 'background:#fff; border-color:#e4e4e7'">
          <div v-for="(item, idx) in orderedList" :key="idx"
               class="flex items-center justify-between px-4 py-3 border-b last:border-0"
               :style="isDark ? 'border-color:#2a2a2a' : 'border-color:#f4f4f5'">
            <div>
              <div class="text-sm font-display" :style="isDark ? 'color:#fff' : 'color:#18181b'">{{ item.name || item.businessName || '未知业务' }}</div>
              <div class="text-xs mt-0.5" :style="isDark ? 'color:#666' : 'color:#a1a1aa'">{{ item.fee || item.price || '' }}</div>
            </div>
            <span class="inline-block px-2 py-0.5 rounded text-xs font-display"
                  :style="item.status === '0' ? 'background:#00cc4422;color:#00cc44' : 'background:#88888822;color:#888'">
              {{ item.status === '0' ? '生效中' : (item.statusName || item.status || '—') }}
            </span>
          </div>
        </div>
      </section>

      <!-- 首次加载 -->
      <div v-if="!store.loading && !hasData && !store.error" class="text-center py-16">
        <div class="text-4xl mb-4">🔄</div>
        <div class="font-display text-sm mb-4" :style="isDark ? 'color:#888' : 'color:#71717a'">点击下方按钮加载数据</div>
        <button @click="refresh" class="px-6 py-2 rounded-xl font-display text-sm text-white" style="background:#e60012">加载数据</button>
      </div>

      <div v-if="hasData" class="text-center pt-4 pb-2">
        <p class="text-xs font-display" :style="isDark ? 'color:#333' : 'color:#d4d4d8'">数据来源于联通官方接口 · 仅供个人使用</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useUnicomStore } from '../composables/store.js'
import { formatFlow, calcPercent } from '../utils/api.js'
import FlowCard from './FlowCard.vue'
import SectionTitle from './SectionTitle.vue'

const props = defineProps({ isDark: Boolean })
const store = useUnicomStore()

const maskedPhone = computed(() => {
  const p = store.phone
  if (!p || p.length < 7) return p
  return p.slice(0, 3) + '****' + p.slice(7)
})

const hasData = computed(() => !!(store.flowData || store.speedData || store.orderedData))
const speedData = computed(() => store.speedData)

const speedRate = computed(() => {
  const d = store.speedData?.data || store.speedData
  if (!d) return '—'
  return d.downSpeed || d.downloadSpeed || d.speed || d.down || '—'
})

const qciValue = computed(() => {
  const d = store.speedData?.data || store.speedData
  return d?.qci || d?.QCI || '—'
})

const qciTag = computed(() => {
  const n = parseInt(qciValue.value)
  if (isNaN(n)) return ''
  if (n <= 6) return '高优先级'
  if (n <= 8) return '普通'
  return '低优先级'
})

const speedDetails = computed(() => {
  const d = store.speedData?.data || store.speedData
  if (!d) return []
  const map = { downSpeed:'下行速率', uploadSpeed:'上行速率', upSpeed:'上行速率', downloadSpeed:'下行速率', speed:'网速', bandwidth:'带宽', signalLevel:'信号强度', networkType:'网络类型', apn:'APN' }
  return Object.entries(map).filter(([k]) => d[k]).map(([k, label]) => ({ label, value: d[k] }))
})

const flowPackages = computed(() => {
  const d = store.flowData
  if (!d) return []
  const list = d.data?.packageList || d.data?.list || d.packageList || d.list || d.data || []
  if (!Array.isArray(list)) return []
  return list.map(item => ({
    name: item.packageName || item.name || item.title || '流量包',
    left: item.leftFlow || item.remaining || item.leftAmount || item.left || 0,
    used: item.usedFlow || item.used || item.usedAmount || 0,
    total: item.totalFlow || item.total || item.totalAmount || 0,
    expireDate: item.expireDate || item.validDate || item.endDate || '',
    isHidden: item.isHidden === '1' || item.hidden || item.type === 'hidden'
  })).filter(p => p.total > 0 || p.left > 0)
})

const orderedList = computed(() => {
  const d = store.orderedData
  if (!d) return []
  return d.data?.list || d.data?.businessList || d.list || d.businessList || []
})

function refresh() { store.fetchAll() }
onMounted(() => { if (!hasData.value) store.fetchAll() })
</script>
