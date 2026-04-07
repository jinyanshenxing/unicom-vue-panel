async function request(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.message || '请求失败')
  }

  return data
}

export const api = {
  health() {
    return request('/api/health')
  },
  me() {
    return request('/api/me')
  },
  logout() {
    return request('/api/logout', { method: 'POST' })
  },
  sendSmsCode(payload) {
    return request('/api/login/sms/send', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  validateCaptcha(payload) {
    return request('/api/login/captcha/validate', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  smsLogin(payload) {
    return request('/api/login/sms/verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  tokenLogin(payload) {
    return request('/api/login/token', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  getOrders() {
    return request('/api/unicom/orders')
  },
  getPackage() {
    return request('/api/unicom/package')
  },
  getSpeed() {
    return request('/api/unicom/speed')
  }
}