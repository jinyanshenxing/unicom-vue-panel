import axios from 'axios'

const BASE = '/api/unicom'

// Referer/User-Agent 由 Nginx 代理层统一注入，浏览器禁止前端设置这两个字段
const commonHeaders = () => ({
  'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
})

const getToken = () => localStorage.getItem('ecs_token') || ''
const getPhone = () => localStorage.getItem('phone') || ''

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

export async function loginWithToken(phone, token) {
  localStorage.setItem('phone', phone)
  localStorage.setItem('ecs_token', token)
  return { result: '0', desc: '登录成功' }
}

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

export function formatFlow(mb) {
  if (mb === null || mb === undefined || mb === '') return '—'
  const num = parseFloat(mb)
  if (isNaN(num)) return mb
  if (num >= 1024) return (num / 1024).toFixed(2) + ' GB'
  return num.toFixed(0) + ' MB'
}

export function calcPercent(used, total) {
  if (!total || total === 0) return 0
  return Math.min(100, Math.round((used / total) * 100))
}
