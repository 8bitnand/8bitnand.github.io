const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const markdownItAnchor = require("markdown-it-anchor");
const fs = require("node:fs");
const path = require("node:path");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getYouTubeId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === "youtu.be") return url.pathname.slice(1);
    if (url.hostname.endsWith("youtube.com")) return url.searchParams.get("v");
  } catch {
    return null;
  }

  return null;
}

function getGistEmbedInfo(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== "gist.github.com") return null;

    const [owner, gistId] = url.pathname.split("/").filter(Boolean);
    if (!owner || !gistId) return null;

    return {
      gistId,
      file: url.searchParams.get("file") || ""
    };
  } catch {
    return null;
  }
}

function hostLabel(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}

function renderHashnodeEmbed(rawUrl) {
  const url = rawUrl.trim();
  const escapedUrl = escapeHtml(url);
  const youtubeId = getYouTubeId(url);
  const gistInfo = getGistEmbedInfo(url);

  if (youtubeId) {
    return `<figure class="embed embed-video">
      <iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(youtubeId)}" title="Embedded YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </figure>`;
  }

  if (gistInfo) {
    return `<div class="embed embed-gist" data-gist-embed data-gist-id="${escapeHtml(gistInfo.gistId)}" data-gist-file="${escapeHtml(gistInfo.file)}" data-gist-url="${escapedUrl}">
      <div class="gist-card-status">Loading Gist...</div>
      <noscript><a href="${escapedUrl}">View this Gist on GitHub</a></noscript>
    </div>`;
  }

  return `<p class="embed embed-link">
    <a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">
      <span>${escapeHtml(hostLabel(url))}</span>
      <strong>${escapedUrl}</strong>
    </a>
  </p>`;
}

function hashnodeEmbedPlugin(mdLib) {
  mdLib.block.ruler.before("paragraph", "hashnode_embed", (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const max = state.eMarks[startLine];
    const line = state.src.slice(start, max).trim();
    const match = line.match(/^%\[(https?:\/\/[^\]]+)\]\s*$/);

    if (!match) return false;
    if (silent) return true;

    const token = state.push("hashnode_embed", "", 0);
    token.block = true;
    token.content = match[1];
    token.map = [startLine, startLine + 1];
    state.line = startLine + 1;
    return true;
  });

  mdLib.renderer.rules.hashnode_embed = (tokens, index) => {
    return renderHashnodeEmbed(tokens[index].content);
  };
}

module.exports = function (eleventyConfig) {
  const isProduction = process.env.ELEVENTY_ENV === "production";

  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.addGlobalData("isProduction", isProduction);

  eleventyConfig.amendLibrary("md", (mdLib) => {
    mdLib.use(markdownItAnchor, {
      permalink: markdownItAnchor.permalink.headerLink(),
      slugify: eleventyConfig.getFilter("slugify")
    });
    mdLib.use(hashnodeEmbedPlugin);
  });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy("src/blog/**/*.{jpg,jpeg,png,gif,webp,avif,svg,mp4,webm}");

  eleventyConfig.addCollection("posts", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/blog/**/index.md")
      .filter((post) => !post.data.draft)
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(dateObj);
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    return dateObj.toISOString();
  });

  eleventyConfig.addFilter("readingTime", (content) => {
    const words = String(content || "").trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 220));
  });

  eleventyConfig.addFilter("absoluteUrl", (url, base) => {
    return new URL(url, base).toString();
  });

  eleventyConfig.addFilter("json", (value) => {
    return JSON.stringify(value);
  });

  eleventyConfig.addFilter("assetExists", (assetPath, inputPath) => {
    if (!assetPath) return false;
    if (/^(https?:)?\/\//.test(assetPath) || assetPath.startsWith("/")) return true;
    if (!inputPath) return false;

    const fullPath = path.resolve(path.dirname(inputPath), assetPath);
    return fs.existsSync(fullPath);
  });

  eleventyConfig.addFilter("relatedPosts", (posts, currentUrl, tags = []) => {
    const currentTags = new Set((tags || []).filter((tag) => tag !== "posts"));

    return posts
      .filter((post) => post.url !== currentUrl)
      .map((post) => {
        const matches = (post.data.tags || []).filter((tag) => currentTags.has(tag)).length;
        return { post, matches };
      })
      .filter((item) => item.matches > 0)
      .sort((a, b) => b.matches - a.matches || b.post.date - a.post.date)
      .slice(0, 3)
      .map((item) => item.post);
  });

  eleventyConfig.addFilter("tagList", (posts) => {
    const tags = new Map();

    for (const post of posts) {
      for (const tag of post.data.tags || []) {
        if (tag === "posts") continue;
        tags.set(tag, (tags.get(tag) || 0) + 1);
      }
    }

    return [...tags.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes/layouts",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk"]
  };
};
