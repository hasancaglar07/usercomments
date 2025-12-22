import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const nodeRequire = createRequire(import.meta.url);
const { platform, arch } = process;

const INSTALL_GUARD_ENV = "LIGHTNINGCSS_ENSURE_RUNNING";

function resolvePackage(name) {
  try {
    nodeRequire.resolve(name, { paths: [process.cwd()] });
    return true;
  } catch {
    return false;
  }
}

function detectLinuxVariant() {
  if (platform !== "linux") {
    return null;
  }
  try {
    const { familySync, MUSL } = nodeRequire("detect-libc");
    const family = familySync();
    if (family === MUSL) {
      return "musl";
    }
  } catch {
    // fall back to gnu
  }
  if (arch === "arm") {
    return "gnueabihf";
  }
  return "gnu";
}

function buildPackageName() {
  if (platform === "linux") {
    const variant = detectLinuxVariant();
    if (arch === "arm64") {
      return `lightningcss-linux-arm64-${variant}`;
    }
    if (arch === "arm") {
      return "lightningcss-linux-arm-gnueabihf";
    }
    if (arch === "x64") {
      return `lightningcss-linux-x64-${variant}`;
    }
    return null;
  }
  if (platform === "win32") {
    if (arch === "x64") {
      return "lightningcss-win32-x64-msvc";
    }
    if (arch === "arm64") {
      return "lightningcss-win32-arm64-msvc";
    }
    return null;
  }
  if (platform === "darwin") {
    if (arch === "arm64") {
      return "lightningcss-darwin-arm64";
    }
    if (arch === "x64") {
      return "lightningcss-darwin-x64";
    }
    return null;
  }
  if (platform === "freebsd") {
    if (arch === "x64") {
      return "lightningcss-freebsd-x64";
    }
    return null;
  }
  if (platform === "android") {
    if (arch === "arm64") {
      return "lightningcss-android-arm64";
    }
    return null;
  }
  return null;
}

function installPackage(pkgName) {
  const npmCmd = platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npmCmd,
    ["install", "--no-save", "--no-package-lock", "--ignore-scripts", pkgName],
    {
      stdio: "inherit",
      env: { ...process.env, [INSTALL_GUARD_ENV]: "1" },
    }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensurePackage(pkgName) {
  if (resolvePackage(pkgName)) {
    return;
  }

  if (process.env[INSTALL_GUARD_ENV]) {
    console.error(
      `Missing ${pkgName}. Reinstall dependencies for this platform.`
    );
    process.exit(1);
  }

  installPackage(pkgName);

  if (!resolvePackage(pkgName)) {
    console.error(
      `Failed to install ${pkgName}. Remove node_modules and reinstall.`
    );
    process.exit(1);
  }
}

const pkgName = buildPackageName();
if (pkgName) {
  ensurePackage(pkgName);
}
