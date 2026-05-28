# 实施步骤

> 每完成一步，将状态改为 ✅ 并记录完成时间

---

## Step 1: 项目初始化
- **状态**: ⏳ 进行中
- **目标**: 搭建 Electron + React 开发环境
- **产出**:
  - package.json（依赖清单）
  - webpack.config.js（构建配置）
  - main.js（Electron 主进程）
  - preload.js（IPC 桥接）
  - src/index.html（入口 HTML）
  - src/index.jsx（React 入口）
  - src/App.jsx（应用框架）
  - src/App.css（全局样式）
- **验证**: `npm start` 能启动桌面窗口，显示 React 页面

---

## Step 2: 数据库层
- **状态**: ⬜ 待开始
- **目标**: 创建 SQLite 数据库及 CRUD 操作
- **产出**: src/utils/db.js

---

## Step 3: 功能开关栏
- **状态**: ⬜ 待开始
- **目标**: 首页顶部 ToggleBar，AI/推送开关，状态持久化
- **产出**: src/components/ToggleBar.jsx

---

## Step 4: 自动解析模块
- **状态**: ⬜ 待开始
- **目标**: 小红书链接双策略解析
- **产出**: src/utils/crawler.js, src/components/ManualInput.jsx

---

## Step 5: 博主管理 UI
- **状态**: ⬜ 待开始
- **目标**: 博主列表、添加/编辑/删除弹窗、搜索栏
- **产出**: BloggerList, BloggerCard, AddBlogger, SearchBar, Sidebar

---

## Step 6: 内容拉取 UI
- **状态**: ⬜ 待开始
- **目标**: 单/批量拉取按钮 + 状态反馈
- **产出**: 整合到 BloggerCard 和 BloggerList

---

## Step 7: 分析看板 UI
- **状态**: ⬜ 待开始
- **目标**: 今日汇总 + AI 综合建议展示
- **产出**: DailyReport, ReportCard, AiSummary

---

## Step 8: AI 分析接入
- **状态**: ⬜ 待开始
- **目标**: 对接 AI API + 费用预估
- **产出**: src/utils/analyzer.js

---

## Step 9: 推送功能
- **状态**: ⬜ 待开始
- **目标**: PushPlus 推送 + 每日本地提醒
- **产出**: src/utils/push.js, src/utils/scheduler.js

---

## Step 10: 设置页 + UI 打磨 + 打包
- **状态**: ⬜ 待开始
- **目标**: 配置项、童趣主题细节、.dmg 打包
- **产出**: Settings.jsx, electron-builder 配置
