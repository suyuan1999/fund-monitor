(function() {
  // Clear old data
  try { if (localStorage.getItem('fund_version') !== 'v3') { var keys = Object.keys(localStorage); for (var i = 0; i < keys.length; i++) { if (keys[i].startsWith('fund_')) localStorage.removeItem(keys[i]); } localStorage.setItem('fund_version', 'v3'); } } catch(_) {}

  const PROXY = 'https://features-wife-london-applicant.trycloudflare.com/api/xhs-proxy?url=';

  function load(k, d) { try { var v = JSON.parse(localStorage.getItem('fund_' + k) || 'null'); return (v && typeof v === 'object') ? v : d; } catch(_) { return d; } }
  function save(k, v) { localStorage.setItem('fund_' + k, JSON.stringify(v)); }
  function S() { return load('settings', { ai_enabled: 'true', push_enabled: 'true', auto_fetch_enabled: 'true', auto_fetch_time: '14:30', sct_sendkey: '', ai_api_key: '', ai_provider: 'deepseek', xhs_cookie: '' }); }
  function B() { return load('bloggers', []); }
  function N() { return load('notes', []); }

  // Fetch XHS page via proxy
  async function fetchXHS(url) {
    try { var r = await fetch(PROXY + encodeURIComponent(url)); return r.text(); } catch(_) { return null; }
  }

  // Parse XHS URL to determine type
  function parseXHSLink(url) {
    var u = url.trim();
    // xhslink short links (with or without path prefix)
    var m = u.match(/xhslink\.com\/(?:m\/|a\/)?([A-Za-z0-9]+)/);
    if (m) return { type: 'shortlink', url: u, id: m[1] };
    // Note detail pages
    m = u.match(/xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-f0-9]+)/);
    if (m) return { type: 'note', url: u, id: m[1] };
    // Profile pages
    m = u.match(/xiaohongshu\.com\/user\/profile\/([a-f0-9]+)/);
    if (m) return { type: 'profile', url: u, id: m[1] };
    // Unknown - try as-is
    return { type: 'unknown', url: u, id: null };
  }

  // Resolve any XHS link to get nickname
  async function xhsResolve(url) {
    var parsed = parseXHSLink(url);
    if (parsed.type === 'unknown') return { success: false, error: '不支持的链接格式，请使用小红书分享链接' };

    var html = await fetchXHS(parsed.url);
    if (!html) return { success: false, error: '网络请求失败，请检查网络后重试' };

    // Extract nickname from HTML
    var nick = null;
    var profileUrl = parsed.url;

    // Try JSON patterns
    var m = html.match(/"nickname"\s*:\s*"([^"]+)"/);
    if (!m) m = html.match(/"nickName"\s*:\s*"([^"]+)"/);
    if (!m) m = html.match(/nickname":"([^"]+)"/);
    if (!m) m = html.match(/<title>([^<]+)的个人主页[^<]*<\/title>/);
    if (!m) m = html.match(/<title>([^<]+)[^<]*<\/title>/);
    if (!m) m = html.match(/>([^<]{2,20})<\/div>/); // Last resort
    nick = m ? m[1].trim() : null;

    // Extract profile URL from redirect
    var pm = html.match(/"\/user\/profile\/([a-f0-9]+)"/);
    if (pm) profileUrl = 'https://www.xiaohongshu.com/user/profile/' + pm[1];

    return { success: true, nickname: nick || '未知博主', profileUrl: profileUrl };
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
        bs.push({ id: Date.now(), nickname: r.nickname, xhs_url: url, tags: '[]', note_count: 0, created_at: new Date().toISOString() });
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
      var s = S();
      if (!s.xhs_cookie) return { success: false, error: '请先在设置中配置小红书 Cookie', needManual: true };

      // Resolve profile URL
      var pu = blogger.xhs_url;
      if (pu.indexOf('xhslink.com') >= 0) {
        var resolved = await xhsResolve(pu);
        if (!resolved.success) return resolved;
        pu = resolved.profileUrl || pu;
      }

      // Fetch profile page to get note IDs
      var profileHtml = null;
      if (pu.indexOf('user/profile') >= 0) {
        profileHtml = await fetchXHS(pu);
      } else {
        // Try to construct profile URL from user ID
        var uidMatch = pu.match(/user\/profile\/([a-f0-9]+)/);
        if (uidMatch) profileHtml = await fetchXHS('https://www.xiaohongshu.com/user/profile/' + uidMatch[1]);
      }
      if (!profileHtml) return { success: false, error: '无法获取博主主页' };

      // Extract note IDs
      var nidMatches = profileHtml.match(/"noteId"\s*:\s*"([a-f0-9]{24})"/g);
      if (!nidMatches) return { success: false, error: '未找到笔记' };
      var nids = [];
      for (var i = 0; i < nidMatches.length; i++) {
        var mid = nidMatches[i].match(/"([a-f0-9]{24})"/);
        if (mid) nids.push(mid[1]);
      }

      var ns = N(); if (!Array.isArray(ns)) ns = [];
      var today = new Date().toISOString().slice(0, 10);
      var f = 0;

      for (var j = 0; j < nids.length && f < 3; j++) {
        var noteHtml = await fetchXHS('https://www.xiaohongshu.com/explore/' + nids[j]);
        if (!noteHtml) continue;
        // Extract note content
        var sm = noteHtml.match(/window\.__INITIAL_STATE__\s*=\s*({[^<]+?})\s*<\/script>/);
        var title = '', content = '', time = 0;
        if (sm) {
          try {
            var state = JSON.parse(sm[1].replace(/undefined/g, 'null'));
            var nm = state && state.note && state.note.noteDetailMap;
            if (nm) {
              var nk = Object.keys(nm)[0];
              var note = nm[nk] && nm[nk].note;
              if (note) { title = note.title || ''; content = note.desc || ''; time = note.time || 0; }
            }
          } catch(_) {}
        }
        if (!content) {
          var dm = noteHtml.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
          if (dm) content = dm[1];
        }
        if (!content) continue;

        var noteUrl = 'https://www.xiaohongshu.com/explore/' + nids[j];
        var exists = ns.find(function(n) { return n.note_url === noteUrl && n.blogger_id === bloggerId; });
        if (!exists) {
          ns.push({ id: Date.now() + Math.random(), blogger_id: bloggerId, content: title ? title + '\n' + content : content, source: 'auto', note_url: noteUrl, note_date: time > 0 ? new Date(time).toISOString().slice(0, 10) : today, fetched_at: new Date().toISOString(), blogger_nickname: blogger.nickname });
          f++;
        }
      }
      save('notes', ns);
      return { success: true, fetched: f };
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
    runAnalysis: async function(nids) {
      var t = new Date().toISOString().slice(0, 10);
      var ns = N(); if (!Array.isArray(ns)) ns = [];
      var sel = ns.filter(function(n) { return n.note_date === t && (!nids || !nids.length || nids.indexOf(n.id) >= 0); });
      if (!sel.length) return { success: false, error: '今日没有内容' };
      var bs = B(); if (!Array.isArray(bs)) bs = [];
      sel = sel.map(function(n) { var blogger = bs.find(function(b) { return b.id === n.blogger_id; }); n.blogger_nickname = (blogger || {}).nickname || '未知'; return n; });
      return aiAnalyze(sel);
    },
    getAnalysis: function() { return Promise.resolve(null); },
    estimateCost: function() { return Promise.resolve({ cost: '约 ¥0.01-0.03' }); },
    pushToWechat: function() { return sendPush(); },
    pipelineStatus: function() { return Promise.resolve({ step: 'idle', autoEnabled: true }); },
    pipelineRun: function() { return sendPush().then(function(r) { r.step = r.success ? 'done' : 'failed'; return r; }); },
    pipelineFetch: function() { return Promise.resolve({ success: false, error: '云端不支持' }); },
    uploadScreenshot: function() { return Promise.resolve({ success: false, error: '云端不支持' }); },
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
