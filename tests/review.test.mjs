import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleReview, parseProgress, mergeProgress, isDue, dateKey, readProgress } from '../src/lib/review.mjs';
const now = new Date('2026-10-28T10:00:00Z');

test('记住按1、3、7、14、30天递进，30天封顶', () => {
  let entry;
  for (const days of [1, 3, 7, 14, 30, 30]) {
    entry = scheduleReview(entry, 'remembered', now);
    assert.equal(Date.parse(entry.dueAt) - now.getTime(), days * 86400000);
  }
  assert.equal(entry.reviews, 6);
  assert.equal(entry.step, 4);
});
test('模糊保持上次间隔，忘记重置为一天且下次记住从一天开始', () => {
  const first = scheduleReview(undefined, 'remembered', now);
  const second = scheduleReview(first, 'remembered', now);
  const fuzzy = scheduleReview(second, 'fuzzy', now);
  assert.equal(Date.parse(fuzzy.dueAt) - now.getTime(), 3 * 86400000);
  assert.equal(fuzzy.step, second.step);
  const forgot = scheduleReview(second, 'forgot', now);
  assert.equal(forgot.step, 0);
  assert.equal(Date.parse(forgot.dueAt) - now.getTime(), 86400000);
  assert.equal(scheduleReview(forgot, 'remembered', now).step, 1);
});
test('未复习题当天到期，日期以北京时间划分且不受宿主时区影响', () => {
  assert.equal(isDue(undefined, now), true);
  assert.equal(dateKey('2026-09-30T16:00:00Z'), '2026-10-01');
  assert.equal(isDue({ dueAt: '2026-10-28T15:59:00Z' }, now), true);
  assert.equal(isDue({ dueAt: '2026-10-28T16:00:00Z' }, now), false);
});
test('备份往返和合并保留较新记录，不修改传入对象', () => {
  const old = scheduleReview(undefined, 'forgot', now);
  const newer = scheduleReview(old, 'remembered', new Date('2026-10-29T10:00:00Z'));
  const current = { version: 1, entries: { 'test-question-one': old } };
  const incoming = { version: 1, entries: { 'test-question-one': newer } };
  assert.deepEqual(parseProgress(JSON.stringify(incoming)), incoming);
  assert.deepEqual(mergeProgress(current, incoming), incoming);
  assert.deepEqual(mergeProgress(incoming, current), incoming);
  assert.equal(current.entries['test-question-one'], old);
});
test('拒绝损坏备份、未知版本、原型污染键和不合理日期', () => {
  const valid = scheduleReview(undefined, 'remembered', now);
  for (const bad of [null, {}, { version: 2, entries: {} }, { version: 1, entries: [] },
    { version: 1, entries: { 'test-question-one': { ...valid, step: -1 } } },
    { version: 1, entries: { 'test-question-one': { ...valid, dueAt: 'yesterday' } } },
    { version: 1, entries: { 'test-question-one': { ...valid, dueAt: '2020-01-01T00:00:00Z' } } },
    JSON.parse(`{"version":1,"entries":{"__proto__":${JSON.stringify(valid)}}}`)]) assert.throws(() => parseProgress(bad));
  assert.throws(() => parseProgress('{invalid'));
  assert.deepEqual(readProgress({ getItem: () => null }), { version: 1, entries: {} });
  assert.throws(() => readProgress({ getItem: () => '{invalid' }));
  assert.equal({}.polluted, undefined);
});
