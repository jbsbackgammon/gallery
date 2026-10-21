import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';

const root = process.cwd();
const output = join(root, 'dist');
const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.bmp', '.apng']);
const excludedFolders = new Set(['.github', 'scripts', 'dist', 'node_modules', '.git', '.vscode']);
const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
const sortNames = (a, b) => collator.compare(a.name, b.name);
const toWebPath = (path) => path.split(sep).join('/');
const isHidden = (name) => name.startsWith('.');
const isImage = (name) => allowedExtensions.has(name.slice(name.lastIndexOf('.')).toLowerCase());

async function walk(directory) {
  const found = [];
  const entries = (await readdir(directory, { withFileTypes: true })).sort(sortNames);
  for (const entry of entries) {
    if (isHidden(entry.name) || entry.isSymbolicLink()) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(path));
    else if (entry.isFile() && isImage(entry.name)) found.push(path);
  }
  return found;
}

async function main() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const name of ['index.html', 'style.css', 'app.js']) {
    await copyFile(join(root, name), join(output, name));
  }
  await writeFile(join(output, '.nojekyll'), '');

  const topLevel = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !excludedFolders.has(entry.name) && !isHidden(entry.name))
    .sort(sortNames);
  const folders = [];
  let totalImages = 0;

  for (const entry of topLevel) {
    const folderPath = join(root, entry.name);
    const images = [];
    for (const file of await walk(folderPath)) {
      const rel = relative(root, file);
      const copyDest = join(output, rel);
      await mkdir(join(copyDest, '..'), { recursive: true });
      await copyFile(file, copyDest);
      const info = await stat(file);
      images.push({ path: toWebPath(rel), name: basename(file), size: info.size });
    }
    folders.push({ id: entry.name, name: entry.name, images });
    totalImages += images.length;
  }
  await writeFile(join(output, 'gallery.json'), JSON.stringify({ version: 1, folders }, null, 2) + '\n');
  console.log(`Gallery build complete: ${folders.length} folders, ${totalImages} images`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
