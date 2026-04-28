import fs from "node:fs/promises";
import path from "node:path";

const FEED_URL = "https://8bitnand.wixsite.com/nand/blog-feed.xml";
const OUT_DIR = path.resolve("src/blog");

function decodeHtml(value = "") {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#010;/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugFromUrl(url, title) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts.at(-1) || slugify(title);
  } catch {
    return slugify(title);
  }
}

function field(item, name) {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
  return match ? decodeHtml(match[1]) : "";
}

function enclosure(item) {
  const match = item.match(/<enclosure[^>]+url="([^"]+)"/);
  return match ? decodeHtml(match[1]) : "";
}

function extFromUrl(url, fallback = ".jpg") {
  const clean = url.split("?")[0];
  const match = clean.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)(?:\/|$)/i);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : fallback;
}

async function download(url, filePath) {
  if (!url) return false;
  const response = await fetch(url);
  if (!response.ok) return false;
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, bytes);
  return true;
}

function extractJsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}

function stripTags(html) {
  return decodeHtml(
    html
      .replace(/<br[^>]*>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  );
}

function extractBody(html) {
  const sectionMatch = html.match(/<section class="[^"]*" data-hook="post-description">([\s\S]*?)<\/section><footer/);
  const section = sectionMatch ? sectionMatch[1] : "";
  if (!section) return { markdown: "", images: [] };

  const images = [];
  for (const match of section.matchAll(/data-pin-media="([^"]+)"/g)) {
    const url = decodeHtml(match[1]);
    if (!images.includes(url)) images.push(url);
  }

  const parts = [];
  for (const match of section.matchAll(/<div data-breakout="normal">([\s\S]*?)(?=<div type=|<div data-breakout=|<\/div><\/div><\/div><\/div><\/section>)/g)) {
    const block = match[1];
    if (block.includes('data-hook="figure-IMAGE"')) {
      const imageMatch = block.match(/data-pin-media="([^"]+)"/);
      if (imageMatch) {
        const url = decodeHtml(imageMatch[1]);
        const index = images.indexOf(url) + 1;
        parts.push(`![Imported image](./image-${String(index).padStart(2, "0")}${extFromUrl(url)})`);
      }
      continue;
    }

    const text = stripTags(block);
    if (!text) continue;

    if (text.length < 90 && !/[.!?]$/.test(text)) {
      parts.push(`## ${text}`);
    } else {
      parts.push(text);
    }
  }

  return {
    markdown: parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim(),
    images
  };
}

function frontMatter(post, coverExt, body) {
  const tags = ["posts", post.category || "imported"].map((tag) => tag.toLowerCase());
  return `---\nlayout: post.njk\ntitle: ${JSON.stringify(post.title)}\ndescription: ${JSON.stringify(post.description)}\ndate: ${post.date}\ncover: "./cover${coverExt}"\ncoverAlt: ${JSON.stringify(post.title)}\nsourceUrl: ${JSON.stringify(post.link)}\ntags:\n${tags.map((tag) => `  - ${JSON.stringify(tag)}`).join("\n")}\n---\n\n${body}\n\n---\n\n_Originally published on [Wix](${post.link})._\n`;
}

async function main() {
  const feedResponse = await fetch(FEED_URL);
  if (!feedResponse.ok) throw new Error(`Failed to fetch feed: ${feedResponse.status}`);
  const feed = await feedResponse.text();
  const items = [...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);

  const imported = [];
  for (const item of items) {
    const post = {
      title: field(item, "title"),
      description: field(item, "description"),
      link: field(item, "link"),
      category: field(item, "category"),
      date: new Date(field(item, "pubDate")).toISOString().slice(0, 10),
      coverUrl: enclosure(item)
    };

    if (!post.title || !post.link) continue;

    const slug = slugFromUrl(post.link, post.title);
    const dir = path.join(OUT_DIR, slug);
    await fs.mkdir(dir, { recursive: true });

    const pageResponse = await fetch(post.link);
    const html = pageResponse.ok ? await pageResponse.text() : "";
    const jsonLd = extractJsonLd(html);
    if (jsonLd.description) post.description = decodeHtml(jsonLd.description);
    if (jsonLd.datePublished) post.date = new Date(jsonLd.datePublished).toISOString().slice(0, 10);
    if (jsonLd.image?.url) post.coverUrl = jsonLd.image.url;

    const extracted = extractBody(html);
    const coverExt = extFromUrl(post.coverUrl);
    await download(post.coverUrl, path.join(dir, `cover${coverExt}`));

    for (const [index, url] of extracted.images.entries()) {
      await download(url, path.join(dir, `image-${String(index + 1).padStart(2, "0")}${extFromUrl(url)}`));
    }

    const fallbackBody = `${post.description}\n\n> Import note: this post was created from Wix metadata because the full body could not be extracted cleanly.`;
    const body = extracted.markdown || fallbackBody;
    await fs.writeFile(path.join(dir, "index.md"), frontMatter(post, coverExt, body));
    imported.push({ title: post.title, slug, images: extracted.images.length });
  }

  console.log(`Imported ${imported.length} Wix posts`);
  for (const post of imported) {
    console.log(`- ${post.slug} (${post.images} body images)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
