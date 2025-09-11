const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const aiHintsHandler = require('./api/ai_hints.js');
const generatePromptHandler = require('./api/generate_prompt.js');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function createResWrapper(res) {
  let statusCode = 200;
  return {
    setHeader: (k, v) => res.setHeader(k, v),
    status: (code) => {
      statusCode = code;
      return this;
    },
    send: (body) => {
      if (!res.headersSent) res.statusCode = statusCode;
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        res.end(body);
      } else if (body == null) {
        res.end();
      } else {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(body));
      }
    },
    json: (obj) => {
      if (!res.headersSent) res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(obj));
    },
  };
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (urlPath === '/' || urlPath === '') urlPath = '/public/';
  const isDir = urlPath.endsWith('/');
  let filePath = path.join(PUBLIC_DIR, urlPath.replace(/^\/public\/?/, ''));
  if (isDir) filePath = path.join(filePath, 'index.html');

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  } catch (e) {
    res.statusCode = 404;
    res.end('Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // API routes
    if (pathname === '/api/ai_hints' || pathname === '/api/generate_prompt') {
      const body = await readBody(req);
      const reqLike = { method: req.method, headers: req.headers, body };
      const resLike = createResWrapper(res);
      try {
        if (pathname === '/api/ai_hints') {
          await aiHintsHandler(reqLike, resLike);
        } else {
          await generatePromptHandler(reqLike, resLike);
        }
      } catch (err) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }));
        }
      }
      return;
    }

    // Static files
    return serveStatic(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`[dev] server listening on http://localhost:${PORT}`);
});


