<template>
  <div class="app">
    <div class="container">
      <header class="topbar">
        <div>
          <h1 class="title">联通助手</h1>
          <p class="subtitle">支持 ecs_token 登录 / 夜间模式 / 业务查询</p>
        </div>
        <ThemeToggle :theme="theme" @toggle="toggleTheme" />
      </header>

      <LoginPanel
        v-if="!user"
        @login-success="handleLoginSuccess"
      />

      <HomePanel
        v-else
        :user="user"
        @logout="handleLogout"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from './api'
import LoginPanel from './components/LoginPanel.vue'
import HomePanel from './components/HomePanel.vue'
import ThemeToggle from './components/ThemeToggle.vue'

const user = ref(null)
const theme = ref('light')

function applyTheme(value) {
  document.documentElement.setAttribute('data-theme', value)
  localStorage.setItem('theme', value)
  theme.value = value
}

function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}

async function loadMe() {
  try {
    const res = await api.me()
    user.value = res.data
  } catch {
    user.value = null
  }
}

function handleLoginSuccess(payload) {
  user.value = payload
}

async function handleLogout() {
  await api.logout()
  user.value = null
}

onMounted(async () => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) {
    applyTheme(savedTheme)
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(prefersDark ? 'dark' : 'light')
  }

  await loadMe()
})
</script>