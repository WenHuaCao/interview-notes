import { defineConfig } from 'astro/config';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

export default defineConfig({
  site: 'https://wenhuacao.github.io',
  base: '/interview-notes',
  trailingSlash: 'always',
  output: 'static',
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: { theme: 'github-light' },
    remarkRehype: { allowDangerousHtml: false },
    rehypePlugins: [[rehypeSanitize, { ...defaultSchema, attributes: {
      ...defaultSchema.attributes,
      span: [...(defaultSchema.attributes.span ?? []), 'style', 'className'],
      pre: [...(defaultSchema.attributes.pre ?? []), 'style', 'className', 'tabIndex'],
    } }]],
  },
});
