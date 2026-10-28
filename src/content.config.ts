import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { recordSchema } from '../lib/records.mjs';

export const collections = {
  questions: defineCollection({ loader: glob({ pattern: '**/*.md', base: './content', generateId: ({ data }) => String(data.id) }), schema: recordSchema }),
};
