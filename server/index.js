import express from 'express'
import cors from 'cors'
import session from 'express-session'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: true,
  credentials: true
}))

app.use(express.json())

app.use(session({
  secret: process.env.SESSION_SECRET || 'unicom_secret_demo',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}))

function getCommonHeaders(ecs_token = '') {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
    'Origin': 'https://m.client.10010.com',
    'Referer': 'https://m.client.10010.com/'
  }

  if (ecs_token) {
    headers['ecs_token'] = ecs_token
    headers['Authorization'] = ecs_token
    headers['Cookie'] = `ecs_token=${ecs_token}`
  }

  return headers
}

async function safeJson(res) {
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return await res.json()
  }
  const text = await res.text()
  return { raw: text, code: -1, message: 'non-json response' }
}

function requireLogin(req, res, next) {
  if (!req.session.user?.ecs_token) {
    return res.status(401).json({
      code: 401,
      message: '未登录'
    })
  }
  next()
}

app.get('/api/health', (req, res) => {
  res.json({
    code: 0,
    message: 'ok'
  })
})

app.post('/api/login/sms/send', async (req, res) => {
  try {
    const body = req.body || {}

    const resp = await fetch('https://m.client.10010.com/mobileService/sendRadomNum.htm', {
      method: 'POST',
      headers: getCommonHeaders(),
      body: JSON.stringify(body)
    })

    const data = await safeJson(resp)
    res.json({ code: 0, message: '请求已发送', data })
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: '发送短信验证码失败',
      error: err.message
    })
  }
})

app.post('/api/login/captcha/validate', async (req, res) => {
  try {
    const body = req.body || {}

    const resp = await fetch('https://loginxhm.10010.com/login-web/v1/chartCaptcha/validateTencentCaptcha', {
      method: 'POST',
      headers: getCommonHeaders(),
      body: JSON.stringify(body)
    })

    const data = await safeJson(resp)
    res.json({ code: 0, message: '校验请求完成', data })
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: '验证码校验失败',
      error: err.message
    })
  }
})

app.post('/api/login/sms/verify', async (req, res) => {
  try {
    const body = req.body || {}

    const resp = await fetch('https://m.client.10010.com/mobileService/radomLogin.htm', {
      method: 'POST',
      headers: getCommonHeaders(),
      body: JSON.stringify(body)
    })

    const data = await safeJson(resp)

    const ecs_token =
      data?.ecs_token ||
      data?.data?.ecs_token ||
      data?.ecsToken ||
      body?.ecs_token ||
      ''

    if (ecs_token) {
      req.session.user = {
        loginType: 'sms',
        mobile: body.mobile || body.usernumber || '',
        ecs_token
      }
    }

    res.json({
      code: 0,
      message: '登录请求完成',
      data,
      sessionUser: req.session.user || null
    })
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: '短信登录失败',
      error: err.message
    })
  }
})

app.post('/api/login/token', async (req, res) => {
  const { mobile = '', ecs_token = '' } = req.body || {}

  if (!ecs_token) {
    return res.status(400).json({
      code: 400,
      message: 'ecs_token 不能为空'
    })
  }

  try {
    const resp = await fetch(
      'https://m.client.10010.com/servicebusiness/newOrdered/queryOrderRelationship',
      {
        method: 'POST',
        headers: getCommonHeaders(ecs_token),
        body: JSON.stringify({})
      }
    )

    const data = await safeJson(resp)

    const invalid =
      data?.code === '401' ||
      data?.status === 401 ||
      data?.message?.includes('登录') ||
      data?.msg?.includes('登录')

    if (invalid) {
      return res.json({
        code: 1,
        message: 'ecs_token 无效或已过期',
        data
      })
    }

    req.session.user = {
      loginType: 'token',
      mobile,
      ecs_token
    }

    res.json({
      code: 0,
      message: '登录成功',
      data: req.session.user
    })
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: 'token 登录失败',
      error: err.message
    })
  }
})

app.get('/api/me', (req, res) => {
  res.json({
    code: 0,
    data: req.session.user || null
  })
})

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({
      code: 0,
      message: '已退出'
    })
  })
})

app.get('/api/unicom/orders', requireLogin, async (req, res) => {
  try {
    const { ecs_token } = req.session.user
    const resp = await fetch(
      'https://m.client.10010.com/servicebusiness/newOrdered/queryOrderRelationship',
      {
        method: 'POST',
        headers: getCommonHeaders(ecs_token),
        body: JSON.stringify({})
      }
    )

    const data = await safeJson(resp)
    res.json({ code: 0, data })
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: '查询已订业务失败',
      error: err.message
    })
  }
})

app.get('/api/unicom/package', requireLogin, async (req, res) => {
  try {
    const { ecs_token } = req.session.user
    const resp = await fetch(
      'https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune',
      {
        method: 'POST',
        headers: getCommonHeaders(ecs_token),
        body: JSON.stringify({})
      }
    )

    const data = await safeJson(resp)
    res.json({ code: 0, data })
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: '查询套餐信息失败',
      error: err.message
    })
  }
})

app.get('/api/unicom/speed', requireLogin, async (req, res) => {
  try {
    const { ecs_token } = req.session.user
    const resp = await fetch(
      'https://m.client.10010.com/servicebusiness/query/fiveg/getbasicdata',
      {
        method: 'POST',
        headers: getCommonHeaders(ecs_token),
        body: JSON.stringify({})
      }
    )

    const data = await safeJson(resp)
    res.json({ code: 0, data })
  } catch (err) {
    res.status(500).json({
      code: 500,
      message: '查询速率失败',
      error: err.message
    })
  }
})

const webDistPath = path.join(__dirname, 'public')

app.use(express.static(webDistPath))

app.get('*', (req, res) => {
  res.sendFile(path.join(webDistPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})