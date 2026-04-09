const express = require('express')
const axios = require('axios')
const cors = require('cors')
const cookieParser = require('cookie-parser')

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())
app.use(cookieParser())
app.use(express.static('public'))

const BASE = 'https://m.client.10010.com'
const CAPTCHA_BASE = 'https://loginxhm.10010.com'

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  'Referer': 'https://m.client.10010.com/',
  'Origin': 'https://m.client.10010.com',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9',
}

// 随机登录（发送验证码前调用）
app.post('/api/random-login', async (req, res) => {
  const { phone } = req.body
  try {
    const resp = await axios.post(
      `${BASE}/mobileService/radomLogin.htm`,
      new URLSearchParams({ loginNum: phone, reqCode: 'MT0001' }).toString(),
      {
        headers: {
          ...COMMON_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 发送短信验证码
app.post('/api/send-sms', async (req, res) => {
  const { phone, token, randNum } = req.body
  try {
    const resp = await axios.post(
      `${BASE}/mobileService/sendRadomNum.htm`,
      new URLSearchParams({
        loginNum: phone,
        token: token || '',
        randNum: randNum || '',
        reqCode: 'MT0001',
      }).toString(),
      {
        headers: {
          ...COMMON_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 腾讯滑块验证
app.post('/api/validate-captcha', async (req, res) => {
  const { ticket, randstr, phone } = req.body
  try {
    const resp = await axios.post(
      `${CAPTCHA_BASE}/login-web/v1/chartCaptcha/validateTencentCaptcha`,
      { ticket, randstr, loginNum: phone },
      {
        headers: {
          ...COMMON_HEADERS,
          'Content-Type': 'application/json',
        },
      }
    )
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ECS Token 登录（直接传 ecs_token）
app.post('/api/ecs-login', async (req, res) => {
  const { ecsToken } = req.body
  try {
    const resp = await axios.get(`${BASE}/mobileService/radomLogin.htm`, {
      params: { ecs_token: ecsToken, reqCode: 'MT0001' },
      headers: { ...COMMON_HEADERS },
    })
    res.json({ success: true, data: resp.data, cookies: resp.headers['set-cookie'] })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 验证码登录
app.post('/api/verify-login', async (req, res) => {
  const { phone, smsCode } = req.body
  try {
    const resp = await axios.post(
      `${BASE}/mobileService/radomLogin.htm`,
      new URLSearchParams({
        loginNum: phone,
        randNum: smsCode,
        reqCode: 'MT0001',
        loginType: '2',
      }).toString(),
      {
        headers: {
          ...COMMON_HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        withCredentials: true,
      }
    )
    const setCookie = resp.headers['set-cookie'] || []
    res.json({ data: resp.data, cookies: setCookie.join('; ') })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 查询已订业务（隐藏包）
app.post('/api/ordered-services', async (req, res) => {
  const { cookies } = req.body
  try {
    const resp = await axios.get(
      `${BASE}/servicebusiness/newOrdered/queryOrderRelationship`,
      {
        params: { reqCode: 'MT0001' },
        headers: {
          ...COMMON_HEADERS,
          Cookie: cookies || '',
        },
      }
    )
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 查询5G流量余量
app.post('/api/flow-info', async (req, res) => {
  const { cookies } = req.body
  try {
    const resp = await axios.get(
      `${BASE}/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune`,
      {
        params: { reqCode: 'MT0001' },
        headers: {
          ...COMMON_HEADERS,
          Cookie: cookies || '',
        },
      }
    )
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// 查询5G速率 / QCI
app.post('/api/speed-qci', async (req, res) => {
  const { cookies } = req.body
  try {
    const resp = await axios.get(
      `${BASE}/servicebusiness/query/fiveg/getbasicdata`,
      {
        params: { reqCode: 'MT0001' },
        headers: {
          ...COMMON_HEADERS,
          Cookie: cookies || '',
        },
      }
    )
    res.json(resp.data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`联通查询代理服务已启动: http://localhost:${PORT}`)
})
