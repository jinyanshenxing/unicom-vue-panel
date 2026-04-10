<template>
  <div class="flex items-center gap-3">
    <span class="font-display text-xs tracking-widest uppercase" :style="isDark ? 'color:#888' : 'color:#71717a'">
      <slot />
    </span>
    <div class="flex-1 h-px" :style="isDark ? 'background:#2a2a2a' : 'background:#e4e4e7'"></div>
  </div>
</template>

<script setup>
defineProps({ isDark: Boolean })
</script>
