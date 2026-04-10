<template>
  <div :class="isDark ? 'dark' : ''" class="min-h-screen">
    <div class="min-h-screen transition-colors duration-300"
         :style="isDark
           ? 'background:#0d0d0d; color:#e8e8e8'
           : 'background:#f4f4f5; color:#18181b'">

      <!-- 主题切换按钮（悬浮） -->
      <button @click="toggleTheme"
              class="fixed bottom-5 right-5 z-50 w-11 h-11 rounded-full shadow-lg
                     flex items-center justify-center text-lg transition-all duration-200
                     hover:scale-110 active:scale-95"
              :style="isDark
                ? 'background:#1e1e1e; border:1px solid #333'
                : 'background:#ffffff; border:1px solid #ddd'"
              :title="isDark ? '切换到白天模式' : '切换到暗色模式'">
        {{ isDark ? '☀️' : '🌙' }}
      </button>

      <transition name="fade" mode="out-in">
        <LoginPanel v-if="!store.isLoggedIn" key="login"
                    :is-dark="isDark"
                    @logged-in="store.fetchAll()" />
        <Dashboard v-else key="dashboard"
                   :is-dark="isDark" />
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useUnicomStore } from './composables/store.js'
import LoginPanel from './components/LoginPanel.vue'
import Dashboard from './components/Dashboard.vue'

const store = useUnicomStore()

const savedTheme = localStorage.getItem('theme')
const isDark = ref(savedTheme ? savedTheme === 'dark' : true)

function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
