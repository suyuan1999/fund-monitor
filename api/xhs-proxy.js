const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const urlStr = req.url.split('?url=')[1];
  if (!urlStr) return res.status(400).json({ error: 'Missing url' });
  const url = decodeURIComponent(urlStr);

  try {
    const mod = url.startsWith('https') ? https : http;
    const result = await new Promise((resolve) => {
      mod.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'text/html',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        },
        timeout: 10000
      }, (rsp) => {
        if (rsp.statusCode >= 300 && rsp.statusCode < 400 && rsp.headers.location) {
          return resolve({ redirect: rsp.headers.location });
        }
        let d = '';
        rsp.on('data', c => d += c);
        rsp.on('end', () => resolve({ body: d }));
      }).on('error', (e) => resolve({ error: e.message }));
    });

    if (result.redirect) return res.json({ redirect: result.redirect });
    if (result.error) return res.status(502).json({ error: result.error });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(result.body || '');
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
