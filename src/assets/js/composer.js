const draftKey = "8bit-blogs-composer-draft";
const tokenKey = "8bit-blogs-github-token";
const composerRoot = document.querySelector("[data-composer-mode]");

const blockTemplates = {
  h2: {
    label: "Heading",
    hint: "Add a section heading",
    value: "## Section title\n\n"
  },
  code: {
    label: "Code block",
    hint: "Fenced code with syntax highlighting",
    value: "```python\n# code here\nprint(\"hello\")\n```\n\n"
  },
  image: {
    label: "Image",
    hint: "Local image from article folder",
    value: "![Image description](./image-01.png)\n\n"
  },
  video: {
    label: "Local video",
    hint: "MP4/WebM file next to the article",
    value: "<video controls playsinline>\n  <source src=\"./demo.mp4\" type=\"video/mp4\">\n</video>\n\n"
  },
  youtube: {
    label: "YouTube",
    hint: "Hashnode-style YouTube embed",
    value: "%[https://youtu.be/VIDEO_ID]\n\n"
  },
  gist: {
    label: "GitHub Gist",
    hint: "Visible code embed",
    value: "%[https://gist.github.com/8bitnand/GIST_ID]\n\n"
  },
  math: {
    label: "Math",
    hint: "MathJax block equation",
    value: "$$\nPE_{(pos, 2i)} = \\sin\\left(\\frac{pos}{10000^{2i/d_{model}}}\\right)\n$$\n\n"
  },
  quote: {
    label: "Quote",
    hint: "Markdown blockquote",
    value: "> Write the quote here.\n\n"
  },
  demo: {
    label: "Interactive demo",
    hint: "Iframe demo with caption",
    value: "<figure class=\"interactive-demo\">\n  <iframe src=\"https://example.com/demo\" title=\"Interactive demo\" loading=\"lazy\"></iframe>\n  <figcaption>\n    <a href=\"https://example.com/demo\" target=\"_blank\" rel=\"noopener noreferrer\">Open the interactive demo in a new tab</a>\n  </figcaption>\n</figure>\n\n"
  },
  table: {
    label: "Table",
    hint: "Markdown table",
    value: "| Column | Notes |\n| --- | --- |\n| Item | Details |\n\n"
  },
  callout: {
    label: "Callout",
    hint: "Simple highlighted note",
    value: "<aside class=\"article-callout\">\n  <strong>Note</strong>\n  <p>Write the note here.</p>\n</aside>\n\n"
  }
};

const slashBlocks = Object.entries(blockTemplates).map(([id, block]) => ({ id, ...block }));
let mediaAssets = [];
let saveTimer;
let loadedDraft = {};

function $(selector) {
  return document.querySelector(selector);
}

function getField(name) {
  return document.querySelector(`[data-field="${name}"]`);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftKey) || "{}");
  } catch {
    return {};
  }
}

function readForm() {
  const tagsField = getField("tags");
  const fallback = loadedDraft || {};
  const tags = (tagsField ? tagsField.value : (fallback.tags || []).join(", "))
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const value = (name, defaultValue = "") => {
    const field = getField(name);
    if (!field) return fallback[name] ?? defaultValue;
    return field.value;
  };
  const checked = (name) => {
    const field = getField(name);
    if (!field) return Boolean(fallback[name]);
    return Boolean(field.checked);
  };
  const editor = $("[data-editor]");

  return {
    title: String(value("title")).trim(),
    slug: slugify(value("slug") || value("title") || "untitled-article"),
    description: String(value("description")).trim(),
    date: value("date", today()) || today(),
    tags,
    cover: String(value("cover")).trim(),
    coverAlt: String(value("coverAlt")).trim(),
    hideCover: checked("hideCover"),
    repository: String(value("repository", "8bitnand/8bitnand.github.io")).trim(),
    baseBranch: String(value("baseBranch", "main")).trim(),
    rememberToken: checked("rememberToken"),
    content: editor ? editor.value : fallback.content || ""
  };
}

function writeForm(draft = {}) {
  const defaults = {
    title: "",
    slug: "",
    description: "",
    date: today(),
    tags: [],
    cover: "",
    coverAlt: "",
    hideCover: false,
    repository: "8bitnand/8bitnand.github.io",
    baseBranch: "main",
    rememberToken: false,
    content: ""
  };
  const value = { ...defaults, ...draft };

  for (const [key, fieldValue] of Object.entries(value)) {
    const field = getField(key);
    if (!field) continue;
    if (field.type === "checkbox") {
      field.checked = Boolean(fieldValue);
    } else if (key === "tags" && Array.isArray(fieldValue)) {
      field.value = fieldValue.join(", ");
    } else {
      field.value = fieldValue || "";
    }
  }

  const editor = $("[data-editor]");
  if (editor) editor.value = value.content || "";

  const token = localStorage.getItem(tokenKey);
  if (token && getField("token")) {
    getField("token").value = token;
    getField("rememberToken").checked = true;
  }
}

function saveDraft() {
  if (!composerRoot) return;
  const draft = { ...readForm(), assets: mediaAssets };
  localStorage.setItem(draftKey, JSON.stringify(draft));
  if (draft.rememberToken && getField("token")?.value) {
    localStorage.setItem(tokenKey, getField("token").value);
  } else if (!draft.rememberToken) {
    localStorage.removeItem(tokenKey);
  }

  const saveState = $("[data-save-state]");
  if (saveState) saveState.textContent = `Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveDraft();
    renderPreview();
  }, 160);
}

function buildFrontMatter(draft = readForm()) {
  const tags = ["posts", ...draft.tags.filter((tag) => tag !== "posts")];
  const lines = [
    "---",
    "layout: post.njk",
    `title: ${JSON.stringify(draft.title || "Untitled article")}`,
    `description: ${JSON.stringify(draft.description || "")}`,
    `date: ${draft.date || today()}`
  ];

  if (draft.cover) lines.push(`cover: ${JSON.stringify(draft.cover)}`);
  if (draft.coverAlt) lines.push(`coverAlt: ${JSON.stringify(draft.coverAlt)}`);
  if (draft.hideCover) lines.push("hideCover: true");

  lines.push("tags:");
  for (const tag of tags) {
    lines.push(`  - ${JSON.stringify(tag)}`);
  }
  lines.push("---", "", draft.content.trim(), "");
  return lines.join("\n");
}

function getLineInfo(textarea) {
  const value = textarea.value;
  const cursor = textarea.selectionStart;
  const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
  const lineEndIndex = value.indexOf("\n", cursor);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  return {
    cursor,
    lineStart,
    lineEnd,
    line: value.slice(lineStart, lineEnd)
  };
}

function insertAtCursor(textarea, value, replaceLine = false) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  let replaceStart = start;
  let replaceEnd = end;

  if (replaceLine) {
    const info = getLineInfo(textarea);
    replaceStart = info.lineStart;
    replaceEnd = info.lineEnd;
  }

  textarea.value = textarea.value.slice(0, replaceStart) + value + textarea.value.slice(replaceEnd);
  const nextCursor = replaceStart + value.length;
  textarea.focus();
  textarea.setSelectionRange(nextCursor, nextCursor);
  hideSlashMenu();
  scheduleSave();
}

function renderSlashMenu(filter = "") {
  const menu = $("[data-slash-menu]");
  const editor = $("[data-editor]");
  if (!menu || !editor) return;

  const query = filter.replace(/^\//, "").toLowerCase();
  const matches = slashBlocks.filter((block) => {
    return block.id.includes(query) || block.label.toLowerCase().includes(query);
  });

  if (!matches.length) {
    hideSlashMenu();
    return;
  }

  menu.hidden = false;
  menu.innerHTML = matches
    .map((block) => `
      <button type="button" data-slash-block="${block.id}">
        <strong>/${block.id}</strong>
        <span>${escapeHtml(block.hint)}</span>
      </button>
    `)
    .join("");
}

function hideSlashMenu() {
  const menu = $("[data-slash-menu]");
  if (menu) menu.hidden = true;
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

function getGistInfo(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== "gist.github.com") return null;
    const [, gistId] = url.pathname.split("/").filter(Boolean);
    return gistId ? { gistId, url: rawUrl } : null;
  } catch {
    return null;
  }
}

function renderEmbed(rawUrl) {
  const url = rawUrl.trim();
  const youtubeId = getYouTubeId(url);
  const gist = getGistInfo(url);

  if (youtubeId) {
    return `<figure class="embed embed-video"><iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(youtubeId)}" title="Embedded YouTube video" loading="lazy" allowfullscreen></iframe></figure>`;
  }

  if (gist) {
    return `<div class="embed embed-gist"><div class="gist-card-header"><div><span class="gist-kicker">GitHub Gist</span><strong>${escapeHtml(gist.gistId)}</strong></div><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open</a></div><pre class="gist-code"><code><span class="gist-code-line"><span class="gist-line-number">1</span><span class="gist-line-content">Gist code renders on the published article.</span></span></code></pre></div>`;
  }

  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}

  return `<p class="embed embed-link"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(host)}</span><strong>${escapeHtml(url)}</strong></a></p>`;
}

function preprocessMarkdown(markdown = "") {
  return markdown
    .split("\n")
    .map((line) => {
      const match = line.trim().match(/^%\[(https?:\/\/[^\]]+)\]$/);
      return match ? renderEmbed(match[1]) : line;
    })
    .join("\n");
}

function renderMarkdown(markdown = "") {
  const md = window.markdownit?.({
    html: true,
    linkify: true,
    typographer: true
  });

  if (!md) return `<p>${escapeHtml(markdown)}</p>`;

  const html = md.render(preprocessMarkdown(markdown));
  return window.DOMPurify
    ? window.DOMPurify.sanitize(html, {
        ADD_TAGS: ["iframe"],
        ADD_ATTR: ["allow", "allowfullscreen", "loading", "target", "rel", "playsinline", "controls"]
      })
    : html;
}

function renderPreview() {
  const draft = readForm();
  const title = draft.title || "Untitled article";
  const description = draft.description || "";
  const readMinutes = Math.max(1, Math.ceil((draft.content.trim().split(/\s+/).filter(Boolean).length || 1) / 220));
  const dateLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${draft.date || today()}T00:00:00`));

  document.querySelectorAll("[data-preview-title]").forEach((node) => {
    node.textContent = title;
  });
  document.querySelectorAll("[data-preview-page-title]").forEach((node) => {
    node.textContent = title;
  });
  document.querySelectorAll("[data-preview-description]").forEach((node) => {
    node.textContent = description;
    node.hidden = !description;
  });
  document.querySelectorAll("[data-preview-meta]").forEach((node) => {
    node.innerHTML = `<time datetime="${escapeHtml(draft.date)}">${escapeHtml(dateLabel)}</time><span>${readMinutes} min read</span>`;
  });
  document.querySelectorAll("[data-preview-content]").forEach((node) => {
    node.innerHTML = renderMarkdown(draft.content || "");
  });
}

function renderAssets() {
  const list = $("[data-asset-list]");
  if (!list) return;

  if (!mediaAssets.length) {
    list.innerHTML = `<p class="composer-help">No media added yet.</p>`;
    return;
  }

  list.innerHTML = mediaAssets
    .map((asset, index) => `
      <div class="asset-item">
        <span>${escapeHtml(asset.name)}</span>
        <button type="button" data-insert-asset="${index}">Insert</button>
        <button type="button" data-cover-asset="${index}">Cover</button>
        <button type="button" data-remove-asset="${index}" aria-label="Remove ${escapeHtml(asset.name)}">Remove</button>
      </div>
    `)
    .join("");
}

async function fileToAsset(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return {
    name: file.name.replace(/[^a-zA-Z0-9._-]/g, "-"),
    type: file.type,
    dataUrl,
    base64: String(dataUrl).split(",")[1] || ""
  };
}

async function handleAssets(event) {
  const files = [...(event.target.files || [])];
  const nextAssets = await Promise.all(files.map(fileToAsset));
  mediaAssets = [...mediaAssets, ...nextAssets];
  renderAssets();
  saveDraft();
}

async function githubRequest(path, options = {}) {
  const draft = readForm();
  const token = getField("token")?.value.trim();
  if (!token) throw new Error("Add a GitHub token before publishing.");

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
      ...(options.headers || {})
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || `GitHub request failed: ${response.status}`);
  }
  return body;
}

function setPublishStatus(message, type = "") {
  const status = $("[data-publish-status]");
  if (!status) return;
  status.dataset.status = type;
  status.innerHTML = message;
}

async function publishDraft() {
  const draft = readForm();
  const [owner, repo] = draft.repository.split("/");

  if (!owner || !repo) throw new Error("Repository must look like owner/repo.");
  if (!draft.title.trim()) throw new Error("Add a title before publishing.");
  if (!draft.description.trim()) throw new Error("Add a description before publishing.");

  setPublishStatus("Creating publish branch...", "pending");

  const branch = `post/${draft.slug}-${Date.now()}`;
  const baseRef = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(draft.baseBranch)}`);

  await githubRequest(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: baseRef.object.sha
    })
  });

  const articlePath = `src/blog/${draft.slug}/index.md`;
  await githubRequest(`/repos/${owner}/${repo}/contents/${articlePath}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Add ${draft.title}`,
      content: btoa(unescape(encodeURIComponent(buildFrontMatter(draft)))),
      branch
    })
  });

  for (const asset of mediaAssets) {
    await githubRequest(`/repos/${owner}/${repo}/contents/src/blog/${draft.slug}/${asset.name}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Add media for ${draft.title}`,
        content: asset.base64,
        branch
      })
    });
  }

  const pr = await githubRequest(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `Add ${draft.title}`,
      head: branch,
      base: draft.baseBranch,
      body: [
        "Adds a new article from the 8bit blogs composer.",
        "",
        `Article path: \`${articlePath}\``
      ].join("\n")
    })
  });

  setPublishStatus(`<a href="${escapeHtml(pr.html_url)}" target="_blank" rel="noopener noreferrer">Pull request created</a>`, "success");
}

function bindEditor() {
  const editor = $("[data-editor]");
  if (!editor) return;

  editor.addEventListener("input", () => {
    const info = getLineInfo(editor);
    const slashMatch = info.line.match(/^\/([a-z-]*)$/i);
    if (slashMatch) renderSlashMenu(slashMatch[0]);
    else hideSlashMenu();
    scheduleSave();
  });

  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideSlashMenu();
  });

  $("[data-slash-menu]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-slash-block]");
    if (!button) return;
    insertAtCursor(editor, blockTemplates[button.dataset.slashBlock].value, true);
  });

  document.querySelectorAll("[data-insert]").forEach((button) => {
    button.addEventListener("click", () => {
      const block = blockTemplates[button.dataset.insert];
      if (block) insertAtCursor(editor, block.value);
    });
  });
}

function bindComposer() {
  document.querySelectorAll("[data-field]").forEach((field) => {
    field.addEventListener("input", () => {
      if (field.dataset.field === "title" && !getField("slug")?.value) {
        getField("slug").value = slugify(field.value);
      }
      scheduleSave();
    });
    field.addEventListener("change", scheduleSave);
  });

  $("[data-asset-input]")?.addEventListener("change", handleAssets);

  $("[data-asset-list]")?.addEventListener("click", (event) => {
    const insertButton = event.target.closest("[data-insert-asset]");
    const coverButton = event.target.closest("[data-cover-asset]");
    const removeButton = event.target.closest("[data-remove-asset]");
    const editor = $("[data-editor]");

    if (insertButton && editor) {
      const asset = mediaAssets[Number(insertButton.dataset.insertAsset)];
      if (!asset) return;
      const snippet = asset.type.startsWith("video/")
        ? `<video controls playsinline>\n  <source src="./${asset.name}" type="${asset.type}">\n</video>\n\n`
        : `![${asset.name}](./${asset.name})\n\n`;
      insertAtCursor(editor, snippet);
    }

    if (coverButton) {
      const asset = mediaAssets[Number(coverButton.dataset.coverAsset)];
      if (!asset) return;
      getField("cover").value = `./${asset.name}`;
      getField("coverAlt").value ||= asset.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      scheduleSave();
    }

    if (removeButton) {
      mediaAssets = mediaAssets.filter((_, index) => index !== Number(removeButton.dataset.removeAsset));
      renderAssets();
      saveDraft();
    }
  });

  $("[data-copy-markdown]")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(buildFrontMatter());
    setPublishStatus("Markdown copied.", "success");
  });

  $("[data-open-preview]")?.addEventListener("click", () => {
    saveDraft();
    window.open("/compose/preview/", "_blank", "noopener");
  });

  $("[data-publish]")?.addEventListener("click", async () => {
    try {
      saveDraft();
      await publishDraft();
    } catch (error) {
      setPublishStatus(escapeHtml(error.message), "error");
    }
  });
}

function initComposer() {
  if (!composerRoot) return;
  const draft = readDraft();
  loadedDraft = draft;
  mediaAssets = Array.isArray(draft.assets) ? draft.assets : [];
  writeForm(draft);
  renderAssets();
  bindEditor();
  bindComposer();

  const ready = () => {
    renderPreview();
    window.MathJax?.typesetPromise?.();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
}

initComposer();
