<template>
  <div class="card">
    <div class="tabs">
      <button
        class="tab"
        :class="{ active: mode === 'sms' }"
        @click="mode = 'sms'"
      >
        短信登录
      </button>
      <button
        class="tab"
        :class="{ active: mode === 'token' }"
        @click="mode = 'token'"
      >
        Token 登录
      </button>
    </div>

    <div v-if="mode === 'sms'" class="form">
      <div class="form-item">
        <label>手机号</label>
        <input v-model="smsForm.mobile" placeholder="请输入手机号" />
      </div>

      <div class="form-item">
        <label>验证码</label>
        <div class="inline">
          <input v-model="smsForm.code" placeholder="请输入短信验证码" />
          <button class="btn btn-secondary" @click="handleSendSms" :disabled="loading">
            发送验证码
          </button>
        </div>
      </div>

      <div class="form-item">
        <label>captcha ticket（可选）</label>
        <input v-model="smsForm.ticket" placeholder="如需滑块验证可填写" />
      </div>

      <div class="form-item">
        <label>captcha randstr（可选）</label>
        <input v-model="smsForm.randStr" placeholder="如需滑块验证可填写" />
      </div>

      <button class="btn" @click="handleSmsLogin" :disabled="loading">
        {{ loading ? '登录中...' : '短信登录' }}
      </button>
    </div>

    <div v-else class="form">
      <div class="form-item">
        <label>手机号（可选）</label>
        <input v-model="tokenForm.mobile" placeholder="用于备注展示" />
      </div>

      <div class="form-item">
        <label>ecs_token</label>
        <textarea
          v-model="tokenForm.ecs_token"
          placeholder="请输入 ecs_token"
          rows="5"
        />
      </div>

      <button class="btn" @click="handleTokenLogin" :disabled="loading">
        {{ loading ? '登录中...' : 'Token 登录' }}
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p class="tip">
      提示：联通接口可能存在风控，若失败请检查 token 是否有效或接口参数是否需要调整。
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { api } from '../api'

const emit = defineEmits(['login-success'])

const mode = ref('token')
const loading = ref(false)
const error = ref('')

const smsForm = ref({
  mobile: '',
  code: '',
  ticket: '',
  randStr: ''
})

const tokenForm = ref({
  mobile: '',
  ecs_token: ''
})

async function handleSendSms() {
  error.value = ''
  loading.value = true
  try {
    await api.sendSmsCode({
      mobile: smsForm.value.mobile,
      ticket: smsForm.value.ticket,
      randStr: smsForm.value.randStr
    })
    alert('短信发送请求已提交')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleSmsLogin() {
  error.value = ''
  loading.value = true
  try {
    const res = await api.smsLogin({
      mobile: smsForm.value.mobile,
      password: smsForm.value.code,
      code: smsForm.value.code,
      ticket: smsForm.value.ticket,
      randStr: smsForm.value.randStr
    })

    if (res.sessionUser) {
      emit('login-success', res.sessionUser)
    } else {
      error.value = '登录成功但未获取到会话，请检查返回结构'
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleTokenLogin() {
  error.value = ''
  loading.value = true
  try {
    const res = await api.tokenLogin({
      mobile: tokenForm.value.mobile,
      ecs_token: tokenForm.value.ecs_token
    })

    if (res.code === 0) {
      emit('login-success', res.data)
    } else {
      error.value = res.message || '登录失败'
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>