<template>
  <div class="bg-unicom-card border border-unicom-border rounded-2xl p-5 card-hover animate-slide-up">
    <div class="flex items-start justify-between mb-4">
      <div>
        <div class="text-xs font-display text-unicom-muted tracking-widest uppercase mb-1">{{ title }}</div>
        <div class="text-2xl font-display font-medium text-white glow-text">{{ displayValue }}</div>
      </div>
      <div class="w-9 h-9 rounded-lg flex items-center justify-center" :style="`background: ${color}22`">
        <span class="text-lg" :style="`color: ${color}`">{{ icon }}</span>
      </div>
    </div>

    <!-- 进度条 -->
    <div v-if="showProgress" class="space-y-2">
      <div class="flex justify-between text-xs font-display text-unicom-muted">
        <span>已用 {{ usedDisplay }}</span>
        <span>共 {{ totalDisplay }}</span>
      </div>
      <div class="h-1.5 bg-black/40 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-1000"
             :class="percent > 80 ? 'progress-bar' : ''"
             :style="`width: ${percent}%; background: ${percent <= 80 ? color : ''}`"></div>
      </div>
      <div class="text-right text-xs font-display" :style="`color: ${color}`">{{ percent }}%</div>
    </div>

    <!-- 标签 -->
    <div v-if="tag" class="mt-3">
      <span class="inline-block px-2 py-0.5 rounded text-xs font-display"
            :style="`background: ${color}22; color: ${color}`">{{ tag }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: String,
  displayValue: String,
  icon: String,
  color: { type: String, default: '#e60012' },
  showProgress: Boolean,
  usedDisplay: String,
  totalDisplay: String,
  percent: { type: Number, default: 0 },
  tag: String
})
</script>
