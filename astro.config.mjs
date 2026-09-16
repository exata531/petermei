// @ts-check
import { defineConfig } from 'astro/config';
/* click any sentence and type; runs under `npm run dev` only, adds nothing to a build */
import editMode from './src/integrations/edit';

export default defineConfig({
  site: 'https://petermei.com',
  output: 'static',
  trailingSlash: 'never',
  build: { inlineStylesheets: 'auto' },
  integrations: [editMode()],
  vite: {
    build: {
      /* A font is never folded into the stylesheet as a data URI. The site's
         own Content Security Policy says font-src 'self', which a data: URI is
         not, so an inlined font is fetched and then blocked and the page
         silently falls back to the system face. That shipped once (09-16) and
         looked exactly like the new font never having deployed.
         Loosening the policy would have been the other way to fix it; a real
         file served from this origin costs one small request and keeps the
         header as strict as it was. */
      assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    },
  },
});
