import { getCollection, type CollectionEntry } from 'astro:content';
import tags from '../../content/tags.json';

export type Question = CollectionEntry<'questions'>;
export { tags };
export { base, href } from './urls';
export function formatDate(value: string, full = false) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    ...(full ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value));
}
export function monthKey(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(new Date(value));
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
}
export async function catalog() {
  const all = (await getCollection('questions')).sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt) || a.data.id.localeCompare(b.data.id));
  const real = all.filter(post => !post.data.demo);
  return { all, real, active: real.length ? real : all.filter(post => post.data.demo), demo: real.length === 0 };
}
export function tagLabel(id: string) { return tags.find(tag => tag.id === id)?.label ?? id; }
