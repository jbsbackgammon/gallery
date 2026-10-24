(() => {
  'use strict';

  const folderSelect = document.getElementById('folderSelect');
  const sortSelect = document.getElementById('sortSelect');
  const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
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
      setNotice('素材フォルダがありません。リポジトリ直下にフォルダを作り、画像やJSONを追加してください。');
      return;
    }

    // Keep compatibility with the earlier v2 gallery.json manifest.
    const files = Array.isArray(folder.files) ? folder.files : (Array.isArray(folder.images) ? folder.images : []);
    const sorted = sortedFiles(files);

    if (sorted.length === 0) {
      setNotice('このフォルダには表示できる素材がありません。');
      return;
    }
    setNotice('');

    const fragment = document.createDocumentFragment();
    for (const item of sorted) {
      if (typeof item.path !== 'string' || typeof item.name !== 'string') continue;

      const listItem = document.createElement('li');
      const link = document.createElement('a');
      listItem.className = 'file-item';
      link.className = 'file-link';
      link.href = fileUrl(item.path);
      link.download = item.name;
      link.textContent = item.name;
      link.setAttribute('aria-label', `${item.name}をダウンロード`);
      link.title = item.name;

      listItem.append(link);
      fragment.append(listItem);
    }
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

  async function fetchGalleryData() {
    // GitHub Pages の更新直後など、旧アセットが混在した場合の一時的な不整合を避ける。
    // cache: no-store に加え、1回目の取得が失敗した場合だけ別URLで再取得する。
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = attempt === 0 ? './gallery.json' : `./gallery.json?v=6-${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data || !Array.isArray(data.folders)) throw new Error('gallery.json の形式が正しくありません');
        return data;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async function load() {
    try {
      const data = await fetchGalleryData();
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
      // 原因を区別して、デプロイやPages設定の不備を調べられるようにする。
      const reason = error instanceof Error ? error.message : String(error);
      setNotice(`素材一覧を読み込めませんでした（${reason}）。GitHub Actions の Deploy Gallery が成功しているかと、Settings → Pages → Source が GitHub Actions になっているか確認してください。`);
    } finally {
      main.setAttribute('aria-busy', 'false');
    }
  }

  load();
})();
