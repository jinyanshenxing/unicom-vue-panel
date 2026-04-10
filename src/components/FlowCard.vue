<template>
  <div class="rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5"
       :style="isDark
         ? 'background:#161616; border-color:#2a2a2a'
         : 'background:#fff; border-color:#e4e4e7'">
    <div class="flex items-start justify-between mb-4">
      <div>
        <div class="text-xs font-display tracking-widest uppercase mb-1" :style="isDark ? 'color:#888' : 'color:#71717a'">{{ title }}</div>
        <div class="text-2xl font-display font-medium" :style="isDark ? 'color:#fff' : 'color:#18181b'">{{ displayValue }}</div>
      </div>
      <div class="w-9 h-9 rounded-lg flex items-center justify-center text-lg" :style="`background:${color}22`">
        <span>{{ icon }}</span>
      </div>
    </div>
    <div v-if="showProgress" class="space-y-2">
      <div class="flex justify-between text-xs font-display" :style="isDark ? 'color:#666' : 'color:#a1a1aa'">
        <span>已用 {{ usedDisplay }}</span><span>共 {{ totalDisplay }}</span>
      </div>
      <div class="h-1.5 rounded-full overflow-hidden" :style="isDark ? 'background:rgba(0,0,0,0.4)' : 'background:#f4f4f5'">
        <div class="h-full rounded-full transition-all duration-1000" :style="`width:${percent}%; background:${color}`"></div>
      </div>
      <div class="text-right text-xs font-display" :style="`color:${color}`">{{ percent }}%</div>
    </div>
    <div v-if="tag" class="mt-3">
      <span class="inline-block px-2 py-0.5 rounded text-xs font-display" :style="`background:${color}22; color:${color}`">{{ tag }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isDark: Boolean,
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
