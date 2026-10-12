# calorie-donate

TypeScript の最小モノレポです。アプリ固有の機能はまだ実装せず、Web と Expo React Native が **同じ Next.js バックエンド API** に接続する土台を用意しています。

```text
apps/web       Next.js App Router / Web UI / API Route Handlers
apps/mobile    Expo React Native / 接続確認画面
packages/api   Zod スキーマ・共有型・fetch クライアント（サーバー依存なし）
tests          通信の回帰テスト / 実際の Next.js を使うブラウザ・API テスト
```

## 採用バージョン

2026-10-12 時点の公式資料・npm 安定版タグを確認し、Next.js 16.4.0、Expo SDK 57.0.27、React Native 0.86.3、React 19.2.3 を採用しました。両アプリの React を揃え、TypeScript は Expo 公式 TypeScript テンプレートに合わせて 6.0.3、ESLint は公式 Expo / Next.js 設定内のプラグインの peer 要件に合わせて 9.39.5（10 系未対応）を使います。pnpm は 10.34.7 に固定し、lockfile をコミットしています。

- [Expo SDK の互換性表](https://docs.expo.dev/versions/latest/)（SDK 57: RN 0.86 / React 19.2.3 / Node 22.13 以上）
- [Expo の pnpm モノレポ対応](https://docs.expo.dev/guides/monorepos/)（SDK 54 以降は isolated install 対応。Metro は自動構成）
- [Next.js 16.4](https://nextjs.org/blog/next-16-4) / [インストール要件](https://nextjs.org/docs/app/getting-started/installation)

## 初回セットアップ

Node.js **24.13.0 以上の 24 系**（`.node-version`）と pnpm **10.34.7** を使います。Corepack が利用できる場合は `corepack enable`、なければ `npm install --global pnpm@10.34.7` で用意してください。

```sh
pnpm install --frozen-lockfile
cp apps/mobile/.env.example apps/mobile/.env.local
# .env.local の EXPO_PUBLIC_API_URL を実行端末に合わせて編集
pnpm dev:web
```

別のターミナルで:

```sh
pnpm dev:mobile
```

Web: <http://localhost:3000>。両画面の「API 接続を確認」で `calorie-donate-api (ok)` を確認できます。両方同時に起動する場合は `pnpm dev`。Expo のターミナルで `i`（iOS Simulator）、`a`（Android Emulator）、または対応する Expo Go で QR コードを読み取ります。SDK 57 に対応する Expo Go を使ってください。iOS Simulator には Xcode、Android Emulator には Android Studio / Android SDK が必要です。

### 接続先と環境変数

| 実行場所                  | `EXPO_PUBLIC_API_URL`        | 理由                                   |
| ------------------------- | ---------------------------- | -------------------------------------- |
| iOS Simulator（同じ Mac） | `http://localhost:3000`      | ホストの localhost に接続できる        |
| Android Studio Emulator   | `http://10.0.2.2:3000`       | ホストのループバックへの専用アドレス   |
| iOS / Android 実機        | `http://<PC の LAN IP>:3000` | 実機の localhost は実機自身            |
| Web ブラウザ              | 不要                         | 相対 URL `/api/*` で同じオリジンに接続 |

Next.js の dev は `0.0.0.0` に bind します。実機と PC は同じネットワークに接続し、PC のポート 3000 / Expo Metro のポート 8081 を利用可能にしてください。VPN / ファイアウォール / Wi-Fi の端末間通信制限も確認します。Expo の tunnel は Metro 用であり、Next.js API は別途 LAN から到達できる必要があります。環境変数を変更したら Expo を再起動し、端末も再読み込みします。

`EXPO_PUBLIC_API_URL` は **API のオリジンのみ**（`/api` を付けない）。未設定・不正な URL は画面に設定エラーとして表示します。`.env.example` だけをコミットし、`.env.local` は Git 管理外です。`EXPO_PUBLIC_*` と `NEXT_PUBLIC_*` はクライアントへ埋め込まれる公開値なので秘密情報を入れないでください。将来の秘密情報・サーバー専用コードは `apps/web` 内に限定します。API Route Handlers には `server-only` を付け、共有パッケージとモバイルにはサーバー依存を禁止する lint ルールがあります。

HTTP はローカル開発用です。独自のネイティブ開発ビルドで cleartext / ATS 制限に当たる場合は、開発専用設定またはローカル HTTPS を用意してください。リリース向け通信は HTTPS を前提にします。現構成はネイティブ Expo と Next.js Web を対象とし、Expo Web は設定していません。ブラウザ向けに別オリジンのクライアントを追加する場合は、その段階で許可するオリジンを限定した CORS を検討します。

## 最小 API

- `GET /api/health` → `{ "status": "ok", "service": "calorie-donate-api" }`、キャッシュなし。
- `POST /api/echo` → `{ "message": "通信確認" }` を送ると同じ形式で返す、通信検証専用のサンプル。trim 後 1–200 文字。不正な入力・JSON は HTTP 400 と `{ "error": { "code": "INVALID_REQUEST", "message": "..." } }`。

両アプリは `@calorie-donate/api` の同じ fetch クライアントを使います。リクエストとレスポンスを Zod で検証し、接続不能、HTTP エラー、不正レスポンス、10 秒のタイムアウトを区別します。接続失敗後はボタンから再試行できます。共有コードに DB、認証、課金、秘密値、Node 専用モジュールは含めていません。

## 検証

```sh
pnpm exec playwright install chromium # ブラウザ検証の初回のみ
pnpm check
```

個別実行:

```sh
pnpm lint
pnpm format:check   # 修正: pnpm format
pnpm knip
pnpm typecheck
pnpm test
pnpm build
pnpm expo:check     # expo install --check + expo-doctor
pnpm expo:export    # iOS / Android の production JS bundle（ネイティブコンパイルではない）
pnpm test:e2e      # build 済み Next.js を 127.0.0.1:3100 で起動
```

Vitest は共有クライアントの URL、JSON、HTTP / ネットワーク / タイムアウト、不正レスポンスを検証します。Playwright は Web の実通信、失敗後の再試行、モバイルと同じ絶対 URL クライアントからの実 API 通信、API の入力エラーを検証します。GitHub Actions は frozen install と上記チェックを毎 PR 実行します。

Expo export / 型チェックはネイティブ端末での実行を保証しません。OS のネットワーク制約や実機 LAN 接続の確認は、上記の起動手順で端末を使って行います。ネイティブ配布ビルド、EAS、DB、認証、クラウドリソースは今回の範囲に含めていません。
