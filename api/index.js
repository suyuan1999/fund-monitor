// Vercel serverless entry point
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '50mb' }));

// Simple JSON file DB for Vercel serverless
const DB_PATH = '/tmp/fund-monitor-db.json';
function readDB() { try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')); } catch(_) { return { bloggers: [], notes: [], analysis: [], settings: { ai_enabled: 'true', push_enabled: 'true', auto_fetch_enabled: 'true', auto_fetch_time: '14:30', sct_sendkey: '', ai_api_key: '', ai_provider: 'deepseek', xhs_cookie: '' } }; } }
function saveDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data)); }

app.get('/api/blogger/list', (req, res) => { const db = readDB(); res.json(db.bloggers || []); });
app.post('/api/blogger/add', async (req, res) => {
  const { url } = req.body;
  try {
    const crawler = require('../src/utils/crawler');
    const result = await crawler.parseNote(url);
    if (result.success) {
      const db = readDB();
      const blogger = { id: Date.now(), nickname: result.nickname, xhs_url: url, tags: '[]', note_count: 0, created_at: new Date().toISOString() };
      db.bloggers.push(blogger);
      saveDB(db);
      return res.json({ success: true, blogger });
    }
    res.json({ success: false, error: result.error });
  } catch(e) { res.json({ success: false, error: e.message }); }
});
app.delete('/api/blogger/:id', (req, res) => { const db = readDB(); db.bloggers = db.bloggers.filter(b => b.id !== Number(req.params.id)); saveDB(db); res.json({ success: true }); });
app.get('/api/note/today', (req, res) => { const db = readDB(); const today = new Date().toISOString().slice(0, 10); const notes = (db.notes || []).filter(n => n.note_date === today).map(n => { const b = (db.bloggers||[]).find(b => b.id === n.blogger_id); return { ...n, blogger_nickname: b?.nickname || '未知' }; }); res.json(notes); });
app.post('/api/push/send', (req, res) => { res.json({ success: false, error: 'Vercel 模式不支持推送（需要本地部署）' }); });
app.get('/api/settings/all', (req, res) => { const db = readDB(); res.json(db.settings || {}); });
app.get('/api/setting/:key', (req, res) => { const db = readDB(); res.json({ value: db.settings[req.params.key] || '' }); });
app.put('/api/setting/:key', (req, res) => { const db = readDB(); db.settings[req.params.key] = String(req.body.value || ''); saveDB(db); res.json({ success: true }); });
app.get('/api/analysis/get', (req, res) => { const db = readDB(); const date = req.query.date; res.json(db.analysis?.find(a => a.date === date) || null); });
app.post('/api/pipeline/status', (req, res) => { res.json({ step: 'idle', autoEnabled: true }); });
app.post('/api/pipeline/run', (req, res) => { res.json({ success: false, error: 'Vercel 不支持定时任务' }); });
app.post('/api/analysis/run', (req, res) => { res.json({ success: false, error: 'Vercel 不支持 AI 分析' }); });
app.post('/api/analysis/estimateCost', (req, res) => { res.json({ cost: '约 0' }); });
app.post('/api/note/fetch/:id', (req, res) => { res.json({ success: false, error: 'Vercel 不支持拉取，请用本地版' }); });
app.post('/api/note/fetchAll', (req, res) => { res.json({ success: false, error: 'Vercel 不支持拉取' }); });

// Static files
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.use(express.static(path.join(__dirname, '..', 'src')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'src', 'index.html')));

module.exports = app;
