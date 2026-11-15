import { pathToFileURL } from 'node:url';

export function isMainModule(importMetaUrl: string, argv1: string | undefined): boolean {
  if (!argv1) {
    return false;
  }
  return importMetaUrl === pathToFileURL(argv1).href;
}
