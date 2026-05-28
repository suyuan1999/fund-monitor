const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./src/utils/db');
const crawler = require('./src/utils/crawler');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'src')));

// Init DB
db.initDatabase().then(() => console.log('DB ready'));

// ===== Blogger API =====
app.post('/api/blogger/add', async (req, res) => {
  try {
    const { url } = req.body;
    const result = await crawler.parseNote(url);
    if (result.success) {
      const blogger = db.addBlogger(result.nickname, url);
      if (result.content) db.addNote(blogger.id, result.content, 'auto', result.noteUrl || url);
      return res.json({ success: true, blogger, note: result });
    }
    res.json({ success: false, error: result.error });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/blogger/list', (req, res) => {
  const { search } = req.query;
  const data = search ? db.searchBloggers(search) : db.getBloggers();
  res.json(data || []);
});

app.put('/api/blogger/:id', (req, res) => {
  const result = db.updateBlogger(Number(req.params.id), req.body);
  res.json(result || {});
});

app.delete('/api/blogger/:id', (req, res) => {
  db.deleteBlogger(Number(req.params.id));
  res.json({ success: true });
});

// Parse blogger info from screenshot via AI
app.post('/api/blogger/parseScreenshot', async (req, res) => {
  try {
    const { imageBase64, provider, apiKey } = req.body;
    if (!imageBase64 || !apiKey) {
      return res.json({ success: false, error: '缺少参数' });
    }

    const prompt = `请从这张小红书截图中提取以下信息，以JSON格式返回：
{
  "nickname": "博主昵称",
  "profileUrl": "博主主页链接或用户ID"
}
如果无法识别，返回 {"nickname": "", "profileUrl": ""}。只返回JSON，不要其他内容。`;

    let content;
    if (provider === 'deepseek') {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: imageBase64 } },
            { type: 'text', text: prompt },
          ]}],
          max_tokens: 500,
        }),
      });
      const data = await resp.json();
      content = data.choices?.[0]?.message?.content || '';
    } else {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 500,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64.replace(/^data:image\/\w+;base64,/, '') } },
            { type: 'text', text: prompt },
          ]}],
        }),
      });
      const data = await resp.json();
      content = data.content?.[0]?.text || '';
    }

    // Parse JSON from AI response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (_) {
      parsed = null;
    }

    if (!parsed || !parsed.nickname) {
      return res.json({ success: false, error: '未能识别博主信息' });
    }

    // Try to add the blogger
    const blogger = db.addBlogger(parsed.nickname, parsed.profileUrl || '');
    res.json({ success: true, blogger, nickname: parsed.nickname });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ===== Note API =====
app.post('/api/note/fetch/:bloggerId', async (req, res) => {
  const bloggerId = Number(req.params.bloggerId);
  const blogger = db.getBloggers().find(b => b.id === bloggerId);
  if (!blogger) return res.json({ success: false, error: 'Not found' });
  try {
    const cookie = db.getSetting('xhs_cookie') || '';
    let result;

    // Try to get recent notes from profile (needs cookie)
    if (blogger.xhs_url.includes('user/profile') || blogger.xhs_url.includes('xhslink.com')) {
      // Resolve short link first if needed
      let profileUrl = blogger.xhs_url;
      if (blogger.xhs_url.includes('xhslink.com')) {
        const resolved = await crawler.parseNote(blogger.xhs_url);
        profileUrl = resolved.profileUrl || blogger.xhs_url;
      }

      if (cookie) {
        const days = parseInt(req.body?.days) || 1;
        const notesResult = await crawler.fetchUserNotes(profileUrl, cookie, days, 3);
        if (notesResult.success && notesResult.contents) {
          for (const c of notesResult.contents) {
            if (c.content) db.addNote(bloggerId, c.content, 'auto', c.noteUrl, c.noteDate);
          }
          return res.json({
            success: true,
            fetched: notesResult.contents.length,
            total: notesResult.totalFetched,
            days,
            contents: notesResult.contents,
          });
        }
        return res.json({ success: false, error: notesResult.error, needManual: true });
      }

      // No cookie - just get basic info
      result = await crawler.parseNote(blogger.xhs_url);
      if (result.success && result.content) {
        db.addNote(bloggerId, result.content, 'auto', result.noteUrl || '');
        return res.json({ success: true, note: result });
      }
      return res.json({ success: false, error: '需要小红书 Cookie 才能自动拉取笔记。请在设置中配置。', needManual: true });
    }

    // For non-profile URLs, try direct parse
    result = await crawler.parseNote(blogger.xhs_url);
    if (result.success && result.content) {
      db.addNote(bloggerId, result.content, 'auto', result.noteUrl || '');
      return res.json({ success: true, note: result });
    }
    res.json({ success: false, error: result.error, needManual: true });
  } catch (e) { res.json({ success: false, error: e.message, needManual: true }); }
});

app.post('/api/note/fetchAll', async (req, res) => {
  const bloggers = db.getBloggers();
  const cookie = db.getSetting('xhs_cookie') || '';
  const results = [];
  for (const b of bloggers) {
    try {
      let profileUrl = b.xhs_url;
      if (b.xhs_url.includes('xhslink.com')) {
        const resolved = await crawler.parseNote(b.xhs_url);
        profileUrl = resolved.profileUrl || b.xhs_url;
      }

      if (cookie && (profileUrl.includes('user/profile') || profileUrl.includes('xhslink.com'))) {
        const notesResult = await crawler.fetchUserNotes(profileUrl, cookie);
        if (notesResult.success && notesResult.contents) {
          for (const c of notesResult.contents) {
            if (c.content) db.addNote(b.id, c.content, 'auto', c.noteUrl, c.noteDate);
          }
          results.push({ bloggerId: b.id, success: true, fetched: notesResult.contents.length });
        } else {
          results.push({ bloggerId: b.id, success: false, error: notesResult.error });
        }
      } else if (!cookie) {
        results.push({ bloggerId: b.id, success: false, error: '需要配置 Cookie' });
      } else {
        const r = await crawler.parseNote(b.xhs_url);
        if (r.success && r.content) db.addNote(b.id, r.content, 'auto', r.noteUrl || '');
        results.push({ bloggerId: b.id, ...r });
      }
    } catch (e) { results.push({ bloggerId: b.id, success: false, error: e.message }); }
  }
  res.json({ success: true, results });
});

app.post('/api/note/addManual', (req, res) => {
  const { bloggerId, content } = req.body;
  db.addNote(bloggerId, content, 'manual');
  res.json({ success: true });
});

app.get('/api/note/list/:bloggerId', (req, res) => {
  res.json(db.getNotesByBlogger(Number(req.params.bloggerId)));
});

app.get('/api/note/today', (req, res) => {
  res.json(db.getTodayNotes());
});

// ===== Analysis API =====
app.post('/api/analysis/run', async (req, res) => {
  try {
    let notes;

    // Accept content directly (from GitHub Pages frontend with localStorage)
    if (req.body?.contents && req.body.contents.length > 0) {
      notes = req.body.contents.map(c => ({
        content: c.content || '',
        blogger_nickname: c.blogger_nickname || c.nickname || '未知',
      }));
    } else {
      // Use backend database notes
      notes = db.getTodayNotes();
      if (!notes.length) return res.json({ success: false, error: 'No notes' });
      const selectedIds = req.body?.noteIds;
      if (selectedIds && selectedIds.length > 0) {
        notes = notes.filter((n) => selectedIds.includes(n.id));
      }
    }

    if (!notes.length) return res.json({ success: false, error: '未选择任何内容' });
    const analyzer = require('./src/utils/analyzer');
    const summary = await analyzer.runAnalysis(notes);
    const today = new Date().toISOString().slice(0, 10);
    db.saveAnalysis(today, summary);
    res.json({ success: true, summary, date: today });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// Screenshot upload: extract text via AI and save as note
app.post('/api/note/uploadScreenshot', async (req, res) => {
  try {
    const { bloggerId, imageBase64 } = req.body;
    if (!bloggerId || !imageBase64) {
      return res.json({ success: false, error: '缺少参数' });
    }

    const apiKey = db.getSetting('ai_api_key');
    const provider = db.getSetting('ai_provider') || 'deepseek';
    if (!apiKey) return res.json({ success: false, error: '请先配置 AI API Key' });

    const prompt = '请提取这张小红书截图中的所有文字内容，保持原文格式和换行，不要添加任何额外说明。直接输出原文。';

    let content;
    if (provider === 'deepseek') {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageBase64 } },
              { type: 'text', text: prompt },
            ],
          }],
          max_tokens: 2000,
        }),
      });
      const data = await resp.json();
      content = data.choices?.[0]?.message?.content || '';
    } else {
      // Anthropic
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64.replace(/^data:image\/\w+;base64,/, '') } },
              { type: 'text', text: prompt },
            ],
          }],
        }),
      });
      const data = await resp.json();
      content = data.content?.[0]?.text || '';
    }

    if (!content) return res.json({ success: false, error: '图片识别失败，请重试' });

    db.addNote(bloggerId, content, 'screenshot');
    res.json({ success: true, content: content.substring(0, 200) + '...' });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.get('/api/analysis/get', (req, res) => {
  const { date } = req.query;
  res.json(db.getAnalysis(date) || null);
});

app.get('/api/analysis/estimateCost', (req, res) => {
  const notes = db.getTodayNotes();
  const analyzer = require('./src/utils/analyzer');
  res.json({ cost: `约 ¥${analyzer.estimateCost(notes).toFixed(4)}` });
});

// ===== Push API =====
app.post('/api/push/send', async (req, res) => {
  try {
    const push = require('./src/utils/push');
    await push.sendToWechat();
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

// ===== Settings API =====
app.get('/api/setting/:key', (req, res) => {
  res.json({ value: db.getSetting(req.params.key) });
});

app.put('/api/setting/:key', (req, res) => {
  db.setSetting(req.params.key, String(req.body.value));
  res.json({ success: true });
});

app.get('/api/settings/all', (req, res) => {
  res.json(db.getAllSettings());
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// ===== Daily Auto-Pipeline =====
// Phase 1 (fetch): multiple times during the day, last at cutoff time
// Phase 2 (analyze + push): once per day, after fetch cutoff
const cron = require('node-cron');

let pipelineStatus = { time: null, step: 'idle', fetch: 0, analyzed: false, pushed: false, error: null };
let lastFetchTime = null;
let todayAnalyzed = false;

async function fetchPhase() {
  const now = new Date();
  console.log('Fetch phase at', now.toLocaleString());
  pipelineStatus.time = now.toISOString();
  pipelineStatus.step = 'fetching';

  const autoEnabled = db.getSetting('auto_fetch_enabled');
  if (autoEnabled === 'false') { pipelineStatus.step = 'idle'; return 0; }

  const cookie = db.getSetting('xhs_cookie');
  if (!cookie) { pipelineStatus.step = 'idle'; return 0; }

  const bloggers = db.getBloggers();
  if (!bloggers.length) { pipelineStatus.step = 'idle'; return 0; }

  let fetched = 0;
  for (const b of bloggers) {
    try {
      let profileUrl = b.xhs_url;
      if (profileUrl.includes('xhslink.com')) {
        const resolved = await crawler.parseNote(profileUrl);
        profileUrl = resolved.profileUrl || b.xhs_url;
      }
      const result = await crawler.fetchUserNotes(profileUrl, cookie, 1, 3);
      if (result.success && result.contents) {
        for (const c of result.contents) {
          if (c.content) db.addNote(b.id, c.content, 'auto', c.noteUrl, c.noteDate);
        }
        fetched += result.contents.length;
      }
    } catch (e) { console.log('Fetch err:', b.nickname, e.message); }
  }

  pipelineStatus.fetch = (pipelineStatus.fetch || 0) + fetched;
  lastFetchTime = now;
  console.log('Fetch done:', fetched, 'new, total today:', pipelineStatus.fetch);
  return fetched;
}

async function analyzePhase() {
  if (todayAnalyzed) { console.log('Already analyzed today, skipping'); return; }

  console.log('Analyze phase at', new Date().toLocaleString());
  pipelineStatus.step = 'analyzing';

  if (db.getSetting('ai_enabled') === 'false') { pipelineStatus.step = 'idle'; return; }

  try {
    const notes = db.getTodayNotes();
    if (notes.length === 0) { pipelineStatus.step = 'idle'; console.log('No notes to analyze'); return; }

    const analyzer = require('./src/utils/analyzer');
    const summary = await analyzer.runAnalysis(notes);
    const today = new Date().toISOString().slice(0, 10);
    db.saveAnalysis(today, summary);
    pipelineStatus.analyzed = true;
    todayAnalyzed = true;
    console.log('Analyze done');
  } catch (e) {
    pipelineStatus.error = '分析失败: ' + e.message;
    console.log('Analyze failed:', e.message);
  }
}

async function pushPhase() {
  if (!pipelineStatus.analyzed) { console.log('Not analyzed, skip push'); return; }
  if (db.getSetting('push_enabled') === 'false') { console.log('Push disabled'); return; }

  pipelineStatus.step = 'pushing';
  try {
    const push = require('./src/utils/push');
    await push.sendToWechat();
    pipelineStatus.pushed = true;
    pipelineStatus.step = 'done';
    console.log('Push done');
  } catch (e) {
    pipelineStatus.error = '推送失败: ' + e.message;
    console.log('Push failed:', e.message);
  }
}

async function fetchCutoffAndAnalyze() {
  console.log('=== Cutoff time! Final fetch + analyze + push ===');
  await fetchPhase();
  await analyzePhase();
  await pushPhase();
  console.log('=== Daily pipeline complete ===');
}

function startScheduler() {
  const cutoffTime = db.getSetting('auto_fetch_time') || '14:30';
  const [cutoffH, cutoffM] = cutoffTime.split(':');

  // Real-time fetch throughout the day: every 1.5h from 9:00 to cutoff
  const fetchSlots = [];
  const startH = 9, startM = 0;
  let h = startH, m = startM;
  while (h < parseInt(cutoffH) || (h === parseInt(cutoffH) && m <= parseInt(cutoffM))) {
    fetchSlots.push({ h: String(h), m: String(m).padStart(2, '0') });
    m += 90; // every 1.5 hours
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
  }
  // Last slot must be the cutoff time
  if (fetchSlots.length > 0 && !(fetchSlots[fetchSlots.length - 1].h === cutoffH && fetchSlots[fetchSlots.length - 1].m === cutoffM)) {
    fetchSlots.push({ h: cutoffH, m: cutoffM });
  }

  for (const ft of fetchSlots) {
    const isCutoff = ft.h === cutoffH && ft.m === cutoffM;
    cron.schedule(`${ft.m} ${ft.h} * * *`, async () => {
      if (isCutoff) {
        console.log('Cutoff time reached — running final fetch + analyze + push');
        await fetchCutoffAndAnalyze();
      } else {
        await fetchPhase();
      }
    });
  }

  const times = fetchSlots.map(f => `${f.h}:${f.m}`).join(', ');
  console.log('Scheduler: fetch at', times);
  console.log('Cutoff:', cutoffTime, '→ analyze + push');

  // Reset daily state at midnight
  cron.schedule('5 0 * * *', () => {
    pipelineStatus = { time: null, step: 'idle', fetch: 0, analyzed: false, pushed: false, error: null };
    todayAnalyzed = false;
    console.log('New day — pipeline reset');
  });
}

// Pipeline status
app.get('/api/pipeline/status', (req, res) => {
  const autoEnabled = db.getSetting('auto_fetch_enabled') !== 'false';
  res.json({ ...pipelineStatus, autoEnabled, lastFetchTime, todayAnalyzed });
});

// Manual: fetch only
app.post('/api/pipeline/fetch', async (req, res) => {
  const count = await fetchPhase();
  res.json({ success: true, fetched: count });
});

// Manual: analyze only
app.post('/api/pipeline/analyze', async (req, res) => {
  todayAnalyzed = false;
  await analyzePhase();
  res.json({ success: pipelineStatus.analyzed });
});

// Manual: full pipeline (fetch + analyze + push)
app.post('/api/pipeline/run', async (req, res) => {
  todayAnalyzed = false;
  pipelineStatus = { time: new Date().toISOString(), step: 'fetching', fetch: 0, analyzed: false, pushed: false, error: null };
  await fetchPhase();
  await analyzePhase();
  await pushPhase();
  res.json(pipelineStatus);
});

const PORT = process.env.PORT || 3456;
db.initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    startScheduler();
    if (!process.env.RENDER) {
      const { exec } = require('child_process');
      exec(`open http://localhost:${PORT}`);
    }
  });
});
