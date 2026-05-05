import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC = path.join(__dirname, "static");
const MAP_FILE = path.join(__dirname, "appwrite-url-map.json");

const urlMap = JSON.parse(fs.readFileSync(MAP_FILE, "utf8"));
const uploadedPaths = Object.keys(urlMap);

let deleted = 0;
let kept = 0;

for (const rel of uploadedPaths) {
  const full = path.join(STATIC, rel);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    deleted++;
  }
}

// Remove empty directories
function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) removeEmptyDirs(full);
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
removeEmptyDirs(STATIC);

// Check remaining size
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

const remaining = getDirSize(STATIC) / (1024 * 1024);
console.log(`Deleted ${deleted} uploaded files from static/`);
console.log(`Remaining static/ size: ${remaining.toFixed(2)} MB`);
