const draftKey = "8bit-blogs-composer-draft";
const tokenKey = "8bit-blogs-github-token";
const composerRoot = document.querySelector("[data-composer-mode]");
const canPublish = composerRoot?.dataset.canPublish === "true";

const blockTemplates = {
  h2: { label: "Heading", hint: "Add a section heading" },
  code: { label: "Code block", hint: "Write code with a rendered preview" },
  image: { label: "Image", hint: "Local image from article folder" },
  video: { label: "Local video", hint: "MP4/WebM file next to the article" },
  youtube: { label: "YouTube", hint: "Embedded YouTube video" },
  gist: { label: "GitHub Gist", hint: "Visible code embed" },
  math: { label: "Math", hint: "MathJax block equation" },
  quote: { label: "Quote", hint: "Formatted pull quote" },
  demo: { label: "Interactive demo", hint: "Iframe demo with caption" },
  table: { label: "Table", hint: "Editable table" },
  callout: { label: "Callout", hint: "Highlighted note" }
};

const slashBlocks = Object.entries(blockTemplates).map(([id, block]) => ({ id, ...block }));
let mediaAssets = [];
let saveTimer;
let loadedDraft = {};
let activeBlock = null;

function $(selector) {
  return document.querySelector(selector);
}

function getField(name) {
  return document.querySelector(`[data-field="${name}"]`);
}

function blockEditor() {
  return $("[data-block-editor]");
}

function hiddenEditor() {
  return $("[data-editor]");
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

function textFromEditable(node) {
  return (node?.innerText || "").replace(/\u00a0/g, " ").trim();
}

function setEditableText(node, text = "") {
  if (node) node.textContent = text;
}

function blockActionsMarkup() {
  return `
    <div class="block-actions">
      <button type="button" data-block-continue>Done</button>
      <button type="button" data-block-delete>Delete</button>
    </div>
  `;
}

function blockHeaderMarkup(label, extra = "") {
  return `
    <div class="block-shell-header">
      <span>${escapeHtml(label)}</span>
      ${extra}
      ${blockActionsMarkup()}
    </div>
  `;
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

function makeTextBlock(type, text = "") {
  const block = document.createElement("div");
  block.className = `composer-block composer-${type}-block`;
  block.dataset.blockType = type;

  const editable = document.createElement(type === "h2" ? "h2" : type === "quote" ? "blockquote" : "p");
  editable.contentEditable = "true";
  editable.spellcheck = true;
  editable.dataset.blockText = "";
  editable.dataset.placeholder = type === "h2" ? "Section heading" : type === "quote" ? "Write a quote" : "Type / for blocks";
  setEditableText(editable, text);
  block.append(editable);
  if (type !== "paragraph") {
    const actions = document.createElement("div");
    actions.className = "inline-block-actions";
    actions.innerHTML = blockActionsMarkup();
    block.append(actions);
  }
  return block;
}

function makeCodeBlock(data = {}) {
  const block = document.createElement("div");
  block.className = "composer-block composer-code-block";
  block.dataset.blockType = "code";
  block.innerHTML = `
    <div class="block-shell">
      ${blockHeaderMarkup("Code", `
        <label class="code-language-field">
          <span>Language</span>
          <input type="text" data-code-language aria-label="Code language" placeholder="python" value="${escapeHtml(data.language || "python")}">
        </label>
      `)}
      <textarea data-code-input spellcheck="false" placeholder="Write code here...">${escapeHtml(data.code || "print(\"hello\")")}</textarea>
      <pre class="gist-code"><code data-code-preview></code></pre>
    </div>
  `;
  updateCodePreview(block);
  return block;
}

function makeImageBlock(data = {}) {
  const block = document.createElement("div");
  block.className = "composer-block composer-media-block";
  block.dataset.blockType = "image";
  block.innerHTML = `
    <div class="block-shell">
      ${blockHeaderMarkup("Image")}
      <input type="text" data-image-src placeholder="./image-01.png" value="${escapeHtml(data.src || "")}">
      <input type="text" data-image-alt placeholder="Image description" value="${escapeHtml(data.alt || "")}">
      <figure data-image-preview></figure>
    </div>
  `;
  if (data.previewSrc) block.dataset.previewSrc = data.previewSrc;
  updateImagePreview(block);
  return block;
}

function makeVideoBlock(data = {}) {
  const block = document.createElement("div");
  block.className = "composer-block composer-media-block";
  block.dataset.blockType = "video";
  block.innerHTML = `
    <div class="block-shell">
      ${blockHeaderMarkup("Video")}
      <input type="text" data-video-src placeholder="./demo.mp4" value="${escapeHtml(data.src || "")}">
      <input type="text" data-video-type placeholder="video/mp4" value="${escapeHtml(data.type || data.typeHint || "video/mp4")}">
      <figure data-video-preview></figure>
    </div>
  `;
  if (data.previewSrc) block.dataset.previewSrc = data.previewSrc;
  updateVideoPreview(block);
  return block;
}

function makeEmbedBlock(type, data = {}) {
  const labels = {
    youtube: "YouTube",
    gist: "GitHub Gist",
    demo: "Interactive demo"
  };
  const placeholders = {
    youtube: "https://youtu.be/VIDEO_ID",
    gist: "https://gist.github.com/8bitnand/GIST_ID",
    demo: "https://example.com/demo"
  };
  const block = document.createElement("div");
  block.className = "composer-block composer-embed-block";
  block.dataset.blockType = type;
  block.innerHTML = `
    <div class="block-shell">
      ${blockHeaderMarkup(labels[type])}
      <input type="url" data-embed-url placeholder="${placeholders[type]}" value="${escapeHtml(data.url || "")}">
      <div data-embed-preview></div>
    </div>
  `;
  updateEmbedPreview(block);
  return block;
}

function makeMathBlock(data = {}) {
  const block = document.createElement("div");
  block.className = "composer-block composer-math-block";
  block.dataset.blockType = "math";
  block.innerHTML = `
    <div class="block-shell">
      ${blockHeaderMarkup("Math")}
      <textarea data-math-input spellcheck="false" placeholder="PE_{(pos, 2i)} = \\sin(...)">${escapeHtml(data.expression || "")}</textarea>
      <div class="math-preview" data-math-preview></div>
    </div>
  `;
  updateMathPreview(block);
  return block;
}

function makeTableBlock(data = {}) {
  const block = document.createElement("div");
  block.className = "composer-block composer-table-block";
  block.dataset.blockType = "table";
  const rows = data.rows || [
    ["Column", "Notes"],
    ["Item", "Details"]
  ];
  block.innerHTML = `
    <div class="block-shell">
      ${blockHeaderMarkup("Table")}
      <table>
        <tbody>
          ${rows.map((row) => `<tr>${row.map((cell) => `<td contenteditable="true">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
  return block;
}

function makeCalloutBlock(data = {}) {
  const block = document.createElement("div");
  block.className = "composer-block composer-callout-block article-callout";
  block.dataset.blockType = "callout";
  block.innerHTML = `
    <div class="inline-block-actions">${blockActionsMarkup()}</div>
    <strong contenteditable="true" data-callout-title>${escapeHtml(data.title || "Note")}</strong>
    <p contenteditable="true" data-callout-body>${escapeHtml(data.body || "Write the note here.")}</p>
  `;
  return block;
}

function createBlock(type = "paragraph", data = {}) {
  if (type === "paragraph") return makeTextBlock("paragraph", data.text || "");
  if (type === "h2") return makeTextBlock("h2", data.text || "Section heading");
  if (type === "quote") return makeTextBlock("quote", data.text || "Write the quote here.");
  if (type === "code") return makeCodeBlock(data);
  if (type === "image") return makeImageBlock(data);
  if (type === "video") return makeVideoBlock(data);
  if (["youtube", "gist", "demo"].includes(type)) return makeEmbedBlock(type, data);
  if (type === "math") return makeMathBlock(data);
  if (type === "table") return makeTableBlock(data);
  if (type === "callout") return makeCalloutBlock(data);
  return makeTextBlock("paragraph", "");
}

function focusBlock(block) {
  activeBlock = block;
  const target = block.querySelector("[contenteditable='true'], textarea, input");
  target?.focus();
}

function insertBlock(type, data = {}, replaceBlock = null) {
  const editor = blockEditor();
  if (!editor) return null;

  const block = createBlock(type, data);
  const anchor = replaceBlock || activeBlock;

  if (replaceBlock) {
    replaceBlock.replaceWith(block);
  } else if (anchor && anchor.parentElement === editor) {
    anchor.after(block);
  } else {
    editor.append(block);
  }

  activeBlock = block;
  hideSlashMenu();
  syncHiddenMarkdown();
  scheduleSave();
  focusBlock(block);
  return block;
}

function continueAfterBlock(block) {
  const editor = blockEditor();
  if (!editor || !block) return;

  const paragraph = createBlock("paragraph");
  block.after(paragraph);
  syncHiddenMarkdown();
  scheduleSave();
  focusBlock(paragraph);
}

function deleteBlock(block) {
  const editor = blockEditor();
  if (!editor || !block) return;

  const nextFocus = block.previousElementSibling || block.nextElementSibling;
  block.remove();
  ensureEditorHasBlock();
  syncHiddenMarkdown();
  scheduleSave();
  focusBlock(nextFocus?.isConnected ? nextFocus : editor.querySelector(".composer-block"));
}

function ensureEditorHasBlock() {
  const editor = blockEditor();
  if (editor && !editor.children.length) {
    editor.append(createBlock("paragraph"));
  }
}

function renderBlocks(blocks = []) {
  const editor = blockEditor();
  if (!editor) return;
  editor.innerHTML = "";
  const sourceBlocks = Array.isArray(blocks) && blocks.length ? blocks : [{ type: "paragraph", text: "" }];
  const safeBlocks = sourceBlocks.filter((block, index, list) => {
    const isEmptyParagraph = block.type === "paragraph" && !String(block.text || "").trim();
    const previous = list[index - 1];
    const previousIsEmptyParagraph = previous?.type === "paragraph" && !String(previous.text || "").trim();
    return !(isEmptyParagraph && previousIsEmptyParagraph);
  });
  safeBlocks.forEach((block) => editor.append(createBlock(block.type, block)));
  ensureEditorHasBlock();
  syncHiddenMarkdown();
}

function markdownToBlocks(markdown = "") {
  const text = String(markdown || "").trim();
  if (!text) return [{ type: "paragraph", text: "" }];

  const blocks = [];
  const chunks = text.split(/\n{2,}/);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    const codeMatch = trimmed.match(/^```([^\n]*)\n([\s\S]*?)```$/);
    const embedMatch = trimmed.match(/^%\[(https?:\/\/[^\]]+)\]$/);
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);

    if (codeMatch) blocks.push({ type: "code", language: codeMatch[1] || "", code: codeMatch[2] || "" });
    else if (trimmed.startsWith("## ")) blocks.push({ type: "h2", text: trimmed.replace(/^##\s+/, "") });
    else if (trimmed.startsWith("> ")) blocks.push({ type: "quote", text: trimmed.replace(/^>\s?/gm, "") });
    else if (embedMatch && getYouTubeId(embedMatch[1])) blocks.push({ type: "youtube", url: embedMatch[1] });
    else if (embedMatch && getGistInfo(embedMatch[1])) blocks.push({ type: "gist", url: embedMatch[1] });
    else if (imageMatch) blocks.push({ type: "image", alt: imageMatch[1], src: imageMatch[2] });
    else blocks.push({ type: "paragraph", text: trimmed });
  }
  return blocks.length ? blocks : [{ type: "paragraph", text: "" }];
}

function tableRows(block) {
  return [...block.querySelectorAll("tr")].map((row) => [...row.querySelectorAll("td")].map((cell) => textFromEditable(cell)));
}

function serializeBlock(block) {
  const type = block.dataset.blockType;
  if (type === "paragraph") return { type, text: textFromEditable(block.querySelector("[data-block-text]")) };
  if (type === "h2") return { type, text: textFromEditable(block.querySelector("[data-block-text]")) };
  if (type === "quote") return { type, text: textFromEditable(block.querySelector("[data-block-text]")) };
  if (type === "code") return {
    type,
    language: block.querySelector("[data-code-language]")?.value.trim() || "",
    code: block.querySelector("[data-code-input]")?.value || ""
  };
  if (type === "image") return {
    type,
    src: block.querySelector("[data-image-src]")?.value.trim() || "",
    alt: block.querySelector("[data-image-alt]")?.value.trim() || "",
    previewSrc: block.dataset.previewSrc || ""
  };
  if (type === "video") return {
    type,
    src: block.querySelector("[data-video-src]")?.value.trim() || "",
    typeHint: block.querySelector("[data-video-type]")?.value.trim() || "video/mp4",
    previewSrc: block.dataset.previewSrc || ""
  };
  if (["youtube", "gist", "demo"].includes(type)) return { type, url: block.querySelector("[data-embed-url]")?.value.trim() || "" };
  if (type === "math") return { type, expression: block.querySelector("[data-math-input]")?.value.trim() || "" };
  if (type === "table") return { type, rows: tableRows(block) };
  if (type === "callout") return {
    type,
    title: textFromEditable(block.querySelector("[data-callout-title]")),
    body: textFromEditable(block.querySelector("[data-callout-body]"))
  };
  return { type: "paragraph", text: "" };
}

function serializeBlocks() {
  return [...(blockEditor()?.querySelectorAll(".composer-block") || [])].map(serializeBlock);
}

function blockToMarkdown(block) {
  const data = serializeBlock(block);
  if (data.type === "paragraph") return data.text;
  if (data.type === "h2") return data.text ? `## ${data.text}` : "";
  if (data.type === "quote") return data.text ? data.text.split("\n").map((line) => `> ${line}`).join("\n") : "";
  if (data.type === "code") return `\`\`\`${data.language || ""}\n${data.code || ""}\n\`\`\``;
  if (data.type === "image") return data.src ? `![${data.alt || "Image"}](${data.src})` : "";
  if (data.type === "video") return data.src ? `<video controls playsinline>\n  <source src="${data.src}" type="${data.typeHint || "video/mp4"}">\n</video>` : "";
  if (data.type === "youtube" || data.type === "gist") return data.url ? `%[${data.url}]` : "";
  if (data.type === "demo") {
    return data.url ? `<figure class="interactive-demo">\n  <iframe src="${data.url}" title="Interactive demo" loading="lazy"></iframe>\n  <figcaption>\n    <a href="${data.url}" target="_blank" rel="noopener noreferrer">Open the interactive demo in a new tab</a>\n  </figcaption>\n</figure>` : "";
  }
  if (data.type === "math") return data.expression ? `$$\n${data.expression}\n$$` : "";
  if (data.type === "table") {
    const rows = data.rows.filter((row) => row.some(Boolean));
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] || ""));
    const header = normalized[0];
    const body = normalized.slice(1);
    return [
      `| ${header.join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`)
    ].join("\n");
  }
  if (data.type === "callout") {
    return `<aside class="article-callout">\n  <strong>${escapeHtml(data.title || "Note")}</strong>\n  <p>${escapeHtml(data.body || "")}</p>\n</aside>`;
  }
  return "";
}

function serializeMarkdown() {
  return [...(blockEditor()?.querySelectorAll(".composer-block") || [])]
    .map(blockToMarkdown)
    .filter((value) => value.trim())
    .join("\n\n");
}

function syncHiddenMarkdown() {
  const editor = hiddenEditor();
  if (editor) editor.value = serializeMarkdown();
}

function readForm() {
  syncHiddenMarkdown();
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
    blocks: serializeBlocks(),
    content: hiddenEditor()?.value || fallback.content || ""
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
    content: "",
    blocks: []
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

  renderBlocks(Array.isArray(value.blocks) && value.blocks.length ? value.blocks : markdownToBlocks(value.content));

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
    syncHiddenMarkdown();
    saveDraft();
    if (composerRoot?.dataset.composerMode === "preview") {
      renderPreview();
    }
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

function renderSlashMenu(filter = "") {
  const menu = $("[data-slash-menu]");
  const editor = blockEditor();
  if (!menu) return;

  const query = filter.replace(/^\//, "").toLowerCase();
  const matches = slashBlocks.filter((block) => block.id.includes(query) || block.label.toLowerCase().includes(query));

  if (!matches.length) {
    hideSlashMenu();
    return;
  }

  menu.hidden = false;
  if (activeBlock && editor) {
    const top = editor.offsetTop + activeBlock.offsetTop + activeBlock.offsetHeight + 8;
    menu.style.top = `${top}px`;
  }
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

function slashCommandFromText(value = "") {
  const match = String(value).trim().match(/^\/([a-z-]*)$/i);
  if (!match) return null;
  const query = match[1].toLowerCase();
  if (!query) return null;
  return slashBlocks.find((block) => block.id === query)?.id || slashBlocks.find((block) => block.id.startsWith(query))?.id || null;
}

function updateCodePreview(block) {
  const input = block.querySelector("[data-code-input]");
  const preview = block.querySelector("[data-code-preview]");
  if (preview) preview.textContent = input?.value || "";
}

function updateImagePreview(block) {
  const src = block.dataset.previewSrc || block.querySelector("[data-image-src]")?.value.trim();
  const alt = block.querySelector("[data-image-alt]")?.value.trim() || "";
  const preview = block.querySelector("[data-image-preview]");
  if (!preview) return;
  preview.innerHTML = src
    ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`
    : `<div class="block-empty-preview">Add an image path or upload one from Media.</div>`;
}

function updateVideoPreview(block) {
  const src = block.dataset.previewSrc || block.querySelector("[data-video-src]")?.value.trim();
  const type = block.querySelector("[data-video-type]")?.value.trim() || "video/mp4";
  const preview = block.querySelector("[data-video-preview]");
  if (!preview) return;
  preview.innerHTML = src
    ? `<video controls playsinline><source src="${escapeHtml(src)}" type="${escapeHtml(type)}"></video>`
    : `<div class="block-empty-preview">Add a video path or upload one from Media.</div>`;
}

function updateEmbedPreview(block) {
  const type = block.dataset.blockType;
  const url = block.querySelector("[data-embed-url]")?.value.trim() || "";
  const preview = block.querySelector("[data-embed-preview]");
  if (!preview) return;

  if (!url) {
    preview.innerHTML = `<div class="block-empty-preview">Paste a ${type} URL.</div>`;
    return;
  }

  if (type === "demo") {
    preview.innerHTML = `<figure class="interactive-demo"><iframe src="${escapeHtml(url)}" title="Interactive demo" loading="lazy"></iframe><figcaption><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open the interactive demo in a new tab</a></figcaption></figure>`;
  } else {
    preview.innerHTML = renderEmbed(url);
  }
}

function updateMathPreview(block) {
  const expression = block.querySelector("[data-math-input]")?.value.trim() || "";
  const preview = block.querySelector("[data-math-preview]");
  if (!preview) return;
  preview.textContent = expression ? `$$${expression}$$` : "Write an equation above.";
  window.MathJax?.typesetPromise?.([preview]).catch(() => {});
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
  if (!canPublish) throw new Error("Publishing is disabled on the public site. Use preview or copy Markdown.");

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
    const details = Array.isArray(body.errors)
      ? body.errors.map((error) => error.message || error.code).filter(Boolean).join("; ")
      : "";
    throw new Error([body.message, details].filter(Boolean).join(": ") || `GitHub request failed: ${response.status}`);
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
  if (!canPublish) throw new Error("Publishing is disabled on the public site. Use preview or copy Markdown.");

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
      head: `${owner}:${branch}`,
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

function handleBlockInput(event) {
  const block = event.target.closest(".composer-block");
  if (!block) return;
  activeBlock = block;

  if (event.target.matches("[data-block-text]")) {
    const text = textFromEditable(event.target);
    if (text.match(/^\/([a-z-]*)$/i)) renderSlashMenu(text);
    else hideSlashMenu();
  }

  if (event.target.matches("[data-code-input]")) updateCodePreview(block);
  if (event.target.matches("[data-image-src], [data-image-alt]")) {
    block.dataset.previewSrc = "";
    updateImagePreview(block);
  }
  if (event.target.matches("[data-video-src], [data-video-type]")) {
    block.dataset.previewSrc = "";
    updateVideoPreview(block);
  }
  if (event.target.matches("[data-embed-url]")) updateEmbedPreview(block);
  if (event.target.matches("[data-math-input]")) updateMathPreview(block);

  scheduleSave();
}

function handleBlockKeydown(event) {
  const block = event.target.closest(".composer-block");
  if (!block) return;
  activeBlock = block;

  if (event.key === "Escape") {
    hideSlashMenu();
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && block.dataset.blockType !== "paragraph") {
    event.preventDefault();
    continueAfterBlock(block);
    return;
  }

  if (event.key === "Enter" && !event.shiftKey && event.target.matches("[data-block-text]")) {
    event.preventDefault();
    const text = textFromEditable(event.target);
    const command = slashCommandFromText(text);

    if (command) {
      insertBlock(command, {}, block);
      return;
    }

    if (!text) return;
    insertBlock("paragraph");
  }

  if (event.key === "Backspace" && event.target.matches("[data-block-text]") && !textFromEditable(event.target)) {
    const editor = blockEditor();
    if (editor && editor.children.length > 1) {
      event.preventDefault();
      const nextFocus = block.previousElementSibling || block.nextElementSibling;
      block.remove();
      syncHiddenMarkdown();
      scheduleSave();
      if (nextFocus) focusBlock(nextFocus);
    }
  }
}

function bindEditor() {
  const editor = blockEditor();
  if (!editor) return;

  editor.addEventListener("focusin", (event) => {
    const block = event.target.closest(".composer-block");
    if (block) activeBlock = block;
  });
  editor.addEventListener("input", handleBlockInput);
  editor.addEventListener("keydown", handleBlockKeydown);

  $("[data-slash-menu]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-slash-block]");
    if (!button) return;
    const replace = activeBlock?.querySelector("[data-block-text]") && textFromEditable(activeBlock.querySelector("[data-block-text]")).startsWith("/")
      ? activeBlock
      : null;
    insertBlock(button.dataset.slashBlock, {}, replace);
  });

  editor.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-block-delete]");
    const continueButton = event.target.closest("[data-block-continue]");
    const block = event.target.closest(".composer-block");
    if (!block) return;

    if (deleteButton) {
      deleteBlock(block);
      return;
    }

    if (continueButton) {
      continueAfterBlock(block);
    }
  });

  document.querySelectorAll("[data-insert]").forEach((button) => {
    button.addEventListener("click", () => {
      insertBlock(button.dataset.insert);
    });
  });
}

function bindComposer() {
  const settingsPanel = $(".composer-settings-disclosure");
  const syncSettingsPanel = () => {
    composerRoot.dataset.settingsOpen = settingsPanel?.open ? "true" : "false";
  };

  syncSettingsPanel();
  settingsPanel?.addEventListener("toggle", syncSettingsPanel);

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

    if (insertButton) {
      const asset = mediaAssets[Number(insertButton.dataset.insertAsset)];
      if (!asset) return;
      if (asset.type.startsWith("video/")) {
        insertBlock("video", { src: `./${asset.name}`, type: asset.type, typeHint: asset.type, previewSrc: asset.dataUrl });
      } else {
        insertBlock("image", { src: `./${asset.name}`, alt: asset.name, previewSrc: asset.dataUrl });
      }
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
