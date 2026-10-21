import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { basename, join, relative, sep } from 'node:path';

const root = process.cwd();
const output = join(root, 'dist');
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.bmp', '.apng']);
const allowedExtensions = new Set([...imageExtensions, '.json']);
const excludedFolders = new Set(['.github', 'scripts', 'dist', 'node_modules', '.git', '.vscode']);
const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
const sortNames = (a, b) => collator.compare(a.name, b.name);
const toWebPath = (path) => path.split(sep).join('/');
const isHidden = (name) => name.startsWith('.');
const getExtension = (name) => name.slice(name.lastIndexOf('.')).toLowerCase();
const isSupported = (name) => allowedExtensions.has(getExtension(name));

async function walk(directory) {
  const found = [];
  const entries = (await readdir(directory, { withFileTypes: true })).sort(sortNames);
  for (const entry of entries) {
    if (isHidden(entry.name) || entry.isSymbolicLink()) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(path));
    else if (entry.isFile() && isSupported(entry.name)) found.push(path);
  }
  return found;
}

// GitHub Actions checks out the complete history, so a file's last "added"
// commit is a reproducible storage date (unlike checkout/FS modification time).
// If a file was deleted and uploaded again, the newer addition is used.
function readUploadDates(folderNames) {
  const dates = new Map();
  if (!folderNames.length) return dates;
  try {
    const log = execFileSync('git', [
      'log', '--no-renames', '--diff-filter=A', '--name-only', '-z',
      '--format=GALLERY_COMMIT:%ct', '--', ...folderNames,
    ], { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

    // With -z, commit headers and file paths are NUL-separated. The first
    // path after each header has one leading line break. Paths are not quoted.
    let commitTime = null;
    let firstPath = false;
    for (const record of log.split('\0')) {
      if (!record) continue;
      if (record.startsWith('GALLERY_COMMIT:')) {
        const value = Number(record.slice('GALLERY_COMMIT:'.length));
        commitTime = Number.isFinite(value) ? value : null;
        firstPath = true;
        continue;
      }
      const path = firstPath && record.startsWith('\n') ? record.slice(1) : record;
      firstPath = false;
      if (path && !dates.has(path)) dates.set(path, commitTime);
    }
  } catch (error) {
    console.warn('Git history is unavailable; storage date sorting will fall back to file name.', error.message);
  }
  return dates;
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
  const uploadDates = readUploadDates(topLevel.map((entry) => entry.name));
  const folders = [];
  let totalFiles = 0;

  for (const entry of topLevel) {
    const folderPath = join(root, entry.name);
    const files = [];
    for (const file of await walk(folderPath)) {
      const rel = relative(root, file);
      const copyDest = join(output, rel);
      await mkdir(join(copyDest, '..'), { recursive: true });
      await copyFile(file, copyDest);
      const info = await stat(file);
      const webPath = toWebPath(rel);
      files.push({
        path: webPath,
        name: basename(file),
        type: getExtension(file) === '.json' ? 'json' : 'image',
        size: info.size,
        uploadedAt: uploadDates.get(webPath) ?? null,
      });
    }
    folders.push({ id: entry.name, name: entry.name, files });
    totalFiles += files.length;
  }
  await writeFile(join(output, 'gallery.json'), JSON.stringify({ version: 3, folders }, null, 2) + '\n');
  console.log(`Gallery build complete: ${folders.length} folders, ${totalFiles} files`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
