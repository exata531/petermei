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
});
