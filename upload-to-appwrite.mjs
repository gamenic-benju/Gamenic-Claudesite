import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client, Storage, ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC = path.join(__dirname, "static");

const PROJECT_ID = "69f98cc9003ab03f1aa5";
const BUCKET_ID = "69f98fa0002e8a09286d";
const ENDPOINT = "https://app.sys4tr.com/v1";
const API_KEY = process.env.APPWRITE_API_KEY;

if (!API_KEY) {
  console.error("Missing APPWRITE_API_KEY environment variable.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const storage = new Storage(client);

const UPLOAD_EXTS = new Set([".glb", ".mp4", ".png"]);

// Collect all files to upload
function collectFiles(dir, base = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (UPLOAD_EXTS.has(ext)) {
        results.push({ full, rel: path.relative(base, full).replace(/\\/g, "/") });
      }
    }
  }
  return results;
}

const files = collectFiles(STATIC);
console.log(`Found ${files.length} files to upload (glb, mp4, png)...`);

// Map: relative path -> Appwrite file URL
const urlMap = new Map();

// Load existing map if resuming
const MAP_FILE = path.join(__dirname, "appwrite-url-map.json");
if (fs.existsSync(MAP_FILE)) {
  const existing = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
  for (const [k, v] of Object.entries(existing)) urlMap.set(k, v);
  console.log(`Loaded ${urlMap.size} existing mappings from appwrite-url-map.json`);
}

let uploaded = 0;
let skipped = 0;

for (const { full, rel } of files) {
  if (urlMap.has(rel)) {
    skipped++;
    continue;
  }

  try {
    process.stdout.write(`Uploading ${rel}...`);
    const fileName = path.basename(full);
    const file = await storage.createFile(
      BUCKET_ID,
      ID.unique(),
      InputFile.fromPath(full, fileName)
    );

    const fileUrl = `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${file.$id}/view?project=${PROJECT_ID}`;
    urlMap.set(rel, fileUrl);
    uploaded++;
    console.log(` done`);

    // Save map after each upload so we can resume if interrupted
    fs.writeFileSync(MAP_FILE, JSON.stringify(Object.fromEntries(urlMap), null, 2));
  } catch (err) {
    console.error(`\nFailed to upload ${rel}: ${err.message}`);
  }
}

console.log(`\nUploaded: ${uploaded}, Skipped (already done): ${skipped}`);
console.log(`URL map saved to appwrite-url-map.json`);

// Now update HTML files to replace local paths with Appwrite URLs
console.log("\nUpdating HTML files...");
const htmlFiles = fs
  .readdirSync(STATIC)
  .filter((f) => f.endsWith(".html"))
  .map((f) => path.join(STATIC, f));

let htmlFixed = 0;

for (const htmlFile of htmlFiles) {
  let html = fs.readFileSync(htmlFile, "utf8");
  const original = html;

  for (const [rel, appwriteUrl] of urlMap) {
    // Match both plain and escaped versions of the relative path
    const escaped = rel.replace(/\//g, "\\/");
    html = html
      .replace(new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), appwriteUrl)
      .replace(new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), appwriteUrl.replace(/\//g, "\\/"));
  }

  if (html !== original) {
    fs.writeFileSync(htmlFile, html);
    htmlFixed++;
  }
}

console.log(`Updated ${htmlFixed} HTML files with Appwrite Storage URLs.`);
console.log("Done! You can now deploy the static/ folder to Appwrite Sites.");
