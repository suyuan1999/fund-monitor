# 基金监测软件 - 项目开发指引

## 项目概述

一个运行在 Mac 上的 Electron + React 桌面软件，帮助用户追踪小红书基金博主的每日操作建议，汇总分析后给出加减仓参考，并支持微信推送。

## 关键文件路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 需求文档 | [docs/requirements.md](docs/requirements.md) | 完整产品需求说明 |
| 技术规范 | [docs/tech-spec.md](docs/tech-spec.md) | 技术栈、架构、数据库设计 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | UI 设计规范（颜色、字体、组件风格） |
| 实施步骤 | [docs/implementation-steps.md](docs/implementation-steps.md) | 分步执行计划及完成状态 |
| 开发日志 | [dev-log/](dev-log/) | 每日开发记录（按日期命名） |

## 工作约定

### 开发原则
- **每次只完成一个步骤**，确认稳定后再推进下一步
- 每完成一个步骤，更新 [docs/implementation-steps.md](docs/implementation-steps.md) 中的状态
- 每天结束前，在 [dev-log/](dev-log/) 中创建当日日志（格式：`YYYY-MM-DD.md`），记录已完成事项和待办事项
- UI 组件先在浏览器中验证交互，再集成到 Electron

### 项目技术栈
- 框架: Electron + React
- 构建: Webpack + Babel
- 数据库: better-sqlite3
- 样式: 手写 CSS（不引入 UI 框架）
- AI: DeepSeek API / Anthropic API
- 推送: Server酱 (SCT) webhook

### 运行命令
- `npm start` — 启动开发模式（webpack-dev-server + electron）
- `npm run build` — 打包为生产版本
- `npm run pack` — 打包为 .dmg 安装包

### 代码风格
- JSX 使用函数组件 + Hooks
- CSS 按组件拆分，命名使用 BEM 风格
- 数据库操作集中在 `src/utils/db.js`
- 工具函数不写无意义的注释，只写 WHY 不写 WHAT
