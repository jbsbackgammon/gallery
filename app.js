(() => {
  'use strict';

  const folderSelect = document.getElementById('folderSelect');
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
  function imageUrl(relativePath) {
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

  function renderFolder(folderId) {
    const folder = folders.find((entry) => entry.id === folderId);
    gallery.replaceChildren();

    if (!folder) {
      itemCount.textContent = '';
      setNotice('素材フォルダがありません。リポジトリ直下にフォルダを作り、画像を追加してください。');
      return;
    }

    const images = Array.isArray(folder.images) ? folder.images : [];
    itemCount.textContent = `${images.length}点`;

    if (images.length === 0) {
      setNotice('このフォルダには表示できる画像がありません。');
      return;
    }
    setNotice('');

    const fragment = document.createDocumentFragment();
    images.forEach((item, index) => {
      if (typeof item.path !== 'string' || typeof item.name !== 'string') return;
      const tile = document.createElement('a');
      const image = document.createElement('img');
      const filename = document.createElement('span');
      const url = imageUrl(item.path);

      tile.className = 'tile';
      tile.href = url;
      tile.download = item.name;
      tile.setAttribute('aria-label', `${item.name}をダウンロード`);
      tile.title = `${item.name} をダウンロード`;

      image.src = url;
      image.alt = '';
      image.loading = index < 10 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.draggable = false;

      filename.className = 'tile-name';
      filename.textContent = item.name;
      filename.setAttribute('aria-hidden', 'true');
      tile.append(image, filename);
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
