import { STORAGE_KEY, readProgress, parseProgress, mergeProgress, scheduleReview, dateKey, isDue } from '../lib/review.mjs';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const cards = [...document.querySelectorAll<HTMLElement>('[data-card-id]')];
const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-rating]')];
const all = byId<HTMLInputElement>('review-all');
const tag = byId<HTMLSelectElement>('review-tag');
const warning = byId('review-warning');
const feedback = byId('review-feedback');
let progress: ReturnType<typeof parseProgress> = { version: 1, entries: {} };
let storage: Storage | undefined;
let damaged = false;
let originalRaw: string | null = null;
let active: HTMLElement | undefined;
const practiced = new Set<string>();
function warn(message: string) { warning.hidden = false; warning.textContent = message; }
try {
  storage = window.localStorage;
  originalRaw = storage.getItem(STORAGE_KEY);
  try { progress = readProgress(storage); }
  catch { damaged = true; warn('已有进度无法读取。为保护数据，已暂停评分；请先导出原始备份，再导入有效备份恢复。'); }
} catch { storage = undefined; warn('当前浏览器不允许本地存储。本次进度仅暂存于页面，请在离开前导出备份。'); }

const focusedId = new URLSearchParams(location.search).get('id');
if (focusedId && cards.some(card => card.dataset.cardId === focusedId)) all.checked = true;
function refresh() {
  cards.forEach(card => { card.hidden = true; });
  const matching = cards.filter(card => !tag.value || card.dataset.cardTags!.split(',').includes(tag.value));
  const due = matching.filter(card => isDue(progress.entries[card.dataset.cardId!]));
  let queue = (all.checked ? matching : due).filter(card => !practiced.has(card.dataset.cardId!));
  queue = queue.sort((a, b) => {
    if (focusedId === a.dataset.cardId) return -1;
    if (focusedId === b.dataset.cardId) return 1;
    return (progress.entries[a.dataset.cardId!]?.dueAt ?? '').localeCompare(progress.entries[b.dataset.cardId!]?.dueAt ?? '');
  });
  active = queue[0];
  byId('review-pending').textContent = String(due.filter(card => !practiced.has(card.dataset.cardId!)).length);
  byId('review-done').textContent = String(cards.filter(card => {
    const entry = progress.entries[card.dataset.cardId!];
    return entry && dateKey(entry.lastReviewedAt) === dateKey();
  }).length);
  byId('review-empty').hidden = Boolean(active);
  byId('review-ratings').hidden = !active;
  buttons.forEach(button => { button.disabled = true; });
  if (active) {
    active.hidden = false;
    active.querySelector<HTMLDetailsElement>('details')!.open = false;
    active.querySelector('[data-card-position]')!.textContent = `剩余 ${queue.length} 道`;
  }
}
cards.forEach(card => card.querySelector('details')!.addEventListener('toggle', event => {
  if (card !== active) return;
  buttons.forEach(button => { button.disabled = damaged || !(event.target as HTMLDetailsElement).open; });
}));
buttons.forEach(button => button.addEventListener('click', () => {
  if (!active || damaged || !active.querySelector<HTMLDetailsElement>('details')!.open) return;
  const id = active.dataset.cardId!;
  // Read again before writing, so a different tab's newest ratings survive.
  if (storage) {
    try { progress = mergeProgress(progress, readProgress(storage)); }
    catch { damaged = true; warn('浏览器中的进度已发生异常，已暂停保存。请导出备份后恢复。'); buttons.forEach(item => { item.disabled = true; }); return; }
  }
  const entry = scheduleReview(progress.entries[id], button.dataset.rating!);
  progress.entries[id] = entry;
  if (storage) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
    catch { storage = undefined; warn('本地保存失败。本次进度仍在页面内，请立即导出备份，避免离开后丢失。'); }
  }
  practiced.add(id);
  feedback.textContent = `已记录这次回忆。下次复习：${dateKey(entry.dueAt)}。`;
  window.dispatchEvent(new Event('review-change'));
  refresh();
  if (active) active.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}));
all.addEventListener('change', () => { practiced.clear(); refresh(); });
tag.addEventListener('change', () => { practiced.clear(); refresh(); });
byId('export-progress').addEventListener('click', () => {
  const contents = damaged && originalRaw ? originalRaw : JSON.stringify({ ...progress, exportedAt: new Date().toISOString() }, null, 2);
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `拾问-复习进度-${dateKey()}${damaged ? '-原始数据' : ''}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  feedback.textContent = damaged ? '已导出原始数据，请妥善保存。' : '复习进度已导出。';
});
byId<HTMLInputElement>('import-progress').addEventListener('change', async event => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0]; if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('备份超过 2 MB，未导入');
    const incoming = parseProgress(await file.text());
    let current = damaged ? { version: 1, entries: {} } : progress;
    if (storage && !damaged) current = mergeProgress(current, readProgress(storage));
    const merged = mergeProgress(current, incoming);
    if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(merged));
    progress = merged; damaged = false; originalRaw = null;
    if (storage) warning.hidden = true;
    practiced.clear(); refresh(); window.dispatchEvent(new Event('review-change'));
    feedback.textContent = `已合并 ${Object.keys(incoming.entries).length} 条复习记录，保留较新的进度。`;
  } catch (error) { feedback.textContent = `导入失败：${error instanceof Error ? error.message : '文件无法读取'}。已有进度未更改。`; }
  input.value = '';
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || !storage) return;
  try { progress = readProgress(storage); damaged = false; practiced.clear(); refresh(); feedback.textContent = '已同步此浏览器其他标签页的最新进度。'; }
  catch { damaged = true; originalRaw = event.newValue; warn('其他标签页写入了无法读取的进度，已暂停评分。请导出备份后恢复。'); buttons.forEach(button => { button.disabled = true; }); }
});
refresh();
