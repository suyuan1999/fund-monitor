const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(express.json({ limit: '10mb' }));

const DB = '/tmp/fund-db.json';
function db() { try { return JSON.parse(fs.readFileSync(DB,'utf-8')); } catch(_) { return { bloggers:[], notes:[], analysis:[], settings:{ ai_enabled:'true', push_enabled:'true', auto_fetch_enabled:'true', auto_fetch_time:'14:30', sct_sendkey:'', ai_api_key:'', ai_provider:'deepseek', xhs_cookie:'' } }; } }
function save(d) { fs.writeFileSync(DB, JSON.stringify(d)); }

app.get('/api/blogger/list', (_,r) => { const d=db(); r.json(d.bloggers); });
app.post('/api/blogger/add', (q,r) => { const {url}=q.body,d=db(); const id=Date.now(); d.bloggers.push({id,nickname:'博主-'+String(id).slice(-4),xhs_url:url,tags:'[]',note_count:0,created_at:new Date().toISOString()}); save(d); r.json({success:true,blogger:d.bloggers[d.bloggers.length-1]}); });
app.delete('/api/blogger/:id', (q,r) => { const d=db(); d.bloggers=d.bloggers.filter(b=>b.id!==Number(q.params.id)); d.notes=d.notes.filter(n=>n.blogger_id!==Number(q.params.id)); save(d); r.json({success:true}); });
app.get('/api/note/today', (_,r) => { const d=db(),t=new Date().toISOString().slice(0,10); r.json((d.notes||[]).filter(n=>n.note_date===t).map(n=>({...n,blogger_nickname:(d.bloggers.find(b=>b.id===n.blogger_id)||{}).nickname||'未知'}))); });
app.post('/api/note/addManual', (q,r) => { const d=db(); d.notes.push({id:Date.now(),blogger_id:q.body.bloggerId,content:q.body.content,source:'manual',note_url:'',note_date:new Date().toISOString().slice(0,10),fetched_at:new Date().toISOString()}); save(d); r.json({success:true}); });
app.get('/api/settings/all', (_,r) => { r.json(db().settings); });
app.get('/api/setting/:key', (q,r) => { r.json({value:db().settings[q.params.key]||''}); });
app.put('/api/setting/:key', (q,r) => { const d=db(); d.settings[q.params.key]=String(q.body.value||''); save(d); r.json({success:true}); });
app.get('/api/analysis/get', (q,r) => { r.json(null); });
app.post('/api/analysis/run', (_,r) => { r.json({success:false,error:'云端不支持'}); });
app.post('/api/analysis/estimateCost', (_,r) => { r.json({cost:'约 0'}); });
app.post('/api/pipeline/status', (_,r) => { r.json({step:'idle',autoEnabled:true}); });
app.post('/api/pipeline/run', (_,r) => { r.json({success:false,error:'云端不支持'}); });
app.post('/api/pipeline/fetch', (_,r) => { r.json({success:false,error:'云端不支持'}); });
app.post('/api/push/send', (_,r) => { r.json({success:false,error:'云端不支持'}); });
app.post('/api/note/fetch/:id', (_,r) => { r.json({success:false,error:'云端不支持，请用本地版'}); });
app.post('/api/note/fetchAll', (_,r) => { r.json({success:false,error:'云端不支持'}); });

app.use(express.static(path.join(__dirname,'..','dist')));
app.use(express.static(path.join(__dirname,'..','src')));
app.get('*', (_,r) => r.sendFile(path.join(__dirname,'..','src','index.html')));

module.exports = app;
