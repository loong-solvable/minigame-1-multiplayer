const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const androidDir = path.join(projectRoot, "android");
const localPropertiesPath = path.join(androidDir, "local.properties");
const signingPropertiesPath = path.join(androidDir, "signing.properties");
const signingExamplePath = path.join(androidDir, "signing.properties.example");

function parseProperties(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const map = new Map();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    map.set(key, value);
  }

  return map;
}

function printCheck(ok, title, detail) {
  const prefix = ok ? "OK " : "MISS";
  console.log(`${prefix} ${title}`);
  if (detail) {
    console.log(`   ${detail}`);
  }
}

function parseJavaMajor(versionText) {
  const match = versionText.match(/version "([^"]+)"/);
  if (!match) return 0;
  const raw = match[1];
  if (raw.startsWith("1.")) {
    return Number(raw.split(".")[1] || 0);
  }
  return Number(raw.split(".")[0] || 0);
}

function detectJava() {
  const candidates = [];

  if (process.env.JAVA_HOME) {
    candidates.push(path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java"));
  }

  if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home/bin/java");
  }

  candidates.push(process.platform === "win32" ? "java.exe" : "java");

  for (const command of candidates) {
    const result = spawnSync(command, ["-version"], {
      encoding: "utf8",
      shell: process.platform === "win32"
    });

    if (result.error || result.status !== 0) {
      continue;
    }

    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    const major = parseJavaMajor(output);
    if (!major) {
      continue;
    }

    return {
      command,
      major,
      versionText: output.trim().split(/\r?\n/)[0] || output.trim()
    };
  }

  return null;
}

function main() {
  const nodeMajor = Number(process.versions.node.split(".")[0] || 0);
  printCheck(nodeMajor >= 18, "Node.js >= 18", `current=${process.version}`);

  const javaInfo = detectJava();
  printCheck(
    Boolean(javaInfo && javaInfo.major >= 17),
    "JDK >= 17",
    javaInfo
      ? `java=${javaInfo.command}, version=${javaInfo.versionText}`
      : "missing. Install JDK 17 and ensure JAVA_HOME or java is available before running Gradle."
  );

  printCheck(fs.existsSync(androidDir), "android/ project exists", androidDir);

  const hasLocalProperties = fs.existsSync(localPropertiesPath);
  printCheck(
    hasLocalProperties,
    "android/local.properties",
    hasLocalProperties
      ? `found at ${localPropertiesPath}`
      : "missing. Android Studio usually generates it automatically after opening the android project."
  );

  const sdkRootFromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
  let sdkRootFromLocal = "";
  if (hasLocalProperties) {
    const localProps = parseProperties(localPropertiesPath);
    sdkRootFromLocal = localProps.get("sdk.dir") || "";
  }

  const resolvedSdkRoot = sdkRootFromLocal || sdkRootFromEnv;
  printCheck(
    Boolean(resolvedSdkRoot),
    "Android SDK path",
    resolvedSdkRoot
      ? `sdk=${resolvedSdkRoot}`
      : "set sdk.dir in android/local.properties, or set ANDROID_HOME / ANDROID_SDK_ROOT."
  );

  const hasSigningProperties = fs.existsSync(signingPropertiesPath);
  printCheck(
    hasSigningProperties,
    "android/signing.properties",
    hasSigningProperties
      ? `found at ${signingPropertiesPath}`
      : `missing. Copy from ${path.relative(projectRoot, signingExamplePath)} when you need a release APK.`
  );

  if (hasSigningProperties) {
    const signingProps = parseProperties(signingPropertiesPath);
    const storeFile = signingProps.get("storeFile") || "";
    if (storeFile) {
      const keystorePath = path.resolve(androidDir, storeFile);
      printCheck(
        fs.existsSync(keystorePath),
        "release keystore file",
        fs.existsSync(keystorePath)
          ? `keystore=${keystorePath}`
          : `configured but missing: ${keystorePath}`
      );
    } else {
      printCheck(false, "release keystore file", "signing.properties exists, but storeFile is empty.");
    }
  } else {
    printCheck(false, "release keystore file", "not needed for debug APK. Required only for release APK.");
  }

  console.log("");
  console.log("Summary:");
  console.log("- Debug APK needs: Node 18+, Android SDK/JDK 17, android/local.properties, then build.");
  console.log("- Release APK needs everything above, plus signing.properties and a real keystore.");
}

main();
