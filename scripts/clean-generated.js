const fs = require("fs");
const path = require("path");

const REMOVABLE_PATHS = [
  "server-runtime.log",
  "server-stdout.log",
  "server-stderr.log",
  "node_modules",
  ".gradle-user",
  ".android-user",
  "mobile-web",
  "orgin",
  "android/.gradle",
  "android/app/build",
  "android/capacitor-cordova-android-plugins",
  "android/app/src/main/assets",
  "android/app/src/main/res/xml/config.xml"
];

function parseArgs(argv) {
  const args = { apply: false, projectRoot: path.resolve(__dirname, "..") };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") {
      args.apply = true;
      continue;
    }
    if (value === "--project") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value for --project");
      }
      args.projectRoot = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function assertInsideRoot(projectRoot, absolutePath) {
  const relative = path.relative(projectRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to touch path outside project: ${absolutePath}`);
  }
}

function main() {
  const { apply, projectRoot } = parseArgs(process.argv.slice(2));
  const packageJson = path.join(projectRoot, "package.json");

  if (!fs.existsSync(packageJson)) {
    throw new Error(`Not a project root: ${projectRoot}`);
  }

  const existing = [];
  for (const relPath of REMOVABLE_PATHS) {
    const absolutePath = path.join(projectRoot, relPath);
    assertInsideRoot(projectRoot, absolutePath);
    if (fs.existsSync(absolutePath)) {
      existing.push({ relPath, absolutePath });
    }
  }

  if (!existing.length) {
    console.log("No generated artifacts found.");
    return;
  }

  console.log(apply ? "Removing generated artifacts:" : "Generated artifacts that can be removed:");
  for (const item of existing) {
    console.log(`- ${item.relPath}`);
  }

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to delete.");
    return;
  }

  for (const item of existing) {
    fs.rmSync(item.absolutePath, { recursive: true, force: true });
  }

  console.log("Cleanup completed.");
}

main();
