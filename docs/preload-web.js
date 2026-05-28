(function() {
  // Force clear all old data
  try { var keys = Object.keys(localStorage); for (var i = 0; i < keys.length; i++) { if (keys[i].startsWith('fund_')) localStorage.removeItem(keys[i]); } } catch(_) {}

  const BACKEND = 'https://features-wife-london-applicant.trycloudflare.com';

  function load(k, d) { try { var v = JSON.parse(localStorage.getItem('fund_' + k) || 'null'); return (v && typeof v === 'object') ? v : d; } catch(_) { return d; } }
  function save(k, v) { localStorage.setItem('fund_' + k, JSON.stringify(v)); }
  function S() { return load('settings', { ai_enabled: 'true', push_enabled: 'true', auto_fetch_enabled: 'true', auto_fetch_time: '14:30', sct_sendkey: '', ai_api_key: '', ai_provider: 'deepseek', xhs_cookie: '' }); }
  function B() { return load('bloggers', []); }
  function N() { return load('notes', []); }

  // Backend API call
  async function api(method, path, body) {
    try {
      var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      var r = await fetch(BACKEND + path, opts);
      return r.json();
    } catch(_) { return { success: false, error: '后端连接失败' }; }
  }

  // Resolve XHS link via backend
  async function xhsResolve(url) {
    return api('POST', '/api/blogger/add', { url: url });
  }

  // AI Analysis
  async function aiAnalyze(notes) {
    var s = S();
    if (!s.ai_api_key) return { success: false, error: '请先在设置中配置 AI API Key' };
    var texts = notes.map(function(n, i) { return '【博主' + (i+1) + '】' + (n.blogger_nickname||'未知') + '\n内容：' + (n.content||''); }).join('\n\n');
    var prompt = '你是基金投资分析师。请根据以下小红书基金博主今日操作建议做综合分析。\n\n' + texts + '\n\n请输出：\n一、各博主今日观点汇总（表格列出操作方向、涉及板块、建议摘要）\n二、多空观点对比\n三、综合加减仓建议（🟢建议关注 🟡谨慎观望 🔴建议回避）\n四、风险提示';
    try {
      if (s.ai_provider === 'deepseek') {
        var r = await fetch('https://api.deepseek.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.ai_api_key }, body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: '你是专业基金分析师。请用中文。' }, { role: 'user', content: prompt }], temperature: 0.3, max_tokens: 2000 }) });
        var d = await r.json();
        return d.choices ? { success: true, summary: d.choices[0].message.content } : { success: false, error: '分析失败' };
      } else {
        var r2 = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': s.ai_api_key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system: '你是专业基金分析师。请用中文。', messages: [{ role: 'user', content: prompt }] }) });
        var d2 = await r2.json();
        return d2.content ? { success: true, summary: d2.content[0].text } : { success: false, error: '分析失败' };
      }
    } catch(e) { return { success: false, error: e.message }; }
  }

  // Push via Server酱
  async function sendPush() {
    var s = S();
    if (!s.sct_sendkey) return { success: false, error: '请先配置 Server酱 SendKey' };
    var today = new Date().toISOString().slice(0, 10);
    var notes = N().filter(function(n) { return n.note_date === today; });
    if (!notes.length) return { success: false, error: '今日没有内容' };
    var desp = notes.map(function(n, i) { return (i+1) + '. **' + (n.blogger_nickname||'未知') + '**：' + (n.content||'').slice(0, 150); }).join('\n\n');
    var r = await fetch('https://sctapi.ftqq.com/' + s.sct_sendkey + '.send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '基金监测日报 - ' + today, desp: desp }) });
    var d = await r.json();
    return d.code === 0 ? { success: true } : { success: false, error: d.info || '推送失败' };
  }

  // Public API
  window.api = {
    addBlogger: async function(url) {
      var r = await xhsResolve(url);
      if (r.success) {
        var bs = B();
        if (!Array.isArray(bs)) bs = [];
        var blogger = r.blogger || {};
        bs.push({ id: Date.now(), nickname: blogger.nickname || r.nickname || '未知博主', xhs_url: url, tags: '[]', note_count: 0, created_at: new Date().toISOString() });
        save('bloggers', bs);
      }
      return r;
    },
    getBloggers: function() { var bs = B(); return Promise.resolve(Array.isArray(bs) ? bs : []); },
    updateBlogger: function(id, data) {
      var bs = B(); if (!Array.isArray(bs)) bs = [];
      var i = bs.findIndex(function(x) { return x.id === id; });
      if (i >= 0) Object.assign(bs[i], data);
      save('bloggers', bs);
      return Promise.resolve(bs[i] || null);
    },
    deleteBlogger: function(id) {
      var bs = B(); if (!Array.isArray(bs)) bs = [];
      bs = bs.filter(function(b) { return b.id !== id; });
      save('bloggers', bs);
      var ns = N(); if (!Array.isArray(ns)) ns = [];
      ns = ns.filter(function(n) { return n.blogger_id !== id; });
      save('notes', ns);
      return Promise.resolve({ success: true });
    },
    searchBloggers: function(kw) {
      var bs = B(); if (!Array.isArray(bs)) bs = [];
      var q = kw.toLowerCase();
      return Promise.resolve(bs.filter(function(b) { return (b.nickname||'').toLowerCase().indexOf(q) >= 0; }));
    },
    fetchLatest: async function(bloggerId) {
      var bs = B(); if (!Array.isArray(bs)) bs = [];
      var blogger = bs.find(function(b) { return b.id === bloggerId; });
      if (!blogger) return { success: false, error: '博主不存在' };

      // Use backend to fetch notes
      var result = await api('POST', '/api/note/fetch/' + bloggerId, { days: 1, url: blogger.xhs_url });
      if (result.success && result.contents) {
        var ns = N(); if (!Array.isArray(ns)) ns = [];
        for (var i = 0; i < result.contents.length; i++) {
          var c = result.contents[i];
          if (!c.content) continue;
          var exists = ns.find(function(n) { return n.note_url === c.noteUrl && n.blogger_id === bloggerId; });
          if (!exists) {
            ns.push({ id: Date.now() + Math.random(), blogger_id: bloggerId, content: c.content, source: 'auto', note_url: c.noteUrl || '', note_date: c.noteDate || new Date().toISOString().slice(0, 10), fetched_at: new Date().toISOString(), blogger_nickname: blogger.nickname });
          }
        }
        save('notes', ns);
        return { success: true, fetched: result.contents.length };
      }
      return result;
    },
    fetchAllLatest: async function() {
      var bs = B(); if (!Array.isArray(bs)) bs = [];
      var results = [];
      for (var i = 0; i < bs.length; i++) {
        results.push({ bloggerId: bs[i].id, nickname: bs[i].nickname });
      }
      return { success: true, results: results };
    },
    addManualNote: function(bid, c) {
      var ns = N(); if (!Array.isArray(ns)) ns = [];
      var bs = B(); if (!Array.isArray(bs)) bs = [];
      var blogger = bs.find(function(b) { return b.id === bid; });
      ns.push({ id: Date.now(), blogger_id: bid, content: c, source: 'manual', note_url: '', note_date: new Date().toISOString().slice(0, 10), fetched_at: new Date().toISOString(), blogger_nickname: (blogger || {}).nickname || '未知' });
      save('notes', ns);
      return Promise.resolve({ success: true });
    },
    getNotes: function(bid) { var ns = N(); if (!Array.isArray(ns)) ns = []; return Promise.resolve(ns.filter(function(n) { return n.blogger_id === bid; })); },
    getTodayNotes: function() {
      var ns = N(); if (!Array.isArray(ns)) ns = [];
      var bs = B(); if (!Array.isArray(bs)) bs = [];
      var t = new Date().toISOString().slice(0, 10);
      return Promise.resolve(ns.filter(function(n) { return n.note_date === t; }).map(function(n) {
        var blogger = bs.find(function(b) { return b.id === n.blogger_id; });
        n.blogger_nickname = (blogger || {}).nickname || '未知';
        return n;
      }));
    },
    runAnalysis: function(nids) { return api('POST', '/api/analysis/run', { noteIds: nids || [] }); },
    getAnalysis: function(d) { return api('GET', '/api/analysis/get' + (d ? '?date=' + d : '')); },
    estimateCost: function() { return api('GET', '/api/analysis/estimateCost'); },
    pushToWechat: function() { return api('POST', '/api/push/send'); },
    pipelineStatus: function() { return api('GET', '/api/pipeline/status'); },
    pipelineRun: function() { return api('POST', '/api/pipeline/run'); },
    pipelineFetch: function() { return api('POST', '/api/pipeline/fetch'); },
    uploadScreenshot: function(bid, img) { return api('POST', '/api/note/uploadScreenshot', { bloggerId: bid, imageBase64: img }); },
    getSetting: function(key) { return Promise.resolve(S()[key] || ''); },
    setSetting: function(key, value) {
      var s = S();
      s[key] = String(value);
      save('settings', s);
      return Promise.resolve({ success: true });
    },
    getAllSettings: function() { return Promise.resolve(S()); },
  };
})();
