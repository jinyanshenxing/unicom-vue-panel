<template>
  <div class="min-h-screen bg-unicom-bg">
    <transition name="fade" mode="out-in">
      <LoginPanel v-if="!store.isLoggedIn" key="login" @logged-in="store.fetchAll()" />
      <Dashboard v-else key="dashboard" />
    </transition>
  </div>
</template>

<script setup>
import { useUnicomStore } from './composables/store.js'
import LoginPanel from './components/LoginPanel.vue'
import Dashboard from './components/Dashboard.vue'

const store = useUnicomStore()
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
