import fs from "node:fs/promises";
import path from "node:path";

const API_URL = "https://gql.hashnode.com/";
const HOST = "1bytenand.hashnode.dev";
const OUT_DIR = path.resolve("src/blog");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extFromUrl(url, fallback = ".png") {
  const clean = url.split("?")[0];
  const match = clean.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)(?:$|[/?#])/i);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : fallback;
}

async function gql(query, variables = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

async function download(url, filePath) {
  if (!url) return false;
  const response = await fetch(url);
  if (!response.ok) return false;
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, bytes);
  return true;
}

async function getPosts() {
  const query = `query Publication($host: String!) {
    publication(host: $host) {
      posts(first: 50) {
        edges {
          node {
            title
            slug
          }
        }
      }
    }
  }`;

  const data = await gql(query, { host: HOST });
  return data.publication.posts.edges.map((edge) => edge.node);
}

async function getPost(slug) {
  const query = `query PublicationPost($host: String!, $slug: String!) {
    publication(host: $host) {
      post(slug: $slug) {
        title
        slug
        brief
        publishedAt
        url
        content {
          markdown
        }
        tags {
          name
          slug
        }
        coverImage {
          url
        }
      }
    }
  }`;

  const data = await gql(query, { host: HOST, slug });
  return data.publication.post;
}

async function localizeMarkdownImages(markdown, dir) {
  const imageMatches = [...markdown.matchAll(/!\[([^\]]*)\]\((https:\/\/cdn\.hashnode\.com\/[^)\s]+)(?:\s+[^)]*)?\)/g)];
  let updated = markdown;

  for (const [index, match] of imageMatches.entries()) {
    const [full, alt, url] = match;
    const filename = `image-${String(index + 1).padStart(2, "0")}${extFromUrl(url)}`;
    await download(url, path.join(dir, filename));
    updated = updated.replace(full, `![${alt}](./${filename})`);
  }

  return updated;
}

function frontMatter(post, coverExt, markdown) {
  const tags = ["posts", "hashnode", ...(post.tags || []).map((tag) => tag.slug || tag.name)]
    .map((tag) => slugify(tag))
    .filter(Boolean);

  return `---\nlayout: post.njk\ntitle: ${JSON.stringify(post.title)}\ndescription: ${JSON.stringify(post.brief || "")}\ndate: ${new Date(post.publishedAt).toISOString().slice(0, 10)}\ncover: "./cover${coverExt}"\ncoverAlt: ${JSON.stringify(post.title)}\nsourceUrl: ${JSON.stringify(post.url)}\ntags:\n${[...new Set(tags)].map((tag) => `  - ${JSON.stringify(tag)}`).join("\n")}\n---\n\n${markdown.trim()}\n\n---\n\n_Originally published on [Hashnode](${post.url})._\n`;
}

async function main() {
  const posts = await getPosts();
  const imported = [];

  for (const summary of posts) {
    const post = await getPost(summary.slug);
    if (!post?.content?.markdown) continue;

    const dir = path.join(OUT_DIR, post.slug);
    await fs.mkdir(dir, { recursive: true });

    const coverExt = extFromUrl(post.coverImage?.url || "");
    if (post.coverImage?.url) {
      await download(post.coverImage.url, path.join(dir, `cover${coverExt}`));
    }

    const markdown = await localizeMarkdownImages(post.content.markdown, dir);
    await fs.writeFile(path.join(dir, "index.md"), frontMatter(post, coverExt, markdown));
    imported.push(post.slug);
  }

  console.log(`Imported ${imported.length} Hashnode posts`);
  for (const slug of imported) console.log(`- ${slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
