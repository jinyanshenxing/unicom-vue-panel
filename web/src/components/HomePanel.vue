<template>
  <div class="home">
    <div class="card user-card">
      <div>
        <h2>欢迎使用</h2>
        <p>手机号：{{ user.mobile || '未填写' }}</p>
        <p>登录方式：{{ user.loginType }}</p>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" @click="loadAll" :disabled="loading">
          刷新
        </button>
        <button class="btn btn-danger" @click="$emit('logout')">
          退出登录
        </button>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>套餐余量 / 用量</h3>
        <pre>{{ pretty(packageInfo) }}</pre>
      </div>

      <div class="card">
        <h3>5G 速率查询</h3>
        <pre>{{ pretty(speedInfo) }}</pre>
      </div>

      <div class="card full">
        <h3>已订业务</h3>
        <pre>{{ pretty(orderInfo) }}</pre>
      </div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const props = defineProps({
  user: {
    type: Object,
    required: true
  }
})

defineEmits(['logout'])

const loading = ref(false)
const error = ref('')
const packageInfo = ref(null)
const speedInfo = ref(null)
const orderInfo = ref(null)

function pretty(data) {
  return JSON.stringify(data, null, 2)
}

async function loadAll() {
  error.value = ''
  loading.value = true
  try {
    const [pkg, speed, orders] = await Promise.all([
      api.getPackage(),
      api.getSpeed(),
      api.getOrders()
    ])

    packageInfo.value = pkg.data
    speedInfo.value = speed.data
    orderInfo.value = orders.data
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAll()
})
</script>