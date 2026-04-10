import axios from 'axios'

const BASE = '/api/unicom'
const LOGIN_BASE = '/api/login'

// 通用请求头
const commonHeaders = () => ({
  'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
  'Referer': 'https://m.client.10010.com/',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; ) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile Safari/537.36'
})

// 从 localStorage 读取 token
const getToken = () => localStorage.getItem('ecs_token') || ''
const getPhone = () => localStorage.getItem('phone') || ''

/**
 * 发送验证码
 */
export async function sendSmsCode(phone) {
  const params = new URLSearchParams({
    mobileNumber: phone,
    operType: '01',
    flag: '0',
    verifyCode: '',
    loginType: '0'
  })
  const res = await axios.post(`${BASE}/mobileService/sendRadomNum.htm`, params, {
    headers: commonHeaders()
  })
  return res.data
}

/**
 * 随机登录（验证码登录）
 */
export async function loginWithSms(phone, code) {
  const params = new URLSearchParams({
    mobileNumber: phone,
    verifyCode: code,
    operType: '01',
    loginType: '0'
  })
  const res = await axios.post(`${BASE}/mobileService/radomLogin.htm`, params, {
    headers: commonHeaders()
  })
  return res.data
}

/**
 * ecs_token 登录（直接传 token）
 */
export async function loginWithToken(phone, token) {
  // 直接存储，不需要实际登录请求
  localStorage.setItem('phone', phone)
  localStorage.setItem('ecs_token', token)
  return { result: '0', desc: '登录成功' }
}

/**
 * 查询已订业务
 */
export async function queryOrderedBusiness() {
  const params = new URLSearchParams({
    mobileNumber: getPhone(),
    token: getToken(),
    pageIndex: '1',
    pageSize: '20'
  })
  const res = await axios.post(
    `${BASE}/servicebusiness/newOrdered/queryOrderRelationship`,
    params,
    { headers: { ...commonHeaders(), 'ecs_token': getToken() } }
  )
  return res.data
}

/**
 * 查询 5G 余量信息（流量包）
 */
export async function queryFlowInfo() {
  const params = new URLSearchParams({
    mobileNumber: getPhone(),
    token: getToken()
  })
  const res = await axios.post(
    `${BASE}/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune`,
    params,
    { headers: { ...commonHeaders(), 'ecs_token': getToken() } }
  )
  return res.data
}

/**
 * 查询速率和 QCI
 */
export async function querySpeedAndQci() {
  const params = new URLSearchParams({
    mobileNumber: getPhone(),
    token: getToken()
  })
  const res = await axios.post(
    `${BASE}/servicebusiness/query/fiveg/getbasicdata`,
    params,
    { headers: { ...commonHeaders(), 'ecs_token': getToken() } }
  )
  return res.data
}

/**
 * 格式化流量（MB -> 合适单位）
 */
export function formatFlow(mb) {
  if (mb === null || mb === undefined || mb === '') return '—'
  const num = parseFloat(mb)
  if (isNaN(num)) return mb
  if (num >= 1024) return (num / 1024).toFixed(2) + ' GB'
  return num.toFixed(0) + ' MB'
}

/**
 * 计算使用百分比
 */
export function calcPercent(used, total) {
  if (!total || total === 0) return 0
  return Math.min(100, Math.round((used / total) * 100))
}
