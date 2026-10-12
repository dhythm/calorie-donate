# Calorie Donate brand assets

提供された `CalorieMate_.ai` のベクター輪郭を正式なロゴ原本として使用します。
字形を再入力せず、元のパスから各サイズを書き出しています。
背景色は `caloriedonate.psd` から取得しています。AI・PSD原本はローカルに保存し、公開リポジトリには含めません。

- 背景色: **#F9BF13**（PSDから取得）
- ロゴ色: **#000000**
- 画面は白をベースに、本文は黒（#202020）、補足はグレー（#666666）で統一します。
- 黄色のボタンや選択表示には黒い文字を使い、薄緑や緑の文字は使用しません。
- グラフは白地で読める濃い黄土色とチャコールを使い、凡例を併記します。
- 横長の表示: 完全な `Calorie Donate` ロゴ
- 正方形・小さい表示: 原本の最初の **C** のみ
- 変形・縦横比の変更・影・縁取りは加えません。

[白をベースにした画面のプレビュー](white-theme-preview.jpg)

見出しは太く大きく、説明文は控えめにし、角丸は4pxを基本にします。
影や丸いカードを重ねず、罫線と24px・40pxの間隔でセクションを分けます。
初期設定はデスクトップで説明とフォームを2列、スマホで1列に配置します。

[レイアウト更新後のデスクトップ](refined-desktop-preview.jpg) / [スマホ](refined-mobile-preview.jpg) / [未設定時の案内](refined-setup-preview.jpg)

## 原本と書き出し

ローカルの `source/CalorieMate_.ai` と `source/caloriedonate.psd` は元ファイルのコピーです（Git管理対象外）。
`source/wordmark.svg` はAIから抽出したロゴ全体の輪郭、`source/monogram.svg` はその先頭のCです。
フォントをパスに変換済みなので、フォントのインストールは不要です。
AI内の文字の穴に重なる白い図形は除去し、PSDと同じ透明な抜きにしています。
拡大しても輪郭がぼやけないSVGから、PNGとICOを直接生成しています。

依存パッケージをインストール済みの環境で、リポジトリルートから再生成できます。

```sh
pnpm brand:generate
```

アプリに組み込んだロゴはすべてローカルファイルを参照し、外部フォントを必要としません。

## Web

`apps/web/public/brand/`:

| ファイル                       | 用途                                     |
| ------------------------------ | ---------------------------------------- |
| `wordmark.svg`, `wordmark.png` | ヘッダー用、透明背景、1008×288           |
| `favicon.svg`                  | 拡大可能なSVGファビコン                  |
| `favicon.ico`                  | 16 / 32 / 48 / 64px の複数サイズ         |
| `favicon-32.png`               | PNGファビコン                            |
| `apple-touch-icon.png`         | Appleホーム画面用、180×180               |
| `icon-192.png`, `icon-512.png` | Webアプリ用アイコン                      |
| `icon-maskable-512.png`        | マスク可能なホーム画面アイコン、余白付き |
| `social-card.png`              | 共有画像の素材、1200×630                 |

ヘッダー、ファビコン、Appleアイコン、`manifest.webmanifest` を接続済みです。
マニフェストには表示名・背景色・アイコンを設定しています。オフライン機能は追加していません。
共有画像は再利用用の素材です。公開URLが決まった段階でOGPメタデータを設定してください。

## iOS / Android

`apps/mobile/assets/brand/`:

| ファイル                  | 用途                                                |
| ------------------------- | --------------------------------------------------- |
| `icon.png`                | 不透明の正方形アプリアイコン、1024×1024             |
| `adaptive-foreground.png` | Android用透明前景、1024×1024                        |
| `adaptive-monochrome.png` | Androidのテーマ対応アイコン用アルファマスク         |
| `splash-mark.png`         | Androidのネイティブ起動画面用Cマーク                |
| `wordmark.png`            | iOS起動画面・アプリ内読み込み・ヘッダー・初期設定用 |

Androidのアダプティブアイコンは、文字全体を中央の円形セーフエリア内に収めています。
角丸は画像に焼き込まず、OSに任せています。
Androidのネイティブ起動画面はOSの表示制約に合わせてCを使い、iOSとアプリ内読み込み画面では横長ロゴを表示します。
背景は共通の黄色です。読み込みを演出のために引き延ばす処理はありません。

アイコン・ネイティブ起動画面を反映するには、新しいアプリビルドが必要です。
Expo Goだけでは実際の起動画面の確認はできません。
リリース前にiOS / Androidのリリースビルドで確認してください。
参考: [Expo SplashScreen](https://docs.expo.dev/versions/latest/sdk/splash-screen/)
