const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "mobile-web");

const entries = [
  { src: "index.html", dest: "index.html" },
  { src: "styles.css", dest: "styles.css" },
  { src: "client", dest: "client" },
  { src: "assets", dest: "assets" }
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyEntry(entry) {
  const srcPath = path.join(root, entry.src);
  const destPath = path.join(outDir, entry.dest);

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Missing source: ${entry.src}`);
  }

  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    fs.cpSync(srcPath, destPath, { recursive: true, force: true });
    return;
  }

  ensureDir(path.dirname(destPath));
  fs.copyFileSync(srcPath, destPath);
}

function buildMobileWeb() {
  fs.rmSync(outDir, { recursive: true, force: true });
  ensureDir(outDir);

  for (const entry of entries) {
    copyEntry(entry);
  }

  console.log("mobile-web prepared:", outDir);
}

buildMobileWeb();
