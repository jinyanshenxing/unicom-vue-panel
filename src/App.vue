<template>
  <div class="min-h-screen bg-zinc-950 py-12">
    <div class="max-w-3xl mx-auto px-4">
      <div class="flex items-center justify-between mb-10">
        <h1 class="text-4xl font-bold flex items-center gap-4">
          <span class="text-blue-500">📶</span>
          我的联通余量面板
        </h1>
        <button v-if="token" @click="logout"
          class="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-2xl text-sm font-medium transition">
          退出登录
        </button>
      </div>

      <!-- 登录卡片 -->
      <LoginCard v-if="!token" @login="handleLogin" />

      <!-- 数据展示 -->
      <div v-else class="space-y-8">
        <div class="flex gap-3">
          <button @click="refreshAll" 
            class="flex-1 bg-emerald-600 hover:bg-emerald-500 py-4 rounded-3xl font-medium transition flex items-center justify-center gap-2">
            <span>🔄</span> 刷新全部数据
          </button>
        </div>

        <FlowCard :flowData="flowData" />
        <SpeedCard :speedData="speedData" />
        <BizCard :bizData="bizData" />

        <div class="text-center text-xs text-zinc-500 pt-8">
          Token: {{ token.substring(0, 15) }}... • 数据来自联通官方接口 • 本地代理转发
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import LoginCard from './components/LoginCard.vue'
import FlowCard from './components/FlowCard.vue'
import SpeedCard from './components/SpeedCard.vue'
import BizCard from './components/BizCard.vue'
import { queryFlow, querySpeed, queryBiz } from './api.js'

const token = ref(localStorage.getItem('unicom_token') || '')
const flowData = ref({})
const speedData = ref({})
const bizData = ref({})

const handleLogin = (newToken) => {
  token.value = newToken
  localStorage.setItem('unicom_token', newToken)
  refreshAll()
}

const logout = () => {
  token.value = ''
  localStorage.removeItem('unicom_token')
  flowData.value = speedData.value = bizData.value = {}
}

const refreshAll = async () => {
  if (!token.value) return
  try {
    flowData.value = await queryFlow(token.value)
    speedData.value = await querySpeed(token.value)
    bizData.value = await queryBiz(token.value)
  } catch (err) {
    alert('查询失败：' + err.message + '\n\n请检查 Token 是否有效或尝试刷新页面')
  }
}

onMounted(() => {
  if (token.value) refreshAll()
})
</script>