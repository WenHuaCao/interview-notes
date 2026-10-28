# 拾问：问答归档与标签整理

仓库：`WenHuaCao/interview-notes`，默认分支：`main`。
网站：https://wenhuacao.github.io/interview-notes/

这是用户授权的个人公开面试题库。只处理指定面试题聊天中的问答；项目开发、配置和普通闲聊不入库。不要扫描其他聊天。用户说“不要记录”时跳过当前问答。在该工作流中，每次回答及后续追问均自动保存和发布，无需重复询问发布意愿；平台本身的权限检查仍然适用。

## 回答与归档

先回答面试题，再把最终展示给用户的完整问题、回答写入 GitHub。保留原文、代码块与引用链接，不保存内部推理、工具日志或凭证。不要把总结替换成原始回答。

1. 读取本文件和 `content/tags.json`，确定当前仓库可写。生成一个稳定 UUID 作为本题 ID；重试时复用 ID。
2. 新主题创建 `content/questions/YYYY/MM/<id>.md`，年月取首次提问时间在 Asia/Shanghai 的年月。所有时间保存为带时区的 ISO 8601 字符串，推荐 UTC；不知道历史提问时间时使用实际记录时间，不编造历史日期。
3. 同主题追问更新原文件，不创建新的主题记录，不改变 `id`、`createdAt`、原问题和之前的回答。每个追问生成稳定的 `turnId`，重试时检查文件中的标记，避免重复追加。
4. 优先通过 GitHub 插件的读取文件、创建文件、更新文件工具归档。更新前读取最新 blob SHA，更新时传该 SHA。冲突后重新读取并合并，最多重试两次；仍冲突则保留草稿并报告，不能覆盖别人的更新。
5. 本地 Codex 也可以使用下文 CLI。提交时仅提交本次记录文件，不夹带项目代码或其他暂存内容。网络失败时保留本地文件，明确说“尚未同步”，不能称为已发布。
6. 保存后重新读取文件核对完整内容，再告知题目链接。提交到 GitHub 表示“已归档”；GitHub Actions 成功才表示“已发布”。

首次记录的格式如下（替换示例值）：

```yaml
---
id: 6b597e4a-c9b0-4598-8fa7-eae8ca14c0c0
title: 一句话概括原问题
question: |-
  用户完整的原始问题，不要改写。
source: chatgpt-work
createdAt: '2026-10-28T10:00:00.000Z'
answeredAt: '2026-10-28T10:01:00.000Z'
updatedAt: '2026-10-28T10:01:00.000Z'
tags: []
manualTags: []
demo: false
---

这里是完整回答，支持普通 Markdown 和代码块。
```

`source` 仅取 `codex`、`chatgpt-work` 或 `import`。`title` 最长 160 字，`question` 最长 30000 字。初始标签可以为空，不能使用未在标签字典中注册的 ID。`manualTags` 是用户明确指定、整理时必须保留的标签，也是 `tags` 的子集。首次提问和回答的时间不能倒置。

追问追加格式：

```markdown
<!-- turn:稳定的追问UUID -->

## 追问 · 2026-10-28T10:02:00.000Z

用户完整追问

### 回答 · 2026-10-28T10:03:00.000Z

本轮完整回答
```

追加后只把 `updatedAt` 改成本轮回答时间，保留 `taggedAt`。不能因为整理标签而修改 `updatedAt`。

## 本地 CLI

需要 Node.js 24 和 `npm ci`。不要把临时输入文件提交到仓库；推荐 stdin，或使用被忽略的 `.journal-input*.json` 文件。

```text
node scripts/journal.mjs add --input .journal-input.json
node scripts/journal.mjs append --id <原题ID> --input .journal-input-followup.json
node scripts/journal.mjs validate
node scripts/journal.mjs pending
node scripts/journal.mjs tags --input .journal-input-tags.json
```

`add` 输入为 `{ "id": "稳定UUID", "title": "标题", "question": "原问题", "answer": "完整回答", "source": "codex", "tags": [] }`。可传 `createdAt` 和 `answeredAt`，不传则使用记录时刻。

`append` 输入为 `{ "turnId": "稳定UUID", "question": "追问", "answer": "完整回答" }`，也可传上述两个时间字段。

保存并通过验证后，使用数组参数调用 Git，避免把问答文本插入 shell：`git add -- <记录路径>`，`git commit --only -m "记录面试问答" -- <记录路径>`，`git push origin main`。仅在当前分支确实为 `main`、远程是本仓库、该记录没有夹带其他人的未提交修改时自动推送。不自动强推、变基、清理或重置其他修改；遇到分支/推送冲突时保留数据并报告。

## 每日标签整理

此流程供 ChatGPT 网页版的云端定时任务调用，不依赖用户本机开机或本地工作区。

1. 每次从 GitHub 读取最新本文件、标签字典及 `content/questions/` 下的题目。跳过 `content/examples/`。
2. 只处理没有 `taggedAt` 或 `updatedAt > taggedAt` 的记录。没有待处理内容时不写文件、不重复提交，也不发送例行通知。
3. 根据原问题、完整回答和追问分配通常 1–4 个有区分度的主题标签。沿用已有标签 ID 和别名，合并同义概念，保留 `manualTags`。不按难以判断的能力或难度擅自给用户评级。
4. 确需新增标签时，先更新 `content/tags.json`。格式是 `{ "id": "英文小写短横线ID", "label": "中文或技术名称", "aliases": [], "description": "该主题涵盖的知识线索" }`。不同标签的 ID、名称和别名不应相互冲突。合并旧标签时，先迁移引用，再移除已无引用的旧定义，保证中间构建也有效。
5. 更新题目的 `tags` 和 `taggedAt`（本次实际时间），保留所有原始正文、`createdAt`、`updatedAt`、来源与稳定 ID。每次写入前检查最新 SHA，期间出现新追问则重新读取后分类，不能用旧正文覆盖新正文。
6. 通过回读核对保存结果。标签专题页和主题简介会在 GitHub Actions 构建后更新。只在有实际整理结果或失败、需要用户行动时报告。

本地批量整理可使用 `pending` 输出的 `expectedHash`，提交 `{ "id": "题目ID", "tags": ["标签ID"], "expectedHash": "读取时的hash" }` 数组给 `tags` 命令。脚本会在整批校验通过后才写入，并拒绝正文已改变的分类结果。

## 启用边界

仓库中的说明不会自动监听所有 ChatGPT 聊天。ChatGPT Work 需在专门项目中配置初始化提示词并连接具有本仓库写权限的 GitHub 插件；Codex 需打开本项目。ChatGPT 定时任务必须单独创建并试跑。说明文件的存在不代表任务已启用。
