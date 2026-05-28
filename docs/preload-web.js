(function() {
  var BACKEND = 'https://features-wife-london-applicant.trycloudflare.com';

  // One-time data migration
  try { if (!localStorage.getItem('fund_v6')) { var keys = Object.keys(localStorage); for (var i = 0; i < keys.length; i++) { if (keys[i].startsWith('fund_')) localStorage.removeItem(keys[i]); } localStorage.setItem('fund_v6', '1'); } } catch(_) {}

  function load(k, d) { try { var v = JSON.parse(localStorage.getItem('fund_' + k)); return (v && typeof v === 'object') ? v : d; } catch(_) { return d; } }
  function save(k, v) { localStorage.setItem('fund_' + k, JSON.stringify(v)); }
  function S() { return load('settings', { ai_enabled:'true', push_enabled:'true', auto_fetch_enabled:'true', auto_fetch_time:'14:30', sct_sendkey:'', ai_api_key:'', ai_provider:'deepseek', xhs_cookie:'' }); }
  function B() { var b = load('bloggers', []); return Array.isArray(b) ? b : []; }
  function N() { var n = load('notes', []); return Array.isArray(n) ? n : []; }

  async function api(method, path, body) {
    try {
      var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      var r = await fetch(BACKEND + path, opts);
      return r.json();
    } catch(_) { return { success: false, error: '连接后端失败，请确保服务已启动' }; }
  }

  window.api = {
    // Blogger
    addBlogger: async function(url) {
      var r = await api('POST', '/api/blogger/add', { url: url });
      if (r.success && r.blogger) {
        var bs = B();
        var nick = r.blogger.nickname || '未知博主';
        bs.push({ id: Date.now(), nickname: nick, xhs_url: url, tags: '[]', note_count: 0, created_at: new Date().toISOString() });
        save('bloggers', bs);
        return { success: true, blogger: { id: bs[bs.length-1].id, nickname: nick } };
      }
      return r;
    },
    getBloggers: function() { return Promise.resolve(B()); },
    updateBlogger: function(id, data) {
      var bs = B(), idx = bs.findIndex(function(b) { return b.id === id; });
      if (idx >= 0) { Object.assign(bs[idx], data); save('bloggers', bs); }
      return Promise.resolve(bs[idx] || null);
    },
    deleteBlogger: function(id) {
      save('bloggers', B().filter(function(b) { return b.id !== id; }));
      save('notes', N().filter(function(n) { return n.blogger_id !== id; }));
      return Promise.resolve({ success: true });
    },
    searchBloggers: function(kw) {
      var q = kw.toLowerCase();
      return Promise.resolve(B().filter(function(b) { return b.nickname.toLowerCase().indexOf(q) >= 0; }));
    },

    // Notes
    fetchLatest: async function(bloggerId) {
      var bs = B(), blogger = bs.find(function(b) { return b.id === bloggerId; });
      if (!blogger) return { success: false, error: '博主不存在' };
      var r = await api('POST', '/api/note/fetch/' + bloggerId, { days: 1, url: blogger.xhs_url });
      if (r.success && r.contents && r.contents.length > 0) {
        var ns = N();
        for (var i = 0; i < r.contents.length; i++) {
          var c = r.contents[i];
          if (!c.content) continue;
          if (!ns.find(function(n) { return n.note_url === c.noteUrl && n.blogger_id === bloggerId; })) {
            ns.push({ id: Date.now() + Math.random(), blogger_id: bloggerId, content: c.content, source: 'auto', note_url: c.noteUrl || '', note_date: c.noteDate || new Date().toISOString().slice(0,10), fetched_at: new Date().toISOString(), blogger_nickname: blogger.nickname });
          }
        }
        save('notes', ns);
        return { success: true, fetched: r.contents.length };
      }
      return { success: false, error: r.error || '拉取失败', needManual: r.needManual };
    },
    fetchAllLatest: async function() {
      var bs = B(), results = [];
      for (var i = 0; i < bs.length; i++) {
        var r = await window.api.fetchLatest(bs[i].id);
        results.push({ bloggerId: bs[i].id, success: r.success, fetched: r.fetched });
      }
      return { success: true, results: results };
    },
    addManualNote: function(bid, c) {
      var ns = N(), bs = B(), blogger = bs.find(function(b) { return b.id === bid; });
      ns.push({ id: Date.now(), blogger_id: bid, content: c, source: 'manual', note_url: '', note_date: new Date().toISOString().slice(0,10), fetched_at: new Date().toISOString(), blogger_nickname: (blogger||{}).nickname||'未知' });
      save('notes', ns);
      return Promise.resolve({ success: true });
    },
    getNotes: function(bid) { return Promise.resolve(N().filter(function(n) { return n.blogger_id === bid; })); },
    getTodayNotes: function() {
      var t = new Date().toISOString().slice(0,10), bs = B();
      return Promise.resolve(N().filter(function(n) { return n.note_date === t; }).map(function(n) {
        n.blogger_nickname = (bs.find(function(b) { return b.id === n.blogger_id; })||{}).nickname||'未知';
        return n;
      }));
    },

    // Analysis
    runAnalysis: function(nids) { return api('POST', '/api/analysis/run', { noteIds: nids || [] }); },
    getAnalysis: function(d) { return api('GET', '/api/analysis/get' + (d ? '?date=' + d : '')); },
    estimateCost: function() { return api('GET', '/api/analysis/estimateCost'); },

    // Push
    pushToWechat: function() { return api('POST', '/api/push/send'); },

    // Pipeline
    pipelineStatus: function() { return api('GET', '/api/pipeline/status'); },
    pipelineRun: function() { return api('POST', '/api/pipeline/run'); },
    pipelineFetch: function() { return api('POST', '/api/pipeline/fetch'); },

    // Screenshot
    uploadScreenshot: function(bid, img) { return api('POST', '/api/note/uploadScreenshot', { bloggerId: bid, imageBase64: img }); },

    // Settings
    getSetting: function(key) { return Promise.resolve(S()[key] || ''); },
    setSetting: function(key, value) { var s = S(); s[key] = String(value); save('settings', s); return Promise.resolve({ success: true }); },
    getAllSettings: function() { return Promise.resolve(S()); },
  };
})();
