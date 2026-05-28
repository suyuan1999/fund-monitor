# 技术规范

## 技术栈

| 层级 | 技术 | 版本要求 |
|------|------|----------|
| 桌面框架 | Electron | ^28.0.0 |
| UI 框架 | React | ^18.2.0 |
| 构建工具 | Webpack | ^5.89.0 |
| JS 编译器 | Babel | ^7.23.0 |
| 数据库 | better-sqlite3 | ^9.4.0 |
| 定时任务 | node-cron | ^3.0.0 |
| HTTP 请求 | axios | ^1.6.0 |
| AI SDK | @anthropic-ai/sdk 或 openai | latest |

## 架构设计

```
┌─────────────────────────────────────────┐
│              Electron Main Process       │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │ 窗口管理 │ │ 定时任务  │ │ 托盘管理  │ │
│  └─────────┘ └──────────┘ └──────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │        IPC Bridge (preload.js)       │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                    ↕ IPC
┌─────────────────────────────────────────┐
│           Renderer Process (React)       │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │  组件层  │ │  状态管理  │ │  样式层   │ │
│  └─────────┘ └──────────┘ └──────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │    Renderer Utils (API calls)        │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 数据库设计

### 数据库文件位置
`{app.getPath('userData')}/fund-monitor.db`

### 表结构

#### bloggers
```sql
CREATE TABLE bloggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  xhs_url TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  avatar_url TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
```

#### notes
```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blogger_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  note_url TEXT DEFAULT '',
  source TEXT DEFAULT 'auto' CHECK(source IN ('auto', 'manual')),
  note_date TEXT DEFAULT (date('now', 'localtime')),
  fetched_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (blogger_id) REFERENCES bloggers(id) ON DELETE CASCADE
);
```

#### analysis
```sql
CREATE TABLE analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);
```

#### settings
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

默认设置值：
- `ai_enabled`: "true"
- `push_enabled`: "true"
- `push_token`: ""
- `ai_api_key`: ""
- `ai_provider`: "deepseek"
- `reminder_time`: "20:00"
- `xhs_cookie`: ""

## IPC 通信设计

### preload.js 暴露的 API

```javascript
contextBridge.exposeInMainWorld('api', {
  // 博主操作
  addBlogger: (url) => ipcRenderer.invoke('blogger:add', url),
  getBloggers: () => ipcRenderer.invoke('blogger:getAll'),
  updateBlogger: (id, data) => ipcRenderer.invoke('blogger:update', id, data),
  deleteBlogger: (id) => ipcRenderer.invoke('blogger:delete', id),
  searchBloggers: (keyword) => ipcRenderer.invoke('blogger:search', keyword),

  // 内容操作
  fetchLatest: (bloggerId) => ipcRenderer.invoke('note:fetch', bloggerId),
  fetchAllLatest: () => ipcRenderer.invoke('note:fetchAll'),
  addManualNote: (bloggerId, content) => ipcRenderer.invoke('note:addManual', bloggerId, content),
  getNotes: (bloggerId) => ipcRenderer.invoke('note:getByBlogger', bloggerId),
  getTodayNotes: () => ipcRenderer.invoke('note:getToday'),

  // 分析操作
  runAnalysis: () => ipcRenderer.invoke('analysis:run'),
  getAnalysis: (date) => ipcRenderer.invoke('analysis:get', date),
  estimateCost: () => ipcRenderer.invoke('analysis:estimateCost'),

  // 推送操作
  pushToWechat: () => ipcRenderer.invoke('push:send'),

  // 设置操作
  getSetting: (key) => ipcRenderer.invoke('setting:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('setting:set', key, value),
  getAllSettings: () => ipcRenderer.invoke('setting:getAll'),

  // 提醒
  setReminder: (time) => ipcRenderer.invoke('reminder:set', time),
});
```

## 安全策略
- 渲染进程不直接访问 Node.js API
- 所有系统操作通过 preload.js 的 contextBridge 暴露的有限 API
- webPreferences: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: false`
- 数据库操作在主进程执行，渲染进程通过 IPC 调用
- 外部网络请求（爬虫、AI API、PushPlus）均在主进程执行
