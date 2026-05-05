# 8bit blogs

Personal blog built with Eleventy and deployed with GitHub Pages.

The site is designed for Markdown-first writing with colocated assets. Each article gets its own folder, so images, videos, diagrams, and demos can live next to the article that uses them.

## Quick Start

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Open:

```text
http://localhost:8080
```

Build the production site:

```bash
npm run build
```

The generated site is written to `_site/`. Do not commit `_site/`; GitHub Pages builds it during deployment.

## Project Structure

```text
src/
  _data/site.json              Site title, author, URL, GitHub link
  _includes/layouts/base.njk   Main page shell, nav, search, theme toggle
  _includes/layouts/post.njk   Blog article layout
  assets/
    css/styles.css             Site styling
    js/main.js                 Search, theme, image fallback, Gist rendering
    img/brand-logo.jpg         Header logo
  blog/
    article-folder/
      index.md                 Article content
      cover.png                Optional cover image
      image-01.png             Article images
```

## Creating a New Article

You can write articles in two ways:

- Use the browser composer at `/compose/`.
- Create the article folder and Markdown file manually.

## Browser Composer

Open:

```text
/compose/
```

The composer gives you:

- Metadata controls for title, slug, description, date, tags, cover, and cover alt text.
- A Markdown editor with a live preview.
- A separate preview page at `/compose/preview/`.
- Slash commands. Type `/` on a new line to insert supported blocks.
- Toolbar buttons for headings, code, image, YouTube, Gist, math, quote, and interactive demos.
- Local media upload for images and videos. Uploaded files are published into the same article folder.
- Copy Markdown button for manual publishing.
- Publish PR button that creates a GitHub branch, commits the article, uploads media, and opens a pull request to `main`.

Supported slash blocks:

```text
/h2
/code
/image
/video
/youtube
/gist
/math
/quote
/demo
/table
/callout
```

Publishing from the composer requires a GitHub token in your browser. Use a fine-grained token with access to this repository and these permissions:

```text
Contents: Read and write
Pull requests: Read and write
Metadata: Read-only
```

Create the token from the same GitHub account that owns or can write to `8bitnand/8bitnand.github.io`. If GitHub says `must be a collaborator`, the token is usually from the wrong account or does not have write access to the repository.

The token is only used in your browser. If you select "Remember token", it is stored in browser localStorage.

The composer does not push directly to `main`. It creates a branch like:

```text
post/my-article-title-1770000000000
```

Then it opens a pull request into `main`.

## Manual Article Creation

Create a new folder under `src/blog/`:

```text
src/blog/my-new-article/
  index.md
  cover.png
  diagram.png
```

Use this starter `index.md`:

```md
---
layout: post.njk
title: "My New Article"
description: "Short summary shown on the home page, archive, search, and related cards."
date: 2026-04-28
cover: "./cover.png"
coverAlt: "Short description of the cover image"
tags:
  - "posts"
  - "ai"
  - "tutorial"
---

Write the article here.
```

Important:

- Add `posts` to `tags` if the article should appear on the home page, archive, RSS feed, search, and sitemap.
- Use `draft: true` in front matter to hide an article from public collections.
- `description` is used for cards and search previews, not printed at the top of article pages.
- The folder name becomes the URL. Example: `src/blog/my-new-article/index.md` becomes `/blog/my-new-article/`.

## Front Matter Options

```md
---
layout: post.njk
title: "Article Title"
description: "Card and search summary."
date: 2026-04-28
cover: "./cover.png"
coverAlt: "Accessible image description"
hideCover: false
draft: false
sourceUrl: "https://old-site.example/post"
tags:
  - "posts"
  - "transformers"
  - "ai"
---
```

Available fields:

- `layout`: use `post.njk` for articles.
- `title`: article title.
- `description`: homepage/search/related article summary.
- `date`: publication date.
- `cover`: optional local or remote cover image.
- `coverAlt`: alt text for the cover image.
- `hideCover`: set `true` if you do not want the cover image inside the article page.
- `draft`: set `true` to keep the post out of public listings.
- `sourceUrl`: optional reference to an original source.
- `tags`: used for tag pages and related articles. Keep `posts` for published posts.

## Markdown Features

### Headings

```md
## Section

### Subsection
```

Headings automatically get anchor links, so readers can link to sections.

### Code Blocks

Use fenced code blocks with a language name:

````md
```js
function hello() {
  console.log("hello");
}
```
````

Syntax highlighting is enabled through Eleventy.

### Inline Code

```md
Use `npm run build` before publishing.
```

### Images

Keep images in the same article folder and reference them with a relative path:

```md
![Architecture diagram](./diagram.png)
```

If a cover image is missing, the site skips the image area instead of leaving blank space.

### Local Videos

Put the video file inside the article folder:

```text
src/blog/my-new-article/demo.mp4
```

Then embed it with HTML:

```html
<video controls playsinline>
  <source src="./demo.mp4" type="video/mp4">
</video>
```

The Eleventy config copies `mp4` and `webm` files from blog folders into the built site.

### YouTube Embeds

Use Hashnode-style embed syntax on its own line:

```md
%[https://youtu.be/TCwNhwMUE4k]
```

This renders as an embedded YouTube player.

### GitHub Gist Embeds

Use a Gist URL on its own line:

```md
%[https://gist.github.com/8bitnand/85e1c042af6c78b975084b7ffc1a26e6]
```

The site fetches the Gist in the browser and renders the code with line numbers. If JavaScript is disabled, the reader still gets a link to the Gist.

### External Link Cards

Any other Hashnode-style embed URL becomes a simple link card:

```md
%[https://example.com/demo]
```

### Math and LaTeX

MathJax is enabled globally.

Inline math:

```md
The value is $x^2 + y^2$.
```

Block math:

```md
$$
PE_{(pos, 2i)} = \sin\left(\frac{pos}{10000^{2i/d_{model}}}\right)
$$
```

### Interactive Demos

For simple external demos, use an iframe:

```html
<figure class="interactive-demo">
  <iframe src="https://nandnerf.netlify.app/" title="Interactive volumetric rendering demo" loading="lazy"></iframe>
  <figcaption>
    <a href="https://nandnerf.netlify.app/" target="_blank" rel="noopener noreferrer">Open the interactive demo in a new tab</a>
  </figcaption>
</figure>
```

Use this only when the external page allows embedding.

## Built-In Site Features

### Home Page

The home page lists published posts from newest to oldest. Posts come from:

```text
src/blog/**/index.md
```

The post must not be a draft and should include the `posts` tag.

### Archive

The archive page is generated at:

```text
/archive/
```

### Search

Search is available from the magnifying glass in the nav bar. It searches the generated `search.json`, which includes article title, description, tags, URL, and rendered content.

### Related Articles

Related articles appear at the bottom of article pages. They are chosen by matching tags with the current article.

Example:

```md
tags:
  - "posts"
  - "transformers"
  - "ai"
```

An article with the same `transformers` or `ai` tag can appear as related.

### Tag Pages

Each tag gets a page:

```text
/tags/transformers/
```

The `posts` tag is used internally and is hidden from the article tag list.

### RSS Feed

RSS is generated at:

```text
/feed.xml
```

### Sitemap

Sitemap is generated at:

```text
/sitemap.xml
```

### Theme Toggle

The nav has a light/dark theme toggle. The selected theme is saved in the browser.

### Header Logo

The nav logo lives here:

```text
src/assets/img/brand-logo.jpg
```

Replace that file if you want to change the logo.

### Site Metadata

Edit:

```text
src/_data/site.json
```

Example:

```json
{
  "title": "8bit blogs",
  "description": "Technical notes, experiments, and explainers.",
  "url": "https://8bitnand.github.io",
  "author": "Nandeesh",
  "github": "https://github.com/8bitnand"
}
```

## Publishing

This repo uses GitHub Actions to deploy to GitHub Pages.

The workflow is:

```text
.github/workflows/pages.yml
```

When code is merged into `main`, GitHub Actions runs:

```bash
npm ci
npm run build
```

Then it deploys `_site/` to GitHub Pages.

The public URL is:

```text
https://8bitnand.github.io/
```

Do not push directly to `main` or `stge`. Create a branch, push it, and open a pull request.

Typical flow:

```bash
git switch -c codex/new-article
git add src/blog/my-new-article
git commit -m "Add my new article"
git push -u origin codex/new-article
```

Then open a pull request into `main`.

## Useful Commands

```bash
npm run dev      # Start local dev server
npm run build    # Build production site
npm run clean    # Delete _site
```

## Troubleshooting

If an article does not appear on the home page:

- Check that it is under `src/blog/<slug>/index.md`.
- Check that `draft: true` is not set.
- Check that `tags` includes `posts`.
- Restart the dev server if Eleventy did not pick up a new folder.

If an image does not show:

- Keep the image in the same article folder.
- Use a relative path like `./image.png`.
- Check the file extension and capitalization.

If a Gist does not render:

- Make sure the URL is on its own line.
- Use the `%[https://gist.github.com/...]` format.
- Check the browser console for GitHub API rate-limit errors.

If LaTeX does not render:

- Use `$...$` for inline math.
- Use `$$...$$` for block math.
- Make sure the equation is not inside a code block.

## Thanks

This blog is built with help from open-source tools and publishing platforms:

- [Eleventy](https://www.11ty.dev/) for static site generation.
- [GitHub Pages](https://pages.github.com/) and [GitHub Actions](https://github.com/features/actions) for hosting and deployment.
- [MathJax](https://www.mathjax.org/) for LaTeX and equation rendering.
- [Prism / Eleventy Syntax Highlight](https://www.11ty.dev/docs/plugins/syntaxhighlight/) for code highlighting.
- [markdown-it-anchor](https://github.com/valeriangalliat/markdown-it-anchor) for heading links.
- [GitHub Gist](https://gist.github.com/) for embeddable code snippets.
