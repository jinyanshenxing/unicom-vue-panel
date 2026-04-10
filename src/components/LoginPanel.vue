<template>
  <div class="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -right-40 w-96 h-96 rounded-full"
           style="background: radial-gradient(circle, rgba(230,0,18,0.08) 0%, transparent 70%)"></div>
      <div class="absolute -bottom-40 -left-40 w-96 h-96 rounded-full"
           style="background: radial-gradient(circle, rgba(230,0,18,0.05) 0%, transparent 70%)"></div>
      <!-- 网格线 -->
      <svg class="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e60012" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>

    <div class="w-full max-w-md animate-slide-up relative z-10">
      <!-- Logo -->
      <div class="text-center mb-10">
        <div class="inline-flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
               style="background: #e60012;">U</div>
          <span class="font-display text-2xl tracking-widest text-white">UNICOM</span>
        </div>
        <p class="text-unicom-muted text-sm font-display tracking-wider">余量面板 · 速率查询</p>
      </div>

      <!-- Tab 切换 -->
      <div class="flex mb-6 bg-unicom-card border border-unicom-border rounded-xl p-1">
        <button v-for="tab in tabs" :key="tab.id"
                @click="activeTab = tab.id"
                class="flex-1 py-2 px-3 rounded-lg text-sm font-display tracking-wide transition-all duration-200"
                :class="activeTab === tab.id
                  ? 'bg-unicom-red text-white'
                  : 'text-unicom-muted hover:text-white'">
          {{ tab.label }}
        </button>
      </div>

      <!-- 短信登录 -->
      <div v-if="activeTab === 'sms'" class="space-y-4">
        <div class="group">
          <label class="block text-xs font-display text-unicom-muted mb-2 tracking-widest uppercase">手机号码</label>
          <input v-model="phone"
                 type="tel"
                 maxlength="11"
                 placeholder="请输入联通手机号"
                 class="w-full bg-unicom-card border border-unicom-border rounded-xl px-4 py-3
                        text-white font-display text-sm placeholder-gray-600
                        focus:border-unicom-red transition-colors duration-200" />
        </div>

        <div class="group">
          <label class="block text-xs font-display text-unicom-muted mb-2 tracking-widest uppercase">验证码</label>
          <div class="flex gap-3">
            <input v-model="smsCode"
                   type="text"
                   maxlength="6"
                   placeholder="6 位验证码"
                   class="flex-1 bg-unicom-card border border-unicom-border rounded-xl px-4 py-3
                          text-white font-display text-sm placeholder-gray-600
                          focus:border-unicom-red transition-colors duration-200" />
            <button @click="sendCode"
                    :disabled="codeSending || countdown > 0"
                    class="px-4 py-3 rounded-xl border font-display text-sm whitespace-nowrap transition-all duration-200"
                    :class="countdown > 0
                      ? 'border-unicom-border text-unicom-muted cursor-not-allowed'
                      : 'border-unicom-red text-unicom-red hover:bg-unicom-red hover:text-white'">
              {{ countdown > 0 ? `${countdown}s` : (codeSending ? '发送中' : '获取验证码') }}
            </button>
          </div>
        </div>

        <button @click="loginSms"
                :disabled="loginLoading"
                class="w-full py-3 rounded-xl font-display text-sm tracking-widest uppercase transition-all duration-200
                       flex items-center justify-center gap-2"
                style="background: #e60012; color: white;"
                :style="loginLoading ? 'opacity:0.7' : ''">
          <LoadingDots v-if="loginLoading" />
          <span v-else>登 录</span>
        </button>
      </div>

      <!-- Token 登录 -->
      <div v-if="activeTab === 'token'" class="space-y-4">
        <div class="group">
          <label class="block text-xs font-display text-unicom-muted mb-2 tracking-widest uppercase">手机号码</label>
          <input v-model="phone"
                 type="tel"
                 maxlength="11"
                 placeholder="请输入联通手机号"
                 class="w-full bg-unicom-card border border-unicom-border rounded-xl px-4 py-3
                        text-white font-display text-sm placeholder-gray-600
                        focus:border-unicom-red transition-colors duration-200" />
        </div>

        <div class="group">
          <label class="block text-xs font-display text-unicom-muted mb-2 tracking-widest uppercase">ECS Token</label>
          <textarea v-model="ecsToken"
                    rows="3"
                    placeholder="粘贴 ecs_token 内容"
                    class="w-full bg-unicom-card border border-unicom-border rounded-xl px-4 py-3
                           text-white font-display text-xs placeholder-gray-600 resize-none
                           focus:border-unicom-red transition-colors duration-200"></textarea>
          <p class="text-xs text-unicom-muted mt-1">
            在联通 App 抓包获取 ecs_token，可免验证码直接登录
          </p>
        </div>

        <button @click="loginToken"
                :disabled="loginLoading"
                class="w-full py-3 rounded-xl font-display text-sm tracking-widest uppercase transition-all duration-200
                       flex items-center justify-center"
                style="background: #e60012; color: white;"
                :style="loginLoading ? 'opacity:0.7' : ''">
          <LoadingDots v-if="loginLoading" />
          <span v-else>TOKEN 登录</span>
        </button>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMsg" class="mt-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-display">
        {{ errorMsg }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { sendSmsCode, loginWithSms, loginWithToken } from '../utils/api.js'
import { useUnicomStore } from '../composables/store.js'
import LoadingDots from './LoadingDots.vue'

const store = useUnicomStore()
const emit = defineEmits(['logged-in'])

const tabs = [
  { id: 'sms', label: '短信验证码' },
  { id: 'token', label: 'ECS Token' }
]
const activeTab = ref('sms')

const phone = ref('')
const smsCode = ref('')
const ecsToken = ref('')
const countdown = ref(0)
const codeSending = ref(false)
const loginLoading = ref(false)
const errorMsg = ref('')

async function sendCode() {
  if (!phone.value || phone.value.length !== 11) {
    errorMsg.value = '请输入正确的11位手机号'
    return
  }
  codeSending.value = true
  errorMsg.value = ''
  try {
    const res = await sendSmsCode(phone.value)
    if (res?.result === '0' || res?.code === '0') {
      countdown.value = 60
      const timer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) clearInterval(timer)
      }, 1000)
    } else {
      errorMsg.value = res?.desc || res?.message || '发送失败，请稍后重试'
    }
  } catch (e) {
    errorMsg.value = '网络错误，请检查后端代理配置'
  } finally {
    codeSending.value = false
  }
}

async function loginSms() {
  if (!phone.value || !smsCode.value) {
    errorMsg.value = '请填写手机号和验证码'
    return
  }
  loginLoading.value = true
  errorMsg.value = ''
  try {
    const res = await loginWithSms(phone.value, smsCode.value)
    if (res?.result === '0' || res?.code === '0') {
      const tk = res?.ecs_token || res?.token || res?.data?.ecs_token || ''
      store.setLogin(phone.value, tk)
      emit('logged-in')
    } else {
      errorMsg.value = res?.desc || res?.message || '登录失败'
    }
  } catch (e) {
    errorMsg.value = '网络错误，请检查代理配置'
  } finally {
    loginLoading.value = false
  }
}

async function loginToken() {
  if (!phone.value || !ecsToken.value) {
    errorMsg.value = '请填写手机号和 ECS Token'
    return
  }
  loginLoading.value = true
  errorMsg.value = ''
  try {
    await loginWithToken(phone.value, ecsToken.value.trim())
    store.setLogin(phone.value, ecsToken.value.trim())
    emit('logged-in')
  } catch (e) {
    errorMsg.value = '登录失败'
  } finally {
    loginLoading.value = false
  }
}
</script>
