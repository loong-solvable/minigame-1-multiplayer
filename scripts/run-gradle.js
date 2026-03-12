const fs = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");

const androidDir = path.resolve(__dirname, "..", "android");
const args = process.argv.slice(2);

if (!args.length) {
  console.error("Usage: node scripts/run-gradle.js <gradle-task> [more-tasks]");
  process.exit(1);
}

const command = process.platform === "win32" ? "gradlew.bat" : "sh";
const commandArgs = process.platform === "win32" ? args : ["./gradlew", ...args];
const env = { ...process.env };

function resolveJavaHome() {
  if (env.JAVA_HOME) {
    return env.JAVA_HOME;
  }

  const candidates = [];
  if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home");
  }

  for (const candidate of candidates) {
    const javaBinary = path.join(candidate, "bin", process.platform === "win32" ? "java.exe" : "java");
    if (fs.existsSync(javaBinary)) {
      return candidate;
    }
  }

  return "";
}

const javaHome = resolveJavaHome();
if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${path.join(javaHome, "bin")}${path.delimiter}${env.PATH || ""}`;
}

const result = spawnSync(command, commandArgs, {
  cwd: androidDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status == null ? 1 : result.status);
