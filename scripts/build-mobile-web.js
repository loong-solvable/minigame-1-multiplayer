const fs = require("fs");
const path = require("path");

const DEFAULT_ENTRIES = [
  { src: "index.html", dest: "index.html" },
  { src: "styles.css", dest: "styles.css" },
  { src: "client", dest: "client" },
  { src: "assets", dest: "assets" }
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resolveOutputDir(projectRoot, outDir) {
  if (!outDir) {
    return path.join(projectRoot, "mobile-web");
  }
  return path.isAbsolute(outDir) ? outDir : path.join(projectRoot, outDir);
}

function copyEntry(projectRoot, outputDir, entry) {
  const srcPath = path.join(projectRoot, entry.src);
  const destPath = path.join(outputDir, entry.dest);

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

function buildMobileWeb(options = {}) {
  const projectRoot = options.projectRoot
    ? path.resolve(options.projectRoot)
    : path.resolve(__dirname, "..");
  const outputDir = resolveOutputDir(projectRoot, options.outDir);
  const entries = options.entries || DEFAULT_ENTRIES;

  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDir(outputDir);

  for (const entry of entries) {
    copyEntry(projectRoot, outputDir, entry);
  }

  return outputDir;
}

if (require.main === module) {
  const outputDir = buildMobileWeb();
  console.log("mobile-web prepared:", outputDir);
}

module.exports = {
  DEFAULT_ENTRIES,
  buildMobileWeb
};
