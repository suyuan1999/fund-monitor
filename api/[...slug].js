const fs = require('fs');
const path = require('path');
const DB = '/tmp/fund-db.json';
function db() { try { return JSON.parse(fs.readFileSync(DB,'utf-8')); } catch(_) { const d = { bloggers:[], notes:[], analysis:[], settings:{ ai_enabled:'true', push_enabled:'true', auto_fetch_enabled:'true', auto_fetch_time:'14:30', sct_sendkey:'', ai_api_key:'', ai_provider:'deepseek', xhs_cookie:'' } }; fs.writeFileSync(DB,JSON.stringify(d)); return d; } }
function save(d) { fs.writeFileSync(DB,JSON.stringify(d)); }
function json(res,d,c=200) { res.setHeader('Content-Type','application/json'); res.setHeader('Access-Control-Allow-Origin','*'); res.statusCode=c; res.end(JSON.stringify(d)); }

async function parseBody(req) {
  try { return await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(JSON.parse(d||'{}')))}); } catch(_) { return {}; }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type'); res.statusCode=204; return res.end(); }

  const url = req.url.split('?')[0];
  const body = req.method === 'POST' || req.method === 'PUT' ? await parseBody(req) : {};

  try {
    // Blogger CRUD
    if (url === '/api/blogger/list') { return json(res, db().bloggers); }

    if (url === '/api/blogger/add' && req.method === 'POST') {
      try {
        const crawler = require('../src/utils/crawler');
        const result = await crawler.parseNote(body.url);
        if (result.success) {
          const d = db();
          const id = Date.now();
          const blogger = { id, nickname: result.nickname, xhs_url: result.profileUrl || body.url, tags: '[]', note_count: 0, created_at: new Date().toISOString() };
          d.bloggers.push(blogger);
          save(d);
          return json(res, { success: true, blogger });
        }
        return json(res, { success: false, error: result.error });
      } catch(e) { return json(res, { success: false, error: e.message }); }
    }

    if (url.startsWith('/api/blogger/') && req.method === 'DELETE') {
      const id = Number(url.split('/').pop());
      const d = db();
      d.bloggers = d.bloggers.filter(b => b.id !== id);
      d.notes = (d.notes || []).filter(n => n.blogger_id !== id);
      save(d);
      return json(res, { success: true });
    }

    if (url === '/api/blogger/search') {
      const q = (body.keyword || '').toLowerCase();
      const d = db();
      return json(res, d.bloggers.filter(b => b.nickname.toLowerCase().includes(q)));
    }

    // Notes
    if (url === '/api/note/today') {
      const d = db();
      const t = new Date().toISOString().slice(0, 10);
      return json(res, (d.notes || []).filter(n => n.note_date === t).map(n => ({ ...n, blogger_nickname: (d.bloggers.find(b => b.id === n.blogger_id) || {}).nickname || '未知' })));
    }

    if (url === '/api/note/addManual' && req.method === 'POST') {
      const d = db();
      d.notes.push({ id: Date.now(), blogger_id: body.bloggerId, content: body.content, source: 'manual', note_url: '', note_date: new Date().toISOString().slice(0, 10), fetched_at: new Date().toISOString() });
      save(d);
      return json(res, { success: true });
    }

    if (url.startsWith('/api/note/list/')) {
      const id = Number(url.split('/').pop());
      const d = db();
      return json(res, (d.notes || []).filter(n => n.blogger_id === id));
    }

    // Settings
    if (url === '/api/settings/all') return json(res, db().settings);
    if (url.startsWith('/api/setting/') && req.method === 'GET') return json(res, { value: db().settings[url.split('/').pop()] || '' });
    if (url.startsWith('/api/setting/') && req.method === 'PUT') {
      const d = db();
      d.settings[url.split('/').pop()] = String(body.value || '');
      save(d);
      return json(res, { success: true });
    }

    // Analysis
    if (url === '/api/analysis/get') return json(res, null);
    if (url === '/api/analysis/run') {
      try {
        const d = db();
        const t = new Date().toISOString().slice(0, 10);
        const notes = (d.notes || []).filter(n => n.note_date === t).map(n => ({ ...n, blogger_nickname: (d.bloggers.find(b => b.id === n.blogger_id) || {}).nickname || '未知' }));
        if (!notes.length) return json(res, { success: false, error: '今日没有内容' });
        const analyzer = require('../src/utils/analyzer');
        const summary = await analyzer.runAnalysis(notes);
        d.analysis = d.analysis || [];
        d.analysis.push({ date: t, summary, created_at: new Date().toISOString() });
        save(d);
        return json(res, { success: true, summary, date: t });
      } catch(e) { return json(res, { success: false, error: e.message }); }
    }
    if (url === '/api/analysis/estimateCost') {
      const d = db();
      const t = new Date().toISOString().slice(0, 10);
      const notes = (d.notes || []).filter(n => n.note_date === t).map(n => ({ ...n, blogger_nickname: (d.bloggers.find(b => b.id === n.blogger_id) || {}).nickname || '未知' }));
      const analyzer = require('../src/utils/analyzer');
      return json(res, { cost: `约 ¥${analyzer.estimateCost(notes).toFixed(4)}` });
    }

    // Push
    if (url === '/api/push/send' && req.method === 'POST') {
      try {
        const push = require('../src/utils/push');
        const result = await push.sendToWechat();
        return json(res, result);
      } catch(e) { return json(res, { success: false, error: e.message }); }
    }

    // Pipeline
    if (url === '/api/pipeline/status') return json(res, { step: 'idle', autoEnabled: true });
    if (url === '/api/pipeline/run' || url === '/api/pipeline/fetch') return json(res, { success: false, error: '云端不支持定时任务，请用本地版' });

    // Note fetch (with cookie)
    if (url.startsWith('/api/note/fetch/') && req.method === 'POST') {
      try {
        const id = Number(url.split('/').pop());
        const d = db();
        const blogger = d.bloggers.find(b => b.id === id);
        if (!blogger) return json(res, { success: false, error: '博主不存在' });
        const cookie = d.settings.xhs_cookie;
        if (!cookie) return json(res, { success: false, error: '请先配置小红书 Cookie', needManual: true });
        const crawler = require('../src/utils/crawler');
        let profileUrl = blogger.xhs_url;
        if (profileUrl.includes('xhslink.com')) {
          const resolved = await crawler.parseNote(profileUrl);
          profileUrl = resolved.profileUrl || blogger.xhs_url;
        }
        const result = await crawler.fetchUserNotes(profileUrl, cookie, 1, 3);
        if (result.success && result.contents) {
          for (const c of result.contents) {
            if (c.content) d.notes.push({ id: Date.now() + Math.random(), blogger_id: id, content: c.content, source: 'auto', note_url: c.noteUrl || '', note_date: c.noteDate || new Date().toISOString().slice(0, 10), fetched_at: new Date().toISOString() });
          }
          save(d);
          return json(res, { success: true, fetched: result.contents.length });
        }
        return json(res, { success: false, error: result.error, needManual: true });
      } catch(e) { return json(res, { success: false, error: e.message, needManual: true }); }
    }

    // Fetch all
    if (url === '/api/note/fetchAll' && req.method === 'POST') {
      const d = db();
      const cookie = d.settings.xhs_cookie;
      if (!cookie) return json(res, { success: false, error: '请先配置 Cookie' });
      const crawler = require('../src/utils/crawler');
      const results = [];
      for (const b of d.bloggers) {
        try {
          let profileUrl = b.xhs_url;
          if (profileUrl.includes('xhslink.com')) {
            const resolved = await crawler.parseNote(profileUrl);
            profileUrl = resolved.profileUrl || b.xhs_url;
          }
          const r = await crawler.fetchUserNotes(profileUrl, cookie, 1, 3);
          if (r.success && r.contents) {
            for (const c of r.contents) {
              if (c.content) d.notes.push({ id: Date.now() + Math.random(), blogger_id: b.id, content: c.content, source: 'auto', note_url: c.noteUrl || '', note_date: c.noteDate || new Date().toISOString().slice(0, 10), fetched_at: new Date().toISOString() });
            }
            results.push({ bloggerId: b.id, success: true, fetched: r.contents.length });
          } else {
            results.push({ bloggerId: b.id, success: false, error: r.error });
          }
        } catch(e) { results.push({ bloggerId: b.id, success: false, error: e.message }); }
      }
      save(d);
      return json(res, { success: true, results });
    }

    // 404
    return json(res, { success: false, error: 'Not found' }, 404);
  } catch(e) {
    return json(res, { success: false, error: e.message }, 500);
  }
};
