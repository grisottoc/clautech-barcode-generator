import fs from "node:fs/promises";
import path from "node:path";

/**
 * Atomic-ish write with Windows overwrite hardening.
 */
export async function writeFileAtomic(targetPath: string, pngData: Uint8Array): Promise<void> {
  if (!targetPath || typeof targetPath !== "string") {
    throw new Error("Invalid path");
  }

  const normalized = path.normalize(targetPath);
  const dir = path.dirname(normalized);

  await fs.mkdir(dir, { recursive: true });

  const tmpPath = makeTempPath(normalized);
  const bakPath = makeBackupPath(normalized);

  try {
    await fs.writeFile(tmpPath, Buffer.from(pngData));

    try {
      await fs.rename(tmpPath, normalized);
      return;
    } catch (err: any) {
      if (!shouldAttemptReplace(err)) throw err;
    }

    try {
      await fs.rename(normalized, bakPath);
    } catch {
      // ignore
    }

    try {
      await fs.rename(tmpPath, normalized);
    } catch {
      await replaceWithRetries(tmpPath, normalized);
    }

    try {
      await fs.rm(bakPath, { force: true });
    } catch {
      // ignore
    }
  } catch (err) {
    try {
      await fs.rm(tmpPath, { force: true });
    } catch {}

    try {
      await fs.rm(bakPath, { force: true });
    } catch {}

    throw err;
  } finally {
    try {
      await fs.rm(tmpPath, { force: true });
    } catch {}
  }
}

function makeTempPath(targetPath: string): string {
  return `${targetPath}.tmp-${process.pid}-${Date.now()}`;
}

function makeBackupPath(targetPath: string): string {
  return `${targetPath}.bak-${process.pid}-${Date.now()}`;
}

function shouldAttemptReplace(err: any): boolean {
  return ["EEXIST", "EPERM", "EACCES", "EBUSY"].includes(err?.code);
}

async function replaceWithRetries(tmpPath: string, finalPath: string): Promise<void> {
  for (let i = 0; i < 5; i++) {
    try {
      await fs.rm(finalPath, { force: true });
      await fs.rename(tmpPath, finalPath);
      return;
    } catch (err: any) {
      if (!["EPERM", "EACCES", "EBUSY"].includes(err?.code) || i === 4) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
  }
}

export const writePngAtomic = writeFileAtomic;
