import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC = path.join(__dirname, "static");
const WP_BASE = "https://gamenic-virtual-studio.com";

// Files that couldn't be uploaded to Appwrite (over 30MB limit)
const LARGE_FILES = [
  "wp-content/uploads/2024/04/Plant4.glb",
  "wp-content/uploads/2024/04/Lamp5.glb",
  "wp-content/uploads/2024/04/Shheellff.glb",
  "wp-content/uploads/2024/04/Table3.glb",
  "wp-content/uploads/2024/04/Table8.glb",
  "wp-content/uploads/2024/04/28.mp4",
  "wp-content/uploads/2024/04/3.mp4",
  "wp-content/uploads/2024/04/4.mp4",
  "wp-content/uploads/2024/04/Chairr.glb",
];

const htmlFiles = fs
  .readdirSync(STATIC)
  .filter((f) => f.endsWith(".html"))
  .map((f) => path.join(STATIC, f));

let htmlFixed = 0;

for (const htmlFile of htmlFiles) {
  let html = fs.readFileSync(htmlFile, "utf8");
  const original = html;

  for (const rel of LARGE_FILES) {
    const wpUrl = `${WP_BASE}/${rel}`;
    const escapedRel = rel.replace(/\//g, "\\/");
    const escapedUrl = wpUrl.replace(/\//g, "\\/");

    // Replace plain relative path
    html = html.replace(
      new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      wpUrl
    );
    // Replace escaped relative path (inside JSON data-attributes)
    html = html.replace(
      new RegExp(escapedRel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      escapedUrl
    );
  }

  if (html !== original) {
    fs.writeFileSync(htmlFile, html);
    htmlFixed++;
  }
}

console.log(`Updated ${htmlFixed} HTML files with WordPress fallback URLs.`);

// Delete the large files from static/
let deleted = 0;
for (const rel of LARGE_FILES) {
  const full = path.join(STATIC, rel);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    deleted++;
    console.log(`Deleted: ${rel}`);
  }
}

// Check final size
function getDirSize(dir) {
  let size = 0;
  if (!fs.existsSync(dir)) return size;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) size += getDirSize(full);
    else size += fs.statSync(full).size;
  }
  return size;
}

const finalSize = getDirSize(STATIC) / (1024 * 1024);
console.log(`\nDeleted ${deleted} large files.`);
console.log(`Final static/ size: ${finalSize.toFixed(2)} MB`);

if (finalSize < 30) {
  console.log("✓ Under 30MB — ready to deploy to Appwrite Sites!");
} else {
  console.log("✗ Still over 30MB — further cleanup needed.");
}
