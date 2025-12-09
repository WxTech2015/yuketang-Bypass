// HTTP 请求相关
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getBaseUrl } = require('./config');

function newYKTHeaders(cookie, classroomId, universityId, referer, csrfToken) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.95 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'origin': getBaseUrl(),
    'x-client': 'web',
    'xt-agent': 'web',
    'xtbz': 'ykt',
    'accept-language': 'zh-CN,zh;q=0.9',
    'accept-encoding': 'gzip, deflate',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'dnt': '1',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'x-requested-with': 'XMLHttpRequest',
  };
  
  if (cookie) headers['Cookie'] = cookie;
  if (classroomId) {
    headers['classroom-id'] = String(classroomId);
    headers['Classroom-Id'] = String(classroomId);
  }
  if (universityId) {
    headers['university-id'] = String(universityId);
    headers['uv-id'] = String(universityId);
  }
  if (referer) headers['referer'] = referer;
  if (csrfToken) headers['x-csrftoken'] = csrfToken;
  
  return headers;
}

function makeRequest(method, urlStr, headers, body = null, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: { ...headers },
      timeout: timeout,
    };
    
    if (body && method !== 'GET') {
      options.headers['Content-Type'] = 'application/json;charset=UTF-8';
      options.headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
    }
    
    const req = lib.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          content: data,
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  newYKTHeaders,
  makeRequest,
};
