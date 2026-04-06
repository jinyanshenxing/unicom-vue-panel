import express from 'express'
import cors from 'cors'
import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 unicom{version:iphone_c@11.0400}'

function buildHeaders(req, extra = {}) {
  return {
    'User-Agent': UA,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://m.client.10010.com',
    'Referer': 'https://m.client.10010.com/',
    ...(req.headers['x-ecs-token'] ? { 'x-ecs-token': req.headers['x-ecs-token'] } : {}),
    ...extra
  }
}

function formBody(obj = {}) {
  return new URLSearchParams(obj).toString()
}

async function postUnicom(url, data, headers) {
  const res = await axios.post(url, formBody(data), {
    headers,
    timeout: 20000
  })
  return res.data
}

/* ===== API ===== */

/* 健康检查 */
app.get('/api/health', (_, res) => {
  res.json({ ok: true, message: 'server running' })
})

/* 发短信 */
app.post('/api/send-sms', async (req, res) => {
  try {
    const { mobileNumber } = req.body || {}
    if (!mobileNumber) {
      return res.status(400).json({ code: 400, msg: 'mobileNumber 必填' })
    }

    const data = await postUnicom(
      'https://m.client.10010.com/mobileService/sendRadomNum.htm',
      {
        mobile: mobileNumber,
        mobileNumber
      },
      buildHeaders(req)
    )

    res.json(data)
  } catch (err) {
    console.error('send-sms error:', err?.response?.data || err.message)
    res.status(500).json({
      code: 500,
      msg: err?.response?.data?.msg || err.message || '发送短信失败'
    })
  }
})

/* 短信验证码登录 */
app.post('/api/login-sms', async (req, res) => {
  try {
    const { mobileNumber, randomNum } = req.body || {}
    if (!mobileNumber || !randomNum) {
      return res.status(400).json({ code: 400, msg: 'mobileNumber 和 randomNum 必填' })
    }

    const data = await postUnicom(
      'https://m.client.10010.com/mobileService/login.htm',
      {
        mobile: mobileNumber,
        mobileNumber,
        password: randomNum,
        randomNum,
        isRemberPwd: 'true',
        loginStyle: '6',
        deviceOS: 'iphone',
        deviceId: 'vue-panel',
        netWay: 'Wifi',
        version: 'iphone_c@11.0400'
      },
      buildHeaders(req)
    )

    res.json(data)
  } catch (err) {
    console.error('login-sms error:', err?.response?.data || err.message)
    res.status(500).json({
      code: 500,
      msg: err?.response?.data?.msg || err.message || '短信登录失败'
    })
  }
})

/* 流量查询 */
app.post('/api/flow', async (req, res) => {
  try {
    const { mobileNumber } = req.body || {}

    const data = await postUnicom(
      'https://m.client.10010.com/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune',
      {
        mobileNumber
      },
      buildHeaders(req)
    )

    res.json(data)
  } catch (err) {
    console.error('flow error:', err?.response?.data || err.message)
    res.status(500).json({
      code: 500,
      msg: err?.response?.data?.msg || err.message || '流量查询失败'
    })
  }
})

/* 速率查询 */
app.post('/api/speed', async (req, res) => {
  try {
    const { mobileNumber } = req.body || {}

    const data = await postUnicom(
      'https://m.client.10010.com/servicebusiness/query/fiveg/getbasicdata',
      {
        mobileNumber
      },
      buildHeaders(req)
    )

    res.json(data)
  } catch (err) {
    console.error('speed error:', err?.response?.data || err.message)
    res.status(500).json({
      code: 500,
      msg: err?.response?.data?.msg || err.message || '速率查询失败'
    })
  }
})

/* 已订业务 */
app.post('/api/biz', async (req, res) => {
  try {
    const { mobileNumber } = req.body || {}

    const data = await postUnicom(
      'https://m.client.10010.com/servicebusiness/newOrdered/queryOrderRelationship',
      {
        mobileNumber
      },
      buildHeaders(req)
    )

    res.json(data)
  } catch (err) {
    console.error('biz error:', err?.response?.data || err.message)
    res.status(500).json({
      code: 500,
      msg: err?.response?.data?.msg || err.message || '已订业务查询失败'
    })
  }
})

/* ===== 静态文件 ===== */
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath))

/* SPA fallback */
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ code: 404, msg: 'API Not Found' })
  }
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`server running at http://0.0.0.0:${PORT}`)
})