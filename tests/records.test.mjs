import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRecord, appendTurn, readRecords, pendingRecords, applyTags, contentHash, readTaxonomy } from '../lib/records.mjs';

function workspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'interview-notes-'));
  fs.mkdirSync(path.join(root, 'content'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content/tags.json'), JSON.stringify([
    { id: 'javascript', label: 'JavaScript', aliases: ['JS'], description: '' },
    { id: 'browser', label: '浏览器', aliases: [], description: '' },
  ]));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
const now = '2026-10-28T10:00:00.000Z';
function question(overrides = {}) { return { id: 'test-question-one', title: '解释闭包', question: '原题：闭包是什么？\n请举例。', answer: '完整回答。\n\n```js\nconst x = 1;\n```', source: 'codex', tags: ['javascript'], ...overrides }; }

test('归档保留原题、代码与带时区时间，重试不创建重复记录', t => {
  const root = workspace(t);
  const saved = createRecord(question(), { root, now });
  assert.equal(saved.unchanged, false);
  assert.equal(createRecord(question(), { root, now: '2026-10-29T00:00:00Z' }).unchanged, true);
  const [record] = readRecords(root);
  assert.equal(record.data.question, question().question);
  assert.equal(record.body.trim(), question().answer);
  assert.equal(record.data.createdAt, now);
  assert.match(saved.file, /2026[\\/]10[\\/]test-question-one\.md$/);
  assert.throws(() => createRecord(question({ answer: '被改变的回答' }), { root, now }), /已存在/);
});
test('年月目录使用北京时间，归档排序不受更新时间影响', t => {
  const root = workspace(t);
  createRecord(question({ id: 'test-before-midnight' }), { root, now: '2026-09-30T15:59:00Z' });
  const saved = createRecord(question({ id: 'test-after-midnight' }), { root, now: '2026-09-30T16:01:00Z' });
  assert.match(saved.file, /2026[\\/]10[\\/]/);
  appendTurn('test-before-midnight', { turnId: 'followup-original', question: '追问？', answer: '答复。' }, { root, now });
  const records = readRecords(root);
  assert.equal(records[0].data.id, 'test-after-midnight');
  assert.equal(records[1].data.createdAt, '2026-09-30T15:59:00.000Z');
});
test('追问追加原文，重复追问不重复，ID冲突和倒置时间被拒绝', t => {
  const root = workspace(t);
  createRecord(question(), { root, now });
  const followup = { turnId: 'followup-first', question: '为什么？', answer: '追问完整回答。', createdAt: '2026-10-28T10:02:00Z', answeredAt: '2026-10-28T10:03:00Z' };
  assert.equal(appendTurn('test-question-one', followup, { root, now }).unchanged, false);
  assert.equal(appendTurn('test-question-one', followup, { root, now }).unchanged, true);
  const [record] = readRecords(root);
  assert.equal(record.data.createdAt, now);
  assert.equal(record.data.updatedAt, '2026-10-28T10:03:00.000Z');
  assert.ok(record.body.includes(question().answer));
  assert.ok(record.body.includes('追问完整回答。'));
  assert.throws(() => appendTurn('test-question-one', { ...followup, answer: '不同内容' }, { root, now }), /内容不同/);
  assert.throws(() => appendTurn('test-question-one', { ...followup, turnId: 'followup-second', answeredAt: '2026-10-28T09:00:00Z' }, { root, now }), /时间/);
});
test('标签整理幂等、保留固定标签和原文，新追问再次进入待整理', t => {
  const root = workspace(t);
  createRecord(question({ manualTags: ['javascript'] }), { root, now });
  const before = readRecords(root)[0];
  const [pending] = pendingRecords(root);
  applyTags([{ id: before.data.id, tags: ['browser'], expectedHash: pending.expectedHash }], { root, now: '2026-10-28T13:00:00Z' });
  const after = readRecords(root)[0];
  assert.deepEqual(after.data.tags, ['browser', 'javascript']);
  assert.equal(after.data.updatedAt, before.data.updatedAt);
  assert.equal(after.data.createdAt, before.data.createdAt);
  assert.equal(after.body, before.body);
  assert.deepEqual(pendingRecords(root), []);
  appendTurn(before.data.id, { turnId: 'followup-tags-test', question: '追问', answer: '新答案' }, { root, now: '2026-10-29T00:00:00Z' });
  assert.equal(pendingRecords(root).length, 1);
  assert.throws(() => applyTags([{ id: before.data.id, tags: [], expectedHash: contentHash(before) }], { root, now }), /已变化/);
});
test('追问重试未传时间时复用原有时间，不因重试时刻变化重复追加', t => {
  const root = workspace(t);
  createRecord(question(), { root, now });
  const followup = { turnId: 'retry-without-timestamps', question: '另一种解释？', answer: '原始解释。' };
  appendTurn('test-question-one', followup, { root, now: '2026-10-28T10:01:00Z' });
  const before = readRecords(root)[0];
  assert.equal(appendTurn('test-question-one', followup, { root, now: '2026-10-29T12:00:00Z' }).unchanged, true);
  assert.deepEqual(readRecords(root)[0], before);
});
test('整批标签先校验，不因第二条无效而部分修改', t => {
  const root = workspace(t);
  createRecord(question(), { root, now });
  createRecord(question({ id: 'test-question-two' }), { root, now });
  const before = readRecords(root);
  assert.throws(() => applyTags(before.map((record, i) => ({ id: record.data.id, tags: i ? ['unknown'] : ['browser'], expectedHash: contentHash(record) })), { root, now }), /未注册/);
  assert.deepEqual(readRecords(root).map(record => record.data), before.map(record => record.data));
});
test('拒绝路径注入、未知标签、无效时间、重复ID及标签别名冲突', t => {
  const root = workspace(t);
  assert.throws(() => createRecord(question({ id: '../outside-file' }), { root, now }));
  assert.throws(() => createRecord(question({ tags: ['unknown'] }), { root, now }));
  assert.throws(() => createRecord(question({ createdAt: 'yesterday' }), { root, now }));
  assert.throws(() => createRecord(question({ createdAt: '2026-10-29T00:00:00Z' }), { root, now }));
  const saved = createRecord(question(), { root, now });
  fs.copyFileSync(saved.file, path.join(path.dirname(saved.file), 'duplicate.md'));
  assert.throws(() => readRecords(root), /重复题目 ID/);
  fs.writeFileSync(path.join(root, 'content/tags.json'), JSON.stringify([
    { id: 'javascript', label: 'JS', aliases: [] }, { id: 'browser', label: '浏览器', aliases: ['js'] },
  ]));
  assert.throws(() => readTaxonomy(root), /别名冲突/);
});
