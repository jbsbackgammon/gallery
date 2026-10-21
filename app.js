(() => {
  'use strict';

  const folderSelect = document.getElementById('folderSelect');
  const sortSelect = document.getElementById('sortSelect');
  const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
  const itemCount = document.getElementById('itemCount');
  const gallery = document.getElementById('gallery');
  const notice = document.getElementById('notice');
  const main = document.getElementById('main');
  let folders = [];

  function setNotice(message) {
    notice.textContent = message;
    notice.hidden = !message;
  }

  // Encode each path segment individually. Japanese, spaces, #, %, etc. must work.
  function fileUrl(relativePath) {
    return relativePath.split('/').map(encodeURIComponent).join('/');
  }

  function readSelectedFolderFromUrl() {
    return new URL(window.location.href).searchParams.get('folder');
  }

  function saveSelectedFolderToUrl(id) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('folder', id);
    else url.searchParams.delete('folder');
    window.history.replaceState(null, '', url);
  }

  function compareByName(a, b) {
    return collator.compare(a.name, b.name) || collator.compare(a.path, b.path);
  }

  // "保管日順" means latest Git addition first, not the local file modification date.
  function sortedFiles(files) {
    return [...files].sort((a, b) => {
      if (sortSelect.value === 'date') {
        const aDate = typeof a.uploadedAt === 'number' ? a.uploadedAt : -1;
        const bDate = typeof b.uploadedAt === 'number' ? b.uploadedAt : -1;
        if (aDate !== bDate) return bDate - aDate;
      }
      return compareByName(a, b);
    });
  }

  function renderFolder(folderId) {
    const folder = folders.find((entry) => entry.id === folderId);
    gallery.replaceChildren();

    if (!folder) {
      itemCount.textContent = '';
      setNotice('素材フォルダがありません。リポジトリ直下にフォルダを作り、画像やJSONを追加してください。');
      return;
    }

    // Keep compatibility with the earlier v2 gallery.json manifest.
    const files = Array.isArray(folder.files) ? folder.files : (Array.isArray(folder.images) ? folder.images : []);
    const sorted = sortedFiles(files);
    itemCount.textContent = `${sorted.length}点`;

    if (sorted.length === 0) {
      setNotice('このフォルダには表示できる素材がありません。');
      return;
    }
    setNotice('');

    const fragment = document.createDocumentFragment();
    sorted.forEach((item, index) => {
      if (typeof item.path !== 'string' || typeof item.name !== 'string') return;
      const isJson = item.type === 'json' || (typeof item.path === 'string' && /\.json$/i.test(item.path));
      const tile = document.createElement('a');
      const url = fileUrl(item.path);

      tile.className = isJson ? 'tile tile--json' : 'tile';
      tile.href = url;
      tile.download = item.name;
      tile.setAttribute('aria-label', `${item.name}をダウンロード`);
      tile.title = item.name;

      if (isJson) {
        const label = document.createElement('span');
        label.className = 'json-badge';
        label.textContent = 'JSON';
        label.setAttribute('aria-hidden', 'true');

        const filename = document.createElement('span');
        filename.className = 'json-name';
        filename.textContent = item.name;
        filename.setAttribute('aria-hidden', 'true');
        tile.append(label, filename);
      } else {
        const image = document.createElement('img');
        const filename = document.createElement('span');
        image.src = url;
        image.alt = '';
        image.loading = index < 10 ? 'eager' : 'lazy';
        image.decoding = 'async';
        image.draggable = false;

        filename.className = 'tile-name';
        filename.textContent = item.name;
        filename.setAttribute('aria-hidden', 'true');
        tile.append(image, filename);
      }
      fragment.append(tile);
    });
    gallery.append(fragment);
  }

  function chooseFolder(id) {
    folderSelect.value = id;
    saveSelectedFolderToUrl(id);
    renderFolder(id);
  }

  folderSelect.addEventListener('change', () => chooseFolder(folderSelect.value));
  sortSelect.addEventListener('change', () => {
    const url = new URL(window.location.href);
    if (sortSelect.value === 'name') url.searchParams.set('sort', 'name');
    else url.searchParams.delete('sort');
    window.history.replaceState(null, '', url);
    renderFolder(folderSelect.value);
  });

  async function load() {
    try {
      const response = await fetch('./gallery.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.folders)) throw new Error('Invalid gallery data');
      folders = data.folders.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string');

      folderSelect.replaceChildren();
      for (const folder of folders) {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = folder.name;
        folderSelect.append(option);
      }

      if (!folders.length) {
        folderSelect.add(new Option('フォルダなし', ''));
        folderSelect.disabled = true;
        renderFolder(null);
        return;
      }

      folderSelect.disabled = false;
      sortSelect.value = new URL(window.location.href).searchParams.get('sort') === 'name' ? 'name' : 'date';
      const requested = readSelectedFolderFromUrl();
      const initialFolder = folders.some((folder) => folder.id === requested) ? requested : folders[0].id;
      chooseFolder(initialFolder);
    } catch (error) {
      console.error('Gallery loading failed:', error);
      folderSelect.replaceChildren(new Option('読み込みに失敗しました', ''));
      folderSelect.disabled = true;
      itemCount.textContent = '';
      setNotice('素材一覧を読み込めませんでした。ページを再読み込みしてください。');
    } finally {
      main.setAttribute('aria-busy', 'false');
    }
  }

  load();
})();
