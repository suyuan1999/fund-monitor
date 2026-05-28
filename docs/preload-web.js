// Polyfill window.api for browser mode
// This mirrors the Electron preload.js API using fetch()
(function() {
  const BASE = 'https://fund-monitor-wpzj.vercel.app';

  async function req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(BASE + path, opts);
    return res.json();
  }

  window.api = {
    // Blogger
    addBlogger: (url) => req('POST', '/api/blogger/add', { url }),
    getBloggers: () => req('GET', '/api/blogger/list').then(r => Array.isArray(r) ? r : []),
    updateBlogger: (id, data) => req('PUT', '/api/blogger/' + id, data),
    deleteBlogger: (id) => req('DELETE', '/api/blogger/' + id),
    searchBloggers: (kw) => req('GET', '/api/blogger/list?search=' + encodeURIComponent(kw)).then(r => Array.isArray(r) ? r : []),

    // Notes
    fetchLatest: (bloggerId, days) => req('POST', '/api/note/fetch/' + bloggerId, { days: days || 1 }),
    fetchAllLatest: (days) => req('POST', '/api/note/fetchAll', { days: days || 1 }),
    addManualNote: (bloggerId, content) => req('POST', '/api/note/addManual', { bloggerId, content }),
    getNotes: (bloggerId) => req('GET', '/api/note/list/' + bloggerId).then(r => Array.isArray(r) ? r : []),
    getTodayNotes: () => req('GET', '/api/note/today').then(r => Array.isArray(r) ? r : []),

    // Analysis
    runAnalysis: (noteIds) => req('POST', '/api/analysis/run', { noteIds: noteIds || [] }),
    getAnalysis: (date) => req('GET', '/api/analysis/get' + (date ? '?date=' + date : '')),
    estimateCost: () => req('GET', '/api/analysis/estimateCost'),

    // Screenshot
    uploadScreenshot: (bloggerId, imageBase64) => req('POST', '/api/note/uploadScreenshot', { bloggerId, imageBase64 }),

    // Push
    pushToWechat: () => req('POST', '/api/push/send'),

    // Pipeline
    pipelineStatus: () => req('GET', '/api/pipeline/status'),
    pipelineRun: () => req('POST', '/api/pipeline/run'),
    pipelineFetch: () => req('POST', '/api/pipeline/fetch'),

    // Settings
    getSetting: (key) => req('GET', '/api/setting/' + key).then(r => r.value),
    setSetting: (key, value) => req('PUT', '/api/setting/' + key, { value }),
    getAllSettings: () => req('GET', '/api/settings/all'),
  };
})();
