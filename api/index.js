const fs = require('fs');
const path = require('path');
const DB = '/tmp/fund-db.json';

function db() { try { return JSON.parse(fs.readFileSync(DB,'utf-8')); } catch(_) { return { bloggers:[], notes:[], settings:{ ai_enabled:'true', push_enabled:'true', auto_fetch_enabled:'true', auto_fetch_time:'14:30', sct_sendkey:'', ai_api_key:'', ai_provider:'deepseek', xhs_cookie:'' } }; } }
function save(d) { fs.writeFileSync(DB, JSON.stringify(d)); }

// Serve static files
function serveStatic(req, res) {
  const url = req.url === '/' ? '/index.html' : req.url;
  const srcPath = path.join(__dirname, '..', 'src', url);
  const distPath = path.join(__dirname, '..', 'dist', url);
  for (const p of [srcPath, distPath]) {
    try { const c = fs.readFileSync(p); res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(c); return true; } catch(_) {}
  }
  return false;
}

function json(res, data, code=200) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }
function body(req) { return new Promise((resolve) => { let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{resolve(JSON.parse(d))}catch(_){resolve({})} }); }); }

module.exports = async function handler(req, res) {
  const url = req.url.split('?')[0];

  // API routes
  if (url === '/api/blogger/list') {
    return json(res, db().bloggers);
  }
  if (url === '/api/blogger/add' && req.method === 'POST') {
    const b = await body(req);
    const d = db();
    const id = Date.now();
    const blogger = { id, nickname: '博主-'+String(id).slice(-4), xhs_url: b.url||'', tags: '[]', note_count: 0, created_at: new Date().toISOString() };
    d.bloggers.push(blogger);
    save(d);
    return json(res, { success: true, blogger });
  }
  if (url.startsWith('/api/blogger/') && req.method === 'DELETE') {
    const id = Number(url.split('/').pop());
    const d = db();
    d.bloggers = d.bloggers.filter(x => x.id !== id);
    d.notes = (d.notes||[]).filter(x => x.blogger_id !== id);
    save(d);
    return json(res, { success: true });
  }
  if (url === '/api/note/today') {
    const d = db();
    const t = new Date().toISOString().slice(0,10);
    return json(res, (d.notes||[]).filter(n=>n.note_date===t).map(n=>({...n, blogger_nickname: (d.bloggers.find(x=>x.id===n.blogger_id)||{}).nickname||'未知'})));
  }
  if (url === '/api/settings/all') {
    return json(res, db().settings);
  }
  if (url.startsWith('/api/setting/') && req.method === 'GET') {
    return json(res, { value: db().settings[url.split('/').pop()] || '' });
  }
  if (url.startsWith('/api/setting/') && req.method === 'PUT') {
    const b = await body(req);
    const d = db();
    d.settings[url.split('/').pop()] = String(b.value||'');
    save(d);
    return json(res, { success: true });
  }

  // Catch-all API: return mock success
  if (url.startsWith('/api/')) {
    return json(res, { success: false, error: '云端不支持此功能，请用本地版' });
  }

  // Static files
  if (serveStatic(req, res)) return;

  // Fallback to index.html
  try {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } catch(_) {
    res.writeHead(404);
    res.end('404');
  }
};
