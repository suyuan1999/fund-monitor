const SERVER = 'http://localhost:3456';

async function request(method, path, body) {
  if (window.api) {
    // Electron IPC mode
    const parts = path.split('/');
    // Map REST paths to IPC channels
    const channel = mapToChannel(method, path);
    if (channel) {
      return window.api[channel](body);
    }
  }

  // Web server mode (fallback)
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${SERVER}${path}`, opts);
  return res.json();
}

// Simple wrapper
const api = {
  // Blogger
  addBlogger: (url) => request('POST', '/api/blogger/add', { url }),
  getBloggers: (search) => request('GET', `/api/blogger/list${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  updateBlogger: (id, data) => request('PUT', `/api/blogger/${id}`, data),
  deleteBlogger: (id) => request('DELETE', `/api/blogger/${id}`),
  searchBloggers: (keyword) => request('GET', `/api/blogger/list?search=${encodeURIComponent(keyword)}`),

  // Notes
  fetchLatest: (bloggerId) => request('POST', `/api/note/fetch/${bloggerId}`),
  fetchAllLatest: () => request('POST', '/api/note/fetchAll'),
  addManualNote: (bloggerId, content) => request('POST', '/api/note/addManual', { bloggerId, content }),
  getNotes: (bloggerId) => request('GET', `/api/note/list/${bloggerId}`),
  getTodayNotes: () => request('GET', '/api/note/today'),

  // Analysis
  runAnalysis: () => request('POST', '/api/analysis/run'),
  getAnalysis: (date) => request('GET', `/api/analysis/get${date ? `?date=${date}` : ''}`),
  estimateCost: () => request('GET', '/api/analysis/estimateCost'),

  // Push
  pushToWechat: () => request('POST', '/api/push/send'),

  // Settings
  getSetting: async (key) => {
    const res = await request('GET', `/api/setting/${key}`);
    return res.value;
  },
  setSetting: (key, value) => request('PUT', `/api/setting/${key}`, { value }),
  getAllSettings: () => request('GET', '/api/settings/all'),
};

// Try Electron first, fall back to web API
if (window.api) {
  // Use Electron IPC directly
  module.exports = window.api;
} else {
  module.exports = api;
}
