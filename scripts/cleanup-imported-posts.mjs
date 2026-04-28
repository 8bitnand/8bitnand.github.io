import fs from "node:fs/promises";
import path from "node:path";

const BLOG_DIR = "src/blog";

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function cleanupWixDebris(markdown) {
  return markdown
    .replace(/#pro-gallery-[\s\S]*?Cannot set layoutFixer css', e\); \}/g, "")
    .replace(/#pro-gallery-[^\n]+/g, "")
    .replace(/try \{ window\.requestAnimationFrame[\s\S]*?\}\s*catch \(e\) \{[\s\S]*?\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";
}

async function cleanupMissingImages(filePath, markdown) {
  const dir = path.dirname(filePath);
  const imagePattern = /!\[([^\]]*)\]\((\.\/[^)]+)\)/g;
  let updated = markdown;

  for (const match of markdown.matchAll(imagePattern)) {
    const [full, , imagePath] = match;
    const fullPath = path.resolve(dir, imagePath);
    if (!(await exists(fullPath))) {
      updated = updated.replace(new RegExp(`\\n?${full.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`, "g"), "\n");
    }
  }

  return updated.replace(/\n{3,}/g, "\n\n");
}

async function main() {
  const entries = await fs.readdir(BLOG_DIR, { withFileTypes: true });
  let changed = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(BLOG_DIR, entry.name, "index.md");
    if (!(await exists(filePath))) continue;

    const original = await fs.readFile(filePath, "utf8");
    let updated = cleanupWixDebris(original);
    updated = await cleanupMissingImages(filePath, updated);

    if (updated !== original) {
      await fs.writeFile(filePath, updated);
      changed++;
      console.log(`Cleaned ${filePath}`);
    }
  }

  console.log(`Cleaned ${changed} posts`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
