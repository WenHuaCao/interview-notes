import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import matter from 'gray-matter';
import { z } from 'zod';

export const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{5,79}$/);
const text = z.string().refine(value => value.trim().length > 0, '内容不能为空');
const timestamp = z.preprocess(value => value instanceof Date ? value.toISOString() : value,
  z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString()));
export const recordSchema = z.object({
  id: idSchema,
  title: text.pipe(z.string().max(160)),
  question: text.pipe(z.string().max(30000)),
  source: z.enum(['codex', 'chatgpt-work', 'import']),
  createdAt: timestamp,
  answeredAt: timestamp.optional(),
  updatedAt: timestamp,
  tags: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)).default([]),
  manualTags: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*$/)).default([]),
  taggedAt: timestamp.optional(),
  demo: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.updatedAt < value.createdAt || (value.answeredAt && value.answeredAt < value.createdAt)) {
    ctx.addIssue({ code: 'custom', message: '回答和更新时间不能早于首次提问时间' });
  }
  if (new Set(value.tags).size !== value.tags.length || new Set(value.manualTags).size !== value.manualTags.length) {
    ctx.addIssue({ code: 'custom', message: '标签不能重复' });
  }
});
export const taxonomySchema = z.array(z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/), label: text,
  aliases: z.array(text).default([]), description: z.string().default(''),
}));

export function readTaxonomy(root = process.cwd()) {
  const tags = taxonomySchema.parse(JSON.parse(fs.readFileSync(path.join(root, 'content/tags.json'), 'utf8')));
  const aliases = new Map();
  const ids = new Set();
  for (const tag of tags) {
    if (ids.has(tag.id)) throw new Error(`重复标签 ID：${tag.id}`);
    ids.add(tag.id);
    for (const label of [tag.id, tag.label, ...tag.aliases]) {
      const key = label.normalize('NFKC').toLowerCase();
      if (aliases.has(key) && aliases.get(key) !== tag.id) throw new Error(`标签别名冲突：${label}`);
      aliases.set(key, tag.id);
    }
  }
  return tags;
}

export function parseRecord(raw, file = '') {
  const parsed = matter(raw);
  const data = recordSchema.parse(parsed.data);
  if (!parsed.content.trim()) throw new Error(`回答不能为空：${file}`);
  return { data, body: parsed.content, file };
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : entry.name.endsWith('.md') ? [file] : [];
  });
}

export function readRecords(root = process.cwd(), includeExamples = true) {
  const files = walk(path.join(root, 'content/questions'));
  if (includeExamples) files.push(...walk(path.join(root, 'content/examples')));
  const ids = new Set();
  const knownTags = new Set(readTaxonomy(root).map(tag => tag.id));
  return files.map(file => {
    const record = parseRecord(fs.readFileSync(file, 'utf8'), file);
    if (ids.has(record.data.id)) throw new Error(`重复题目 ID：${record.data.id}`);
    ids.add(record.data.id);
    for (const tag of [...record.data.tags, ...record.data.manualTags]) {
      if (!knownTags.has(tag)) throw new Error(`未知标签 ${tag}：${file}`);
    }
    if (record.data.manualTags.some(tag => !record.data.tags.includes(tag))) throw new Error(`固定标签必须包含在 tags 中：${file}`);
    if (file.includes(`${path.sep}examples${path.sep}`) !== record.data.demo) throw new Error(`示例标记与目录不一致：${file}`);
    return record;
  }).sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt) || a.data.id.localeCompare(b.data.id));
}

export function contentHash(record) {
  return createHash('sha256').update(JSON.stringify([
    record.data.title, record.data.question, record.body.trimEnd(), record.data.manualTags,
  ])).digest('hex');
}

function save(file, data, body, exclusive = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, matter.stringify(body, data), { encoding: 'utf8', flag: exclusive ? 'wx' : 'w' });
}

export function createRecord(input, { root = process.cwd(), now = new Date().toISOString() } = {}) {
  const answer = text.parse(input.answer);
  const createdAt = input.createdAt ?? now;
  const data = recordSchema.parse({
    id: input.id ?? randomUUID(), title: input.title, question: input.question,
    source: input.source ?? 'codex', createdAt,
    answeredAt: input.answeredAt ?? now, updatedAt: input.answeredAt ?? now,
    tags: input.tags ?? [], manualTags: input.manualTags ?? [], demo: false,
  });
  const records = readRecords(root);
  const existing = records.find(record => record.data.id === data.id);
  if (existing) {
    if (existing.data.title === data.title && existing.data.question === data.question && existing.body.trim() === answer.trim()) {
      return { id: data.id, file: existing.file, unchanged: true };
    }
    throw new Error('这个 ID 已存在且内容不同；追问请使用 append');
  }
  const knownTags = new Set(readTaxonomy(root).map(tag => tag.id));
  if ([...data.tags, ...data.manualTags].some(tag => !knownTags.has(tag))) throw new Error('请先在 content/tags.json 中注册标签');
  if (data.manualTags.some(tag => !data.tags.includes(tag))) throw new Error('固定标签必须包含在 tags 中');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(new Date(data.createdAt));
  const year = parts.find(part => part.type === 'year').value;
  const month = parts.find(part => part.type === 'month').value;
  const file = path.join(root, 'content/questions', year, month, `${data.id}.md`);
  save(file, data, `\n${answer}\n`, true);
  return { id: data.id, file, unchanged: false };
}

export function appendTurn(id, input, { root = process.cwd(), now = new Date().toISOString() } = {}) {
  idSchema.parse(id);
  const turnId = idSchema.parse(input.turnId);
  const question = text.parse(input.question);
  const answer = text.parse(input.answer);
  const record = readRecords(root, false).find(item => item.data.id === id);
  if (!record) throw new Error('找不到这道题');
  const marker = `<!-- turn:${turnId} -->`;
  const existingIndex = record.body.indexOf(marker);
  if (existingIndex >= 0) {
    const existing = record.body.slice(existingIndex).trimEnd();
    const storedTime = existing.match(/^<!-- turn:[a-z0-9-]+ -->\n\n## 追问 · ([^\n]+)\n\n/);
    const prefix = `${marker}\n\n## 追问 · ${input.createdAt ? timestamp.parse(input.createdAt) : storedTime?.[1]}\n\n${question}\n\n### 回答 · `;
    if (!existing.startsWith(prefix)) throw new Error('追问 ID 已存在且内容不同');
    const storedAnswerTime = existing.slice(prefix.length).split('\n\n')[0];
    const candidate = `${prefix}${input.answeredAt ? timestamp.parse(input.answeredAt) : storedAnswerTime}\n\n${answer.trimEnd()}`;
    if (existing !== candidate && !existing.startsWith(`${candidate}\n\n<!-- turn:`)) throw new Error('追问 ID 已存在且内容不同');
    return { id, file: record.file, unchanged: true };
  }
  const askedAt = timestamp.parse(input.createdAt ?? now);
  const answeredAt = timestamp.parse(input.answeredAt ?? now);
  if (answeredAt < askedAt || askedAt < record.data.createdAt) throw new Error('追问时间顺序不正确');
  const turn = `${marker}\n\n## 追问 · ${askedAt}\n\n${question}\n\n### 回答 · ${answeredAt}\n\n${answer}`;
  if (askedAt < record.data.updatedAt) throw new Error('新的追问不能早于已有记录');
  save(record.file, { ...record.data, updatedAt: answeredAt }, `${record.body.trimEnd()}\n\n${turn}\n`);
  return { id, file: record.file, unchanged: false };
}

export function pendingRecords(root = process.cwd()) {
  return readRecords(root, false).filter(record => !record.data.taggedAt || record.data.taggedAt < record.data.updatedAt)
    .map(record => ({ id: record.data.id, title: record.data.title, path: path.relative(root, record.file).replaceAll('\\', '/'),
      tags: record.data.tags, manualTags: record.data.manualTags, expectedHash: contentHash(record) }));
}

export function applyTags(updates, { root = process.cwd(), now = new Date().toISOString() } = {}) {
  const input = z.array(z.object({ id: idSchema, tags: z.array(z.string()), expectedHash: z.string() })).parse(updates);
  if (new Set(input.map(update => update.id)).size !== input.length) throw new Error('同一题不能重复整理');
  const knownTags = new Set(readTaxonomy(root).map(tag => tag.id));
  const records = readRecords(root, false);
  // Validate the whole batch before writing any file.
  const changes = input.map(update => {
    const record = records.find(item => item.data.id === update.id);
    if (!record || contentHash(record) !== update.expectedHash) throw new Error(`题目已变化，请重新读取：${update.id}`);
    const tags = [...new Set([...update.tags, ...record.data.manualTags])];
    if (tags.some(tag => !knownTags.has(tag))) throw new Error('存在未注册的标签');
    return { record, data: { ...record.data, tags, taggedAt: timestamp.parse(now) } };
  });
  for (const { record, data } of changes) save(record.file, data, record.body);
  return changes.map(({ record }) => record.data.id);
}
