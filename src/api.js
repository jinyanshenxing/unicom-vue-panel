const BASE = '/api'

const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded'
}

export async function queryWithToken(endpoint, token, body = {}) {
  const res = await fetch(BASE + endpoint, {
    method: 'POST',
    headers: {
      ...commonHeaders,
      'ecs_token': token   // 部分接口需要放在 header
    },
    body: new URLSearchParams(body)
  })

  if (!res.ok) throw new Error('请求失败')
  return res.json()
}

// 流量查询
export const queryFlow = (token) => 
  queryWithToken('/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune', token)

// 速率 + QCI 查询
export const querySpeed = (token) => 
  queryWithToken('/servicebusiness/query/fiveg/getbasicdata', token)

// 已订业务
export const queryBiz = (token) => 
  queryWithToken('/servicebusiness/newOrdered/queryOrderRelationship', token, { queryType: '1' })