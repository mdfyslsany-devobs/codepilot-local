import { rename, copyFile as fsCopyFile, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateSafePath } from '../security/path-validator.js';
import { verifySymlinkSafety } from '../security/symlink-guard.js';
import { createFolder } from '../creator/folder-creator.js';

export async function moveFile(
  projectRoot: string,
  fromRelative: string,
  toRelative: string
): Promise<{ from: string; to: string }> {
  const source = validateSafePath(projectRoot, fromRelative);
  const dest = validateSafePath(projectRoot, toRelative);

  verifySymlinkSafety(projectRoot, source.fullPath);
  verifySymlinkSafety(projectRoot, dest.fullPath);

  if (!existsSync(source.fullPath)) {
    throw new Error(`Source file does not exist: ${fromRelative}`);
  }

  if (existsSync(dest.fullPath)) {
    throw new Error(`Target destination already exists: ${toRelative}`);
  }

  await createFolder(projectRoot, dirname(dest.safeRelativePath));
  await rename(source.fullPath, dest.fullPath);

  return { from: source.safeRelativePath, to: dest.safeRelativePath };
}

export async function copyFile(
  projectRoot: string,
  fromRelative: string,
  toRelative: string
): Promise<{ from: string; to: string }> {
  const source = validateSafePath(projectRoot, fromRelative);
  const dest = validateSafePath(projectRoot, toRelative);

  verifySymlinkSafety(projectRoot, source.fullPath);
  verifySymlinkSafety(projectRoot, dest.fullPath);

  if (!existsSync(source.fullPath)) {
    throw new Error(`Source file does not exist: ${fromRelative}`);
  }

  if (existsSync(dest.fullPath)) {
    throw new Error(`Target destination already exists: ${toRelative}`);
  }

  await createFolder(projectRoot, dirname(dest.safeRelativePath));
  await fsCopyFile(source.fullPath, dest.fullPath);

  return { from: source.safeRelativePath, to: dest.safeRelativePath };
}

export async function renameFile(
  projectRoot: string,
  fromRelative: string,
  toRelative: string
): Promise<{ from: string; to: string }> {
  return moveFile(projectRoot, fromRelative, toRelative);
}

export async function deleteFile(
  projectRoot: string,
  relativePath: string
): Promise<{ deletedPath: string }> {
  const { fullPath, safeRelativePath } = validateSafePath(projectRoot, relativePath);
  verifySymlinkSafety(projectRoot, fullPath);

  if (!existsSync(fullPath)) {
    throw new Error(`File to delete does not exist: ${relativePath}`);
  }

  const s = await stat(fullPath);
  if (s.isDirectory()) {
    throw new Error(`Path is a directory, not a file: ${relativePath}`);
  }

  await unlink(fullPath);
  return { deletedPath: safeRelativePath };
}
