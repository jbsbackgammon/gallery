# 素材保管庫（JBS Gallery）

JBS の作成素材をフォルダ別に表示し、画像をクリック／タップすると元ファイルを直接ダウンロードできる GitHub Pages サイトです。

公開URL： https://jbsbackgammon.github.io/gallery/

## フォルダ・素材の追加

リポジトリ **直下** にフォルダを作り、その中に画像を追加するだけです。GitHub Actions のデプロイ時にプルダウンと画像一覧が自動更新されます。**HTML や JSON の編集は不要です。**

例：

```text
gallery/
├── index.html
├── app.js
├── style.css
├── scripts/build-gallery.mjs
├── .github/workflows/deploy.yml
├── 王位戦/
│   ├── 2026表彰.png
│   └── 決勝/2026-決勝.webp
├── 配信用素材/
│   ├── サムネイル01.jpg
│   └── サムネイル02.png
└── SNS投稿用/
    └── 告知画像.svg
```

- 一番上のフォルダがプルダウンの選択肢になります。フォルダ名には日本語や空白が使えます。
- ヘッダー右端のプルダウンで **「保管日順」**（初期値・新しい順）／**「ファイル名順」**（自然順：1、2、10の順）を切り替えられます。
- 「保管日順」は **GitHub に画像が追加されたコミット日時** を基準にします。ファイルの更新日時ではありません。同じコミットで追加された画像はファイル名順です。一度削除して再追加した画像は再追加日を採用します。
- タイルにカーソルを合わせるとファイル名が表示されます（キーボードで選択した場合も同様）。長い名前も折り返して表示します。
- サブフォルダにも画像を置けますが、プルダウンに出るのは一番上のフォルダだけです。
- 対応：PNG / JPG / JPEG / WebP / GIF / SVG / AVIF / BMP / APNG。
- PC 5列、幅768〜1023px 4列、スマートフォンは2列。各タイルは16:9、元の縦横比のまま **上寄せで切り抜き表示** します。
- タイルをクリック／タップすると、縮小画像ではなく、**元のファイル**をダウンロードします。
- 選択中フォルダは URL の `?folder=` に保持されます。「ファイル名順」のときは `?sort=name` も保持するため、その表示状態を共有できます。
- `scripts`、`.github`、`dist`、`node_modules` などは素材フォルダとして扱いません。

## 最初の公開

1. ZIPを展開し、**中身**を https://github.com/jbsbackgammon/gallery の `main` ブランチ直下にアップロードします（ZIPファイルのまま置かないでください）。`.github/workflows/deploy.yml` も含めます。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
3. GitHub の **Actions → Deploy Gallery** で最初の実行が完了すれば公開です。素材の追加・削除時も `main` への push で再実行されます。
4. 最初は素材フォルダがないため、空の案内画面が表示されます。フォルダと画像を追加すると表示されます。

## GitHub Actions と警告への対応

- `ubuntu-24.04` を指定し、`ubuntu-latest` のイメージ移行アノテーションを回避。
- checkout 時に `fetch-depth: 0` として Git 履歴を取得し、保管日を算出します。履歴がないローカル環境では、保管日不明の画像はファイル名順になります。
- Actions は Node.js 24 対応版：`checkout@v7`、`setup-node@v7`、`configure-pages@v6`、`upload-pages-artifact@v5`、`deploy-pages@v5`。
- 外部パッケージは不要。Node.js 24 でスクリプトを実行します。
- GitHub 側の障害や将来の非推奨化等、GitHub が発行する**すべての警告を永久にゼロにする保証**ではありません。

## ローカルでの確認

Node.js 24 を入れた環境でルートディレクトリから実行します。

```bash
node scripts/build-gallery.mjs
python -m http.server 8000 --directory dist
```

`http://localhost:8000/` をブラウザで開くと、フォルダ一覧・表示・ダウンロードを確認できます。

## 公開範囲について

GitHub Pages に配信した画像は、URLを知っていれば第三者も取得できます。機密素材は置かないでください。`noindex` は検索エンジンへの依頼でありアクセス制限ではありません。
