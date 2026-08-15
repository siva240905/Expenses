const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '7871';
const DB_FILE = process.env.VERCEL ? path.join('/tmp', 'db.json') : path.join(__dirname, 'db.json');

// Ensure db.json exists
if (!fs.existsSync(DB_FILE)) {
  try {
    const initialData = fs.existsSync(path.join(__dirname, 'db.json'))
      ? fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8')
      : JSON.stringify({ transactions: [], monthlySavings: 0 });
    fs.writeFileSync(DB_FILE, initialData);
  } catch (e) {}
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, x-admin-pin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Route: GET /api/sync
  if (req.url.startsWith('/api/sync') && req.method === 'GET') {
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ transactions: [], monthlySavings: 0 }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data || JSON.stringify({ transactions: [], monthlySavings: 0 }));
    });
    return;
  }

  // API Route: POST /api/sync
  if (req.url.startsWith('/api/sync') && req.method === 'POST') {
    const clientPin = req.headers['x-admin-pin'];
    if (clientPin !== ADMIN_PIN) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid Admin PIN' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        fs.writeFile(DB_FILE, JSON.stringify(parsed, null, 2), () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, updatedAt: new Date().toISOString() }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // API Route: /api/gist-proxy (Secure GitHub Gist API Proxy)
  if (req.url.startsWith('/api/gist-proxy')) {
    const https = require('https');
    const urlParts = req.url.split('?');
    const queryParams = new URLSearchParams(urlParts[1] || '');
    const targetGistId = queryParams.get('gistId') || '';
    
    const githubToken = process.env.GITHUB_TOKEN || req.headers['x-github-token'] || req.headers['authorization'];
    
    let gistUrlPath = '/gists';
    if (targetGistId) {
      gistUrlPath += '/' + targetGistId;
    }
    
    const options = {
      hostname: 'api.github.com',
      path: gistUrlPath,
      method: req.method,
      headers: {
        'User-Agent': 'CoinFlow-ExpenseTracker-App',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    if (githubToken) {
      options.headers['Authorization'] = githubToken.startsWith('Bearer ') || githubToken.startsWith('token ')
        ? githubToken
        : `token ${githubToken}`;
    }

    let reqBody = '';
    req.on('data', chunk => { reqBody += chunk.toString(); });
    req.on('end', () => {
      const proxyReq = https.request(options, (proxyRes) => {
        let resData = '';
        proxyRes.on('data', chunk => { resData += chunk.toString(); });
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(resData);
        });
      });

      proxyReq.on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gist proxy failed', message: err.message }));
      });

      if (['POST', 'PATCH', 'PUT'].includes(req.method) && reqBody) {
        proxyReq.write(reqBody);
      }
      proxyReq.end();
    });
    return;
  }

  // Static File Serving (Root / -> index.html, styles.css, app.js, etc.)
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/html; charset=utf-8';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      // Fallback to index.html for SPA routing
      fs.readFile(path.join(__dirname, 'index.html'), (err2, indexContent) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(indexContent);
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

module.exports = server;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` 🚀 Expense Tracker Database Server running on port ${PORT}`);
    console.log(` 🌐 Local URL: http://localhost:${PORT}/api/sync`);
    console.log(` 📁 Storing data in: ${DB_FILE}`);
    console.log(`=======================================================`);
  });
}
