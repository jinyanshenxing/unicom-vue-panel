<template>
  <div class="bg-zinc-900 rounded-3xl p-8">
    <h3 class="text-xl font-semibold mb-6 flex items-center gap-2">📊 流量余量</h3>
    <div class="text-7xl font-black text-emerald-400 mb-2">{{ remainGB }}<span class="text-3xl">GB</span></div>
    
    <div class="h-4 bg-zinc-800 rounded-full overflow-hidden my-6">
      <div class="h-full bg-gradient-to-r from-emerald-400 to-blue-500 transition-all duration-700" 
           :style="{ width: usedPercent + '%' }"></div>
    </div>

    <div class="grid grid-cols-2 gap-8 text-sm">
      <div>已用 <span class="font-mono text-lg">{{ usedGB }} GB</span></div>
      <div class="text-right">总量 <span class="font-mono text-lg">{{ totalGB }} GB</span></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ flowData: Object })

const remainGB = computed(() => {
  // 根据实际接口结构调整字段名
  const left = props.flowData?.result?.leftFlow || 0
  return (left / 1024).toFixed(1)
})
const usedGB = computed(() => '暂未解析')   // 可自行完善
const totalGB = computed(() => '暂未解析')
const usedPercent = computed(() => 65)       // 可根据数据计算
</script>