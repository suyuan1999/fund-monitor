// Standalone mode: each user has their own data in localStorage
// Backend is only used for XHS crawling, AI analysis, and push
(function() {
  const BACKEND = 'https://features-wife-london-applicant.trycloudflare.com';

  // localStorage helpers
  function load(key, def) { try { return JSON.parse(localStorage.getItem('fund_'+key)); } catch(_) { return def; } }
  function save(key, data) { localStorage.setItem('fund_'+key, JSON.stringify(data)); }

  // Default settings
  function getSettings() { return load('settings', { ai_enabled:'true', push_enabled:'true', auto_fetch_enabled:'true', auto_fetch_time:'14:30', sct_sendkey:'', ai_api_key:'', ai_provider:'deepseek', xhs_cookie:'' }); }
  function getBloggers() { return load('bloggers', []); }
  function getNotes() { return load('notes', []); }

  async function backendReq(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    try { const r = await fetch(BACKEND + path, opts); return r.json(); } catch(_) { return { success: false, error: '后端不可用' }; }
  }

  window.api = {
    // Blogger (localStorage)
    addBlogger: async (url) => {
      // Try backend parsing first
      const result = await backendReq('POST', '/api/blogger/add', { url });
      if (result.success) {
        const bloggers = getBloggers();
        bloggers.push(result.blogger);
        save('bloggers', bloggers);
      }
      return result;
    },
    getBloggers: () => getBloggers(),
    updateBlogger: (id, data) => {
      const bloggers = getBloggers();
      const idx = bloggers.findIndex(b => b.id === id);
      if (idx >= 0) { Object.assign(bloggers[idx], data); save('bloggers', bloggers); }
      return bloggers[idx] || null;
    },
    deleteBlogger: (id) => {
      const bloggers = getBloggers().filter(b => b.id !== id);
      const notes = getNotes().filter(n => n.blogger_id !== id);
      save('bloggers', bloggers);
      save('notes', notes);
      return { success: true };
    },
    searchBloggers: (kw) => {
      const q = kw.toLowerCase();
      return getBloggers().filter(b => b.nickname.toLowerCase().includes(q));
    },

    // Notes (localStorage + backend fetch)
    fetchLatest: async (bloggerId, days) => {
      const bloggers = getBloggers();
      const blogger = bloggers.find(b => b.id === bloggerId);
      if (!blogger) return { success: false, error: 'Not found' };

      const result = await backendReq('POST', '/api/note/fetch/' + bloggerId, { days: days || 1, url: blogger.xhs_url });
      if (result.success && result.contents && result.contents.length > 0) {
        const notes = getNotes();
        for (const c of result.contents) {
          const exists = notes.find(n => n.note_url === c.noteUrl && n.blogger_id === bloggerId);
          if (!exists) {
            notes.push({
              id: Date.now() + Math.random(),
              blogger_id: bloggerId,
              content: c.content,
              source: 'auto',
              note_url: c.noteUrl || '',
              note_date: c.noteDate || new Date().toISOString().slice(0,10),
              fetched_at: new Date().toISOString(),
              blogger_nickname: blogger.nickname
            });
          }
        }
        save('notes', notes);
        return { success: true, fetched: result.contents.length };
      }
      return result;
    },
    fetchAllLatest: async (days) => {
      const results = [];
      for (const blogger of getBloggers()) {
        const r = await window.api.fetchLatest(blogger.id, days);
        results.push({ bloggerId: blogger.id, ...r });
      }
      return { success: true, results };
    },
    addManualNote: (bloggerId, content) => {
      const notes = getNotes();
      notes.push({
        id: Date.now(),
        blogger_id: bloggerId,
        content,
        source: 'manual',
        note_url: '',
        note_date: new Date().toISOString().slice(0, 10),
        fetched_at: new Date().toISOString(),
        blogger_nickname: (getBloggers().find(b => b.id === bloggerId) || {}).nickname || '未知'
      });
      save('notes', notes);
      return { success: true };
    },
    getNotes: (bloggerId) => getNotes().filter(n => n.blogger_id === bloggerId),
    getTodayNotes: () => {
      const t = new Date().toISOString().slice(0, 10);
      return getNotes().filter(n => n.note_date === t).map(n => ({
        ...n,
        blogger_nickname: (getBloggers().find(b => b.id === n.blogger_id) || {}).nickname || '未知'
      }));
    },

    // Analysis (send localStorage content to backend)
    runAnalysis: async (noteIds) => {
      const notes = getNotes();
      const t = new Date().toISOString().slice(0,10);
      const selected = notes.filter(n => n.note_date === t && (!noteIds || noteIds.length === 0 || noteIds.includes(n.id)));
      const contents = selected.map(n => ({
        content: n.content || '',
        blogger_nickname: n.blogger_nickname || '未知'
      }));
      if (!contents.length) return { success: false, error: '今日没有内容' };
      return backendReq('POST', '/api/analysis/run', { contents });
    },
    getAnalysis: async (date) => {
      const r = await backendReq('GET', '/api/analysis/get' + (date ? '?date=' + date : ''));
      return r;
    },
    estimateCost: () => backendReq('GET', '/api/analysis/estimateCost'),

    // Push (backend proxy)
    pushToWechat: () => backendReq('POST', '/api/push/send'),

    // Pipeline
    pipelineStatus: () => backendReq('GET', '/api/pipeline/status'),
    pipelineRun: () => backendReq('POST', '/api/pipeline/run'),
    pipelineFetch: () => backendReq('POST', '/api/pipeline/fetch'),

    // Screenshot
    uploadScreenshot: (bloggerId, imageBase64) => backendReq('POST', '/api/note/uploadScreenshot', { bloggerId, imageBase64 }),

    // Settings (localStorage)
    getSetting: (key) => {
      const s = getSettings();
      return s[key] || '';
    },
    setSetting: (key, value) => {
      const s = getSettings();
      s[key] = String(value);
      save('settings', s);
      return { success: true };
    },
    getAllSettings: () => getSettings(),
  };
})();
