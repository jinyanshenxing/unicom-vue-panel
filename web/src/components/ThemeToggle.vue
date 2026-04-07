<template>
  <button class="theme-btn" @click="$emit('toggle')">
    {{ theme === 'dark' ? '🌙 深色' : '☀️ 浅色' }}
  </button>
</template>

<script setup>
defineProps({
  theme: {
    type: String,
    default: 'light'
  }
})
defineEmits(['toggle'])
</script>