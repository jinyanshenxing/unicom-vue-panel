<template>
  <div class="bg-zinc-900 rounded-3xl p-10">
    <h2 class="text-2xl font-semibold mb-8 text-center">ECS Token 登录</h2>
    
    <input v-model="tokenInput" type="text" placeholder="粘贴你的 ecs_token"
      class="w-full bg-zinc-800 border border-zinc-700 focus:border-blue-500 rounded-2xl px-6 py-5 text-lg outline-none mb-6" />

    <button @click="submit" 
      class="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-semibold text-lg transition">
      验证并登录
    </button>

    <div class="mt-8 text-xs text-zinc-400 leading-relaxed">
      如何获取 ecs_token：<br>
      1. 打开手机浏览器访问 <span class="text-blue-400">m.client.10010.com</span><br>
      2. 登录你的联通账号<br>
      3. 按 F12 → Application → Cookies → 找到 <code class="bg-zinc-800 px-1">ecs_token</code> 复制
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const emit = defineEmits(['login'])
const tokenInput = ref('')

const submit = () => {
  if (!tokenInput.value.trim()) return alert('请输入 Token')
  emit('login', tokenInput.value.trim())
}
</script>