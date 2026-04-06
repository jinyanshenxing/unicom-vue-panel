'use strict';

/**
 * 联通余量面板 - 反向代理服务
 * 纯 Node.js 内置模块，零外部依赖
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT       = Number(process.env.PORT) || 3000;
const STATIC_DIR = path.resolve(__dirname, 'public');
const UPSTREAM   = 'https://m.client.10010.com';

/* ─── MIME ─────────────────────────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css; charset=utf-8',
  '.js'  : 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg' : 'image/svg+xml',
  '.ico' : 'image/x-icon',
  '.png' : 'image/png',
  '.webp': 'image/webp',
};

/* ─── Route table ───────────────────────────────────────────────────── */
// Each route maps a local POST path to an upstream call
const ROUTES = {
  '/api/send-sms': {
    upMethod : 'GET',
    upPath   : '/mobileService/sendRadomNum.htm',
    buildQuery: b => ({ mobileNumber: b.mobileNumber || '', pwd: '', randomNum: '', loginType: '0', timestamp: Date.now() }),
  },
  '/api/login-sms': {
    upMethod : 'GET',
    upPath   : '/mobileService/radomLogin.htm',
    buildQuery: b => ({ mobileNumber: b.mobileNumber || '', randomNum: b.randomNum || '', loginType: '0', timestamp: Date.now() }),
  },
  '/api/flow': {
    upMethod: 'POST',
    upPath  : '/servicequerybusiness/operationservice/queryOcsPackageFlowLeftContentRevisedInJune',
    buildBody: b => ({ mobileNumber: b.mobileNumber || '' }),
  },
  '/api/speed': {
    upMethod: 'POST',
    upPath  : '/servicebusiness/query/fiveg/getbasicdata',
    buildBody: b => ({ mobileNumber: b.mobileNumber || '' }),
  },
  '/api/biz': {
    upMethod: 'POST',
    upPath  : '/servicebusiness/newOrdered/queryOrderRelationship',
    buildBody: b => ({ mobileNumber: b.mobileNumber || '', queryType: '1' }),
  },
};

/* ─── Upstream request ──────────────────────────────────────────────── */
function upstreamRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(15_000, () => req.destroy(new Error('upstream timeout')));
    if (body) req.write(body);
    req.end();
  });
}

/* ─── Read POST body ────────────────────────────────────────────────── */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => { chunks.push(c); if (chunks.reduce((a, b) => a + b.length, 0) > 1e5) reject(new Error('body too large')); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

/* ─── Helpers ───────────────────────────────────────────────────────── */
function json(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...extraHeaders });
  res.end(body);
}

function staticFile(req, res) {
  let filePath = path.join(STATIC_DIR, req.pathname === '/' ? 'index.html' : req.pathname);
  if (!filePath.startsWith(STATIC_DIR + path.sep) && filePath !== STATIC_DIR) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  if (!path.extname(filePath)) filePath = path.join(STATIC_DIR, 'index.html'); // SPA fallback
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type' : MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
    });
    res.end(data);
  });
}

/* ─── API handler ───────────────────────────────────────────────────── */
async function handleAPI(req, res, body) {
  const route = ROUTES[req.pathname];
  if (!route) { json(res, 404, { code: '404', message: 'route not found' }); return; }

  const ecsToken = req.headers['x-ecs-token'] || '';
  const upHeaders = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    'Accept'    : 'application/json, text/plain, */*',
    'Referer'   : 'https://m.client.10010.com/',
    'Origin'    : 'https://m.client.10010.com',
  };
  if (ecsToken) {
    upHeaders['Cookie']        = `ecs_token=${ecsToken}`;
    upHeaders['Authorization'] = `Bearer ${ecsToken}`;
  }

  let upPath = route.upPath;
  let postData;

  if (route.upMethod === 'GET') {
    const qs = new URLSearchParams(route.buildQuery(body)).toString();
    upPath = `${route.upPath}?${qs}`;
  } else {
    postData = JSON.stringify(route.buildBody(body));
    upHeaders['Content-Type']   = 'application/json';
    upHeaders['Content-Length'] = Buffer.byteLength(postData);
  }

  try {
    const up = await upstreamRequest(
      { hostname: 'm.client.10010.com', port: 443, method: route.upMethod, path: upPath, headers: upHeaders },
      postData
    );

    // Always log raw upstream response for debugging
    console.log(`[proxy] ${req.pathname} → HTTP ${up.status}`);
    console.log(`[raw]   ${up.body.slice(0, 600)}`);

    let parsed;
    try { parsed = JSON.parse(up.body); }
    catch { parsed = { code: 'parse_error', raw: up.body.slice(0, 500) }; }

    const extra = {};
    if (up.headers['set-cookie']) extra['Set-Cookie'] = up.headers['set-cookie'];
    // Attach raw body for frontend debug (stripped in production via DEBUG env)
    if (process.env.DEBUG === '1') parsed.__raw = up.body.slice(0, 2000);
    json(res, 200, parsed, extra);
  } catch (e) {
    console.error('[proxy]', req.pathname, e.message);
    json(res, 502, { code: '502', message: '上游请求失败: ' + e.message });
  }
}

/* ─── Main server ───────────────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  const parsed  = url.parse(req.url, true);
  req.pathname  = parsed.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin' : '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-ecs-token',
      'Access-Control-Max-Age'      : '86400',
    });
    return res.end();
  }

  if (req.pathname.startsWith('/api/')) {
    if (req.method !== 'POST') { json(res, 405, { code: '405', message: 'method not allowed' }); return; }
    try {
      const body = await readBody(req);
      await handleAPI(req, res, body);
    } catch (e) {
      json(res, 500, { code: '500', message: e.message });
    }
    return;
  }

  staticFile(req, res);
});

server.listen(PORT, () => {
  console.log(`✅  联通余量面板启动成功`);
  console.log(`    地址: http://localhost:${PORT}`);
  console.log(`    静态: ${STATIC_DIR}`);
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`❌  端口 ${PORT} 已占用，请设置 PORT 环境变量`);
  else console.error('server error:', e);
  process.exit(1);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
