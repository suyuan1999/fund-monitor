const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Blogger operations
  addBlogger: (url) => ipcRenderer.invoke('blogger:add', url),
  getBloggers: () => ipcRenderer.invoke('blogger:getAll'),
  updateBlogger: (id, data) => ipcRenderer.invoke('blogger:update', id, data),
  deleteBlogger: (id) => ipcRenderer.invoke('blogger:delete', id),
  searchBloggers: (keyword) => ipcRenderer.invoke('blogger:search', keyword),

  // Note operations
  fetchLatest: (bloggerId) => ipcRenderer.invoke('note:fetch', bloggerId),
  fetchAllLatest: () => ipcRenderer.invoke('note:fetchAll'),
  addManualNote: (bloggerId, content) => ipcRenderer.invoke('note:addManual', bloggerId, content),
  getNotes: (bloggerId) => ipcRenderer.invoke('note:getByBlogger', bloggerId),
  getTodayNotes: () => ipcRenderer.invoke('note:getToday'),

  // Analysis operations
  runAnalysis: () => ipcRenderer.invoke('analysis:run'),
  getAnalysis: (date) => ipcRenderer.invoke('analysis:get', date),
  estimateCost: () => ipcRenderer.invoke('analysis:estimateCost'),

  // Push operations
  pushToWechat: () => ipcRenderer.invoke('push:send'),

  // Settings operations
  getSetting: (key) => ipcRenderer.invoke('setting:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('setting:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('setting:getAll'),

  // Reminder
  setReminder: (time) => ipcRenderer.invoke('reminder:set', time),
});
