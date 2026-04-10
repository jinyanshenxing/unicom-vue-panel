import { defineStore } from 'pinia'
import { ref } from 'vue'
import { queryFlowInfo, querySpeedAndQci, queryOrderedBusiness } from '../utils/api.js'

export const useUnicomStore = defineStore('unicom', () => {
  const isLoggedIn = ref(!!localStorage.getItem('ecs_token'))
  const phone = ref(localStorage.getItem('phone') || '')
  const token = ref(localStorage.getItem('ecs_token') || '')

  const flowData = ref(null)
  const speedData = ref(null)
  const orderedData = ref(null)

  const loading = ref(false)
  const error = ref('')

  function setLogin(ph, tk) {
    phone.value = ph
    token.value = tk
    localStorage.setItem('phone', ph)
    localStorage.setItem('ecs_token', tk)
    isLoggedIn.value = true
  }

  function logout() {
    phone.value = ''
    token.value = ''
    localStorage.removeItem('phone')
    localStorage.removeItem('ecs_token')
    isLoggedIn.value = false
    flowData.value = null
    speedData.value = null
    orderedData.value = null
  }

  async function fetchAll() {
    loading.value = true
    error.value = ''
    try {
      const [flow, speed, ordered] = await Promise.allSettled([
        queryFlowInfo(),
        querySpeedAndQci(),
        queryOrderedBusiness()
      ])
      if (flow.status === 'fulfilled') flowData.value = flow.value
      if (speed.status === 'fulfilled') speedData.value = speed.value
      if (ordered.status === 'fulfilled') orderedData.value = ordered.value
    } catch (e) {
      error.value = e.message || '查询失败'
    } finally {
      loading.value = false
    }
  }

  return {
    isLoggedIn, phone, token,
    flowData, speedData, orderedData,
    loading, error,
    setLogin, logout, fetchAll
  }
})
