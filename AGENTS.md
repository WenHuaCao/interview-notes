# Interview Notes / 拾问

## 面试题归档

用户直接提问面试题或明确要求记录问答时，先读取并使用 `skills/interview-journal/SKILL.md` 和 `WORKFLOW.md`。本项目中的面试题回答与同主题追问自动归档并推送至公开仓库；用户说“不要记录”时跳过。项目开发、调试、部署和配置讨论不归档。不要读取其他聊天来收集问题。

## 开发

- Node.js 24；依赖由 `package-lock.json` 锁定。
- 检查：`npm run check`、`npm test`、`npm run build`；浏览器检查：`npm run test:e2e`。
- 问答保存在 `content/questions/`，示例保存在 `content/examples/`，标签定义在 `content/tags.json`。
- 内容变更不得破坏稳定 ID、首次提问时间、原文和用户固定标签。
- GitHub Pages 基础路径是 `/interview-notes/`。内部资源与导航通过 `src/lib/catalog.ts` 中的 `href()` 生成。
- 不把复习进度、凭证或用户临时问答输入文件提交到仓库。
