const root = document.documentElement;
const savedTheme = localStorage.getItem("theme");

if (savedTheme) {
  root.dataset.theme = savedTheme;
}

document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  localStorage.setItem("theme", next);
});

const searchInput = document.querySelector("[data-search-input]");
const searchResults = document.querySelector("[data-search-results]");
const searchForm = document.querySelector("[data-search-form]");
const searchToggle = document.querySelector("[data-search-toggle]");
let searchIndex = [];

function openSearch() {
  if (!searchForm || !searchInput) return;
  searchForm.dataset.searchOpen = "true";
  searchInput.hidden = false;
  searchInput.focus();
}

function closeSearch() {
  if (!searchForm || !searchInput) return;
  searchForm.dataset.searchOpen = "false";
  searchInput.value = "";
  searchInput.hidden = true;
  renderResults([]);
}

searchToggle?.addEventListener("click", () => {
  if (searchForm?.dataset.searchOpen === "true") {
    closeSearch();
    return;
  }

  openSearch();
});

async function loadSearchIndex() {
  if (searchIndex.length) return searchIndex;
  const response = await fetch("/search.json");
  searchIndex = await response.json();
  return searchIndex;
}

function renderResults(results) {
  if (!searchResults) return;

  if (!results.length) {
    searchResults.innerHTML = "";
    searchResults.hidden = true;
    return;
  }

  searchResults.hidden = false;
  searchResults.innerHTML = results
    .slice(0, 6)
    .map((post) => {
      const tags = (post.tags || []).filter((tag) => tag !== "posts").join(", ");
      return `
        <a class="search-result" href="${post.url}">
          <strong>${post.title}</strong>
          <span>${post.description}</span>
          <span>${post.date}${tags ? " · " + tags : ""}</span>
        </a>
      `;
    })
    .join("");
}

searchInput?.addEventListener("input", async (event) => {
  const query = event.target.value.trim().toLowerCase();

  if (!query) {
    renderResults([]);
    return;
  }

  const index = await loadSearchIndex();
  const terms = query.split(/\s+/);
  const results = index.filter((post) => {
    const haystack = [
      post.title,
      post.description,
      ...(post.tags || [])
    ].join(" ").toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });

  renderResults(results);
});

document.addEventListener("click", (event) => {
  if (!searchResults || !searchInput || !searchForm) return;
  if (searchForm.contains(event.target)) return;
  closeSearch();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && searchForm?.dataset.searchOpen === "true") {
    closeSearch();
    searchToggle?.focus();
    return;
  }

  if (event.key !== "/" || !searchInput) return;
  if (document.querySelector("[data-composer-mode]")) return;
  if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
  event.preventDefault();
  openSearch();
});

document.querySelectorAll("img").forEach((image) => {
  image.addEventListener("error", () => {
    const mediaLink = image.closest(".card-media");
    if (mediaLink) {
      mediaLink.hidden = true;
      return;
    }

    image.hidden = true;
  });
});

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderCodeWithLines(content = "") {
  const lines = String(content).replace(/\n$/, "").split("\n");

  return lines
    .map((line, index) => `
      <span class="gist-code-line">
        <span class="gist-line-number">${index + 1}</span>
        <span class="gist-line-content">${escapeHtml(line) || " "}</span>
      </span>
    `)
    .join("");
}

async function renderGistEmbed(container) {
  const gistId = container.dataset.gistId;
  const gistUrl = container.dataset.gistUrl;
  const preferredFile = container.dataset.gistFile;

  if (!gistId) return;

  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { accept: "application/vnd.github+json" }
    });

    if (!response.ok) throw new Error("Gist request failed");

    const gist = await response.json();
    const files = Object.values(gist.files || {});
    const selected = files.find((file) => file.filename === preferredFile) || files[0];

    if (!selected) throw new Error("Gist has no files");

    const tabs = files
      .map((file) => `<span class="gist-file-tab${file.filename === selected.filename ? " is-active" : ""}">${escapeHtml(file.filename)}</span>`)
      .join("");

    container.innerHTML = `
      <div class="gist-card-header">
        <div>
          <span class="gist-kicker">GitHub Gist</span>
          <strong>${escapeHtml(selected.filename)}</strong>
        </div>
        <a href="${escapeHtml(gist.html_url || gistUrl)}" target="_blank" rel="noopener noreferrer">Open</a>
      </div>
      ${files.length > 1 ? `<div class="gist-file-tabs">${tabs}</div>` : ""}
      <pre class="gist-code"><code>${renderCodeWithLines(selected.content || "")}</code></pre>
    `;
  } catch {
    container.innerHTML = `
      <a class="gist-fallback" href="${escapeHtml(gistUrl)}" target="_blank" rel="noopener noreferrer">
        View this Gist on GitHub
      </a>
    `;
  }
}

document.querySelectorAll("[data-gist-embed]").forEach((container) => {
  renderGistEmbed(container);
});
