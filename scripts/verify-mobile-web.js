const fs = require("fs");
const os = require("os");
const path = require("path");

const { DEFAULT_ENTRIES, buildMobileWeb } = require("./build-mobile-web");

function listFiles(rootDir) {
  const result = [];

  function walk(currentDir) {
    const names = fs.readdirSync(currentDir).sort();
    for (const name of names) {
      const absPath = path.join(currentDir, name);
      const stat = fs.statSync(absPath);
      if (stat.isDirectory()) {
        walk(absPath);
        continue;
      }
      result.push(path.relative(rootDir, absPath).replace(/\\/g, "/"));
    }
  }

  walk(rootDir);
  return result;
}

function compareEntry(projectRoot, generatedRoot, entry) {
  const srcPath = path.join(projectRoot, entry.src);
  const destPath = path.join(generatedRoot, entry.dest);
  const srcStat = fs.statSync(srcPath);
  const destStat = fs.statSync(destPath);

  if (srcStat.isDirectory() !== destStat.isDirectory()) {
    throw new Error(`Type mismatch for ${entry.src}`);
  }

  if (!srcStat.isDirectory()) {
    const srcContent = fs.readFileSync(srcPath);
    const destContent = fs.readFileSync(destPath);
    if (!srcContent.equals(destContent)) {
      throw new Error(`File mismatch: ${entry.src}`);
    }
    return;
  }

  const srcFiles = listFiles(srcPath);
  const destFiles = listFiles(destPath);
  if (srcFiles.length !== destFiles.length) {
    throw new Error(`File count mismatch in directory: ${entry.src}`);
  }

  for (let index = 0; index < srcFiles.length; index += 1) {
    if (srcFiles[index] !== destFiles[index]) {
      throw new Error(`File list mismatch in directory: ${entry.src}`);
    }
  }

  for (const relFile of srcFiles) {
    const srcFile = fs.readFileSync(path.join(srcPath, relFile));
    const destFile = fs.readFileSync(path.join(destPath, relFile));
    if (!srcFile.equals(destFile)) {
      throw new Error(`File mismatch: ${path.posix.join(entry.src, relFile)}`);
    }
  }
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "minigame-mobile-web-"));

  try {
    const outputDir = buildMobileWeb({
      projectRoot,
      outDir: path.join(tempRoot, "mobile-web")
    });

    for (const entry of DEFAULT_ENTRIES) {
      compareEntry(projectRoot, outputDir, entry);
    }

    console.log("mobile-web verification passed");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();
