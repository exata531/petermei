# Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Editing the words

Run `npm run dev`, open the site, and click **Edit text** in the bottom left
corner. Every sentence grows a dotted outline. Click one, type, and press Enter
or click somewhere else. The words go back into the file they came from and the
page reloads with them in it.

It only changes a sentence that appears exactly once in the project. A short one
like "Work" or a product's name is in dozens of places, so it is refused out loud
and nothing is touched: edit a longer line that only exists once, or change that
one by hand. Picking the likeliest match was tried and it wrote to the wrong file
on the first test, so it refuses instead of guessing. A line the page builds out
of pieces is not one run of characters in the source either, and it says so.

This whole thing runs only under `npm run dev`. Nothing about it is in a build, so
nothing about it ever reaches petermei.com.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
