# 拾问 · Interview Notes

把每一次面试提问、回答和追问记录下来，用时间线、标签和主动回忆重新遇见它们。

目标博客：https://wenhuacao.github.io/interview-notes/

## 使用方式

- **Codex**：打开本仓库并提问。根目录 `AGENTS.md` 将面试题请求指向归档技能，支持本地项目模式。
- **ChatGPT Work**：按 [网页版配置](docs/chatgpt-work.md) 连接 GitHub、设置专用项目说明；回答后自动保存完整问答。
- **每日标签整理**：按 [定时任务说明](docs/scheduled-task.md) 在 ChatGPT 网页版创建每天北京时间 21:00 的任务。
- **博客复习**：先回忆问题再展开答案，反馈掌握程度；进度只保存在当前浏览器，支持备份导出、导入。

项目说明与技能只约束指定项目/聊天，不能监听任意历史聊天。发布的问答公开，复习进度不上传。仓库中的示例题有明确标记，不计入真实记录；首次保存真实问题后首页切换为真实题库。

## 本地开发

需要 Node.js 24：

```sh
npm ci
npm run dev
# http://127.0.0.1:4321/interview-notes/
```

```sh
npm run check
npm test
npm run build
npm run test:e2e
```

本机浏览器测试优先使用已安装的 Microsoft Edge。CI 用 `CI=1` 选择 Playwright Chromium；运行前用 `npx playwright install --with-deps chromium` 安装浏览器。普通构建不需要安装浏览器。

Windows 上可以直接运行 `./project.ps1 dev`，脚本会优先使用 Node 24，或复用 Codex 已安装的 Node 运行时，不修改系统 Node 设置。首次安装使用 `./project.ps1 install`；其余命令为 `check`、`test`、`build`、`preview`、`e2e`。

## 记录格式与工具

真实问答为 `content/questions/YYYY/MM/<稳定ID>.md`，标签字典为 `content/tags.json`；[WORKFLOW.md](WORKFLOW.md) 定义唯一写入格式、追问规则与整理规则。

```sh
node scripts/journal.mjs add --input .journal-input.json
node scripts/journal.mjs append --id <题目ID> --input .journal-input-followup.json
node scripts/journal.mjs pending
node scripts/journal.mjs validate
```

临时输入文件默认忽略。CLI 保存本地文件，随后由 Codex 仅提交该记录并推送，或直接使用 GitHub 插件写入；CLI 不会擅自提交项目代码。

## 发布

仓库在 GitHub Pages 的发布来源设为 **GitHub Actions**。推送到 `main` 后自动进行类型与内容检查、单元测试、构建及中文全文索引，成功后发布。失败不会覆盖上一版网站。

首次发布前使用 `gh auth login --hostname github.com --git-protocol https --web --scopes workflow` 登录 WenHuaCao 账户，提交项目后运行 `./scripts/publish.ps1`。脚本检查账户、分支和远程地址，创建公开仓库、推送并启用 Pages；不会自动提交未知改动。

内部 URL 使用 `/interview-notes/` 基础路径。更换仓库或域名时同步修改 `astro.config.mjs`、`WORKFLOW.md`、Work 项目说明与定时任务目标。

技术：Astro、TypeScript、Pagefind、Zod、Node test runner、Playwright。无服务端数据库、网站登录或模型 API 密钥。
