export const STORAGE_KEY = 'interview-notes:review:v1';
export const INTERVALS = [1, 3, 7, 14, 30];
/** @typedef {{step:number, rating:string, reviews:number, lastReviewedAt:string, dueAt:string}} ReviewEntry */
/** @typedef {{version:1, entries:Record<string, ReviewEntry>}} Progress */
const idPattern = /^[a-z0-9][a-z0-9-]{5,79}$/;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));

/** @param {Date|string} date */
export function dateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(date));
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}
/** @param {{dueAt:string}|undefined} entry */
export function isDue(entry, now = new Date()) {
  return !entry || dateKey(entry.dueAt) <= dateKey(now);
}
/** @param {ReviewEntry|undefined} previous @param {string} rating @returns {ReviewEntry} */
export function scheduleReview(previous, rating, now = new Date()) {
  if (!['forgot', 'fuzzy', 'remembered'].includes(rating)) throw new Error('未知的复习反馈');
  const current = previous?.step ?? 0;
  let step = current;
  let days;
  if (rating === 'forgot') { step = 0; days = 1; }
  else if (rating === 'fuzzy') days = INTERVALS[Math.max(0, current - 1)];
  else { days = INTERVALS[current]; step = Math.min(current + 1, INTERVALS.length - 1); }
  return { step, rating, reviews: (previous?.reviews ?? 0) + 1,
    lastReviewedAt: new Date(now).toISOString(), dueAt: new Date(new Date(now).getTime() + days * 86400000).toISOString() };
}
/** @returns {Progress} */
export function parseProgress(value) {
  const progress = typeof value === 'string' ? JSON.parse(value) : value;
  if (!progress || progress.version !== 1 || !progress.entries || typeof progress.entries !== 'object' || Array.isArray(progress.entries)) throw new Error('不是受支持的复习备份（版本 1）');
  /** @type {Record<string, ReviewEntry>} */
  const entries = {};
  for (const [id, entry] of Object.entries(progress.entries)) {
    if (!idPattern.test(id) || !entry || !Number.isInteger(entry.step) || entry.step < 0 || entry.step >= INTERVALS.length ||
      !Number.isInteger(entry.reviews) || entry.reviews < 1 || !validDate(entry.dueAt) || !validDate(entry.lastReviewedAt) ||
      !['forgot', 'fuzzy', 'remembered'].includes(entry.rating) || Date.parse(entry.dueAt) < Date.parse(entry.lastReviewedAt)) {
      throw new Error('复习备份含有无效记录，未导入任何数据');
    }
    entries[id] = { step: entry.step, reviews: entry.reviews, rating: entry.rating,
      dueAt: new Date(entry.dueAt).toISOString(), lastReviewedAt: new Date(entry.lastReviewedAt).toISOString() };
  }
  return { version: 1, entries };
}
/** @returns {Progress} */
export function readProgress(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw ? parseProgress(raw) : { version: 1, entries: {} };
}
export function mergeProgress(current, incoming) {
  const next = parseProgress(current);
  for (const [id, entry] of Object.entries(parseProgress(incoming).entries)) {
    if (!next.entries[id] || entry.lastReviewedAt >= next.entries[id].lastReviewedAt) next.entries[id] = entry;
  }
  return next;
}
