const fs = require('fs');
const DB = '/tmp/fund-db.json';
function db() { try { return JSON.parse(fs.readFileSync(DB,'utf-8')); } catch(_) { const d = { bloggers:[], notes:[], analysis:[], settings:{ ai_enabled:'true', push_enabled:'true', auto_fetch_enabled:'true', auto_fetch_time:'14:30', sct_sendkey:'', ai_api_key:'', ai_provider:'deepseek', xhs_cookie:'' } }; fs.writeFileSync(DB,JSON.stringify(d)); return d; } }
function save(d) { fs.writeFileSync(DB,JSON.stringify(d)); }
function json(res,d,c=200) { res.setHeader('Content-Type','application/json'); res.setHeader('Access-Control-Allow-Origin','*'); res.statusCode=c; res.end(JSON.stringify(d)); }

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE'); res.setHeader('Access-Control-Allow-Headers','Content-Type'); res.statusCode=204; return res.end(); }

  const url = req.url.split('?')[0];
  let body = {};
  if (req.method === 'POST' || req.method === 'PUT') {
    try { body = await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(JSON.parse(d||'{}')))}); } catch(_){}
  }

  try {
    // Blogger
    if (url==='/api/blogger/list') { res.setHeader('Cache-Control','no-cache'); return json(res, db().bloggers); }
    if (url==='/api/blogger/add' && req.method==='POST') {
      const d=db(); const id=Date.now();
      const blogger = { id, nickname:'博主-'+String(id).slice(-4), xhs_url:body.url||'', tags:'[]', note_count:0, created_at:new Date().toISOString() };
      d.bloggers.push(blogger); save(d); return json(res,{success:true,blogger});
    }
    if (url.startsWith('/api/blogger/') && req.method==='DELETE') {
      const id=Number(url.split('/').pop()); const d=db();
      d.bloggers=d.bloggers.filter(b=>b.id!==id); d.notes=(d.notes||[]).filter(n=>n.blogger_id!==id);
      save(d); return json(res,{success:true});
    }
    // Notes
    if (url==='/api/note/today') {
      const d=db(); const t=new Date().toISOString().slice(0,10);
      return json(res, (d.notes||[]).filter(n=>n.note_date===t).map(n=>({...n,blogger_nickname:(d.bloggers.find(b=>b.id===n.blogger_id)||{}).nickname||'未知'})));
    }
    if (url==='/api/note/addManual' && req.method==='POST') {
      const d=db(); d.notes.push({id:Date.now(),blogger_id:body.bloggerId,content:body.content,source:'manual',note_url:'',note_date:new Date().toISOString().slice(0,10),fetched_at:new Date().toISOString()});
      save(d); return json(res,{success:true});
    }
    // Settings
    if (url==='/api/settings/all') return json(res, db().settings);
    if (url.startsWith('/api/setting/') && req.method==='GET') return json(res, {value:db().settings[url.split('/').pop()]||''});
    if (url.startsWith('/api/setting/') && req.method==='PUT') { const d=db(); d.settings[url.split('/').pop()]=String(body.value||''); save(d); return json(res,{success:true}); }
    // Analysis
    if (url==='/api/analysis/get') return json(res, null);
    if (url==='/api/analysis/run') return json(res, {success:false,error:'云端不支持AI分析，请用本地版'});
    if (url==='/api/analysis/estimateCost') return json(res, {cost:'约 0'});
    // Pipeline
    if (url==='/api/pipeline/status') return json(res, {step:'idle',autoEnabled:true});
    if (url==='/api/pipeline/run'||url==='/api/pipeline/fetch'||url==='/api/push/send') return json(res, {success:false,error:'云端不支持，请用本地版'});
    if (url.startsWith('/api/note/fetch')) return json(res, {success:false,error:'云端不支持拉取，请用本地版'});

    // Fallback
    return json(res, {success:false,error:'Not found'}, 404);
  } catch(e) {
    return json(res, {success:false,error:e.message}, 500);
  }
};
