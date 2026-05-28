(function() {
  var BACKEND = 'https://features-wife-london-applicant.trycloudflare.com';

  try { if (!localStorage.getItem('fund_v7')) { var keys = Object.keys(localStorage); for (var i = 0; i < keys.length; i++) { if (keys[i].startsWith('fund_')) localStorage.removeItem(keys[i]); } localStorage.setItem('fund_v7', '1'); } } catch(_) {}

  function L(k, d) { try { var v = JSON.parse(localStorage.getItem('fund_' + k)); return (v && typeof v === 'object') ? v : d; } catch(_) { return d; } }
  function S(k, v) { localStorage.setItem('fund_' + k, JSON.stringify(v)); }
  function sett() { return L('settings', { ai_enabled:'true', push_enabled:'true', auto_fetch_enabled:'true', auto_fetch_time:'14:30', sct_sendkey:'', ai_api_key:'', ai_provider:'deepseek', xhs_cookie:'' }); }
  function blog() { var b = L('bloggers', []); return Array.isArray(b) ? b : []; }
  function note() { var n = L('notes', []); return Array.isArray(n) ? n : []; }

  async function api(method, path, body) {
    try {
      var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      var r = await fetch(BACKEND + path, opts);
      return r.json();
    } catch(_) { return { success: false, error: '连接后端失败' }; }
  }

  window.api = {
    addBlogger: async function(url) {
      var r = await api('POST', '/api/blogger/add', { url: url });
      if (r.success && r.blogger) {
        var bs = blog(), nick = r.blogger.nickname || '未知博主';
        bs.push({ id: Date.now(), nickname: nick, xhs_url: url, tags: '[]', note_count: 0, last_fetch: null, created_at: new Date().toISOString() });
        S('bloggers', bs);
        return { success: true, blogger: bs[bs.length-1] };
      }
      return r;
    },
    getBloggers: function() { return Promise.resolve(blog()); },
    updateBlogger: function(id, data) {
      var bs = blog(), idx = bs.findIndex(function(b) { return b.id === id; });
      if (idx >= 0) { Object.assign(bs[idx], data); S('bloggers', bs); }
      return Promise.resolve(bs[idx] || null);
    },
    deleteBlogger: function(id) {
      S('bloggers', blog().filter(function(b) { return b.id !== id; }));
      S('notes', note().filter(function(n) { return n.blogger_id !== id; }));
      return Promise.resolve({ success: true });
    },
    searchBloggers: function(kw) {
      var q = kw.toLowerCase();
      return Promise.resolve(blog().filter(function(b) { return b.nickname.toLowerCase().indexOf(q) >= 0; }));
    },

    fetchLatest: async function(bloggerId) {
      var bs = blog(), blogger = bs.find(function(b) { return b.id === bloggerId; });
      if (!blogger) return { success: false, error: '博主不存在' };
      var r = await api('POST', '/api/note/fetch/' + bloggerId, { days: 1, url: blogger.xhs_url });
      if (r.success && r.contents && r.contents.length > 0) {
        var ns = note(), nick = blogger.nickname;
        for (var i = 0; i < r.contents.length; i++) {
          var c = r.contents[i];
          if (!c.content) continue;
          if (!ns.find(function(n) { return n.note_url === c.noteUrl && n.blogger_id === bloggerId; })) {
            ns.push({ id: Date.now()+Math.random(), blogger_id: bloggerId, content: c.content, source: 'auto', note_url: c.noteUrl||'', note_date: c.noteDate||new Date().toISOString().slice(0,10), fetched_at: new Date().toISOString(), blogger_nickname: nick });
          }
        }
        S('notes', ns);
        blogger.note_count = ns.filter(function(n) { return n.blogger_id === bloggerId; }).length;
        blogger.last_fetch = new Date().toISOString().replace('T',' ').substring(0,16);
        S('bloggers', bs);
        return { success: true, fetched: r.contents.length };
      }
      return { success: false, error: r.error || '拉取失败', needManual: r.needManual };
    },
    fetchAllLatest: async function() {
      var bs = blog(), results = [];
      for (var i = 0; i < bs.length; i++) {
        var r = await window.api.fetchLatest(bs[i].id);
        results.push({ bloggerId: bs[i].id, nickname: bs[i].nickname, success: r.success, fetched: r.fetched || 0 });
      }
      return { success: true, results: results };
    },
    addManualNote: function(bid, c) {
      var ns = note(), bs = blog(), b = bs.find(function(x) { return x.id === bid; });
      ns.push({ id: Date.now(), blogger_id: bid, content: c, source: 'manual', note_url: '', note_date: new Date().toISOString().slice(0,10), fetched_at: new Date().toISOString(), blogger_nickname: (b||{}).nickname||'未知' });
      S('notes', ns);
      return Promise.resolve({ success: true });
    },
    getNotes: function(bid) { return Promise.resolve(note().filter(function(n) { return n.blogger_id === bid; })); },
    getTodayNotes: function() {
      var t = new Date().toISOString().slice(0,10), bs = blog();
      return Promise.resolve(note().filter(function(n) { return n.note_date === t; }).map(function(n) {
        n.blogger_nickname = (bs.find(function(b) { return b.id === n.blogger_id; })||{}).nickname||'未知';
        return n;
      }));
    },

    // Send actual note content to backend for analysis
    runAnalysis: async function(nids) {
      var t = new Date().toISOString().slice(0,10);
      var ns = note().filter(function(n) { return n.note_date === t && (!nids || !nids.length || nids.indexOf(n.id) >= 0); });
      if (!ns.length) return { success: false, error: '今日没有内容' };
      var contents = ns.map(function(n) { return { content: n.content||'', blogger_nickname: n.blogger_nickname||'未知' }; });
      return api('POST', '/api/analysis/run', { contents: contents });
    },
    getAnalysis: function(d) { return api('GET', '/api/analysis/get' + (d ? '?date=' + d : '')); },
    estimateCost: function() { return api('GET', '/api/analysis/estimateCost'); },
    pushToWechat: function() { return api('POST', '/api/push/send'); },
    pipelineStatus: function() { return api('GET', '/api/pipeline/status'); },
    pipelineRun: function() { return api('POST', '/api/pipeline/run'); },
    pipelineFetch: function() { return api('POST', '/api/pipeline/fetch'); },
    uploadScreenshot: function(bid, img) { return api('POST', '/api/note/uploadScreenshot', { bloggerId: bid, imageBase64: img }); },
    getSetting: function(key) { return Promise.resolve(sett()[key] || ''); },
    setSetting: function(key, value) { var s = sett(); s[key] = String(value); S('settings', s); return Promise.resolve({ success: true }); },
    getAllSettings: function() { return Promise.resolve(sett()); },
  };
})();
