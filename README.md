# calorie-donate

**Calorie Donate** は、1日の目標カロリーを超えた分を世界の子どもたちへの寄付に変えるダイエット支援アプリです。Web（Next.js）とスマートフォン（Expo React Native）が **同じ Next.js バックエンド API** を使います。

```text
apps/web       Next.js App Router / Web UI / API Route Handlers / サーバー側ロジック (src/server)
apps/mobile    Expo React Native / スマホ画面
packages/api   Zod スキーマ・共有型・計算ロジック・fetch クライアント（サーバー依存なし）
tests          単体テスト（計算・サービス・写真推定）/ 実際の Next.js を使うブラウザ・API テスト
```

## 機能

| 画面         | Web                         | スマホ   | 内容                                                                                                            |
| ------------ | --------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| はじめの設定 | `/`（未設定時）             | 初回起動 | 目標カロリー（800〜6,000 kcal）と寄付レート（100 kcal 超過ごとの円）を設定                                      |
| ホーム       | `/`                         | ホーム   | 今日の摂取量 / 目標、残り or 超過、このままだと寄付になる額、食事一覧（編集・削除）、累計寄付。前の日にも移動可 |
| 記録         | `/meals/new`, `/meals/[id]` | 記録     | **写真で推定**（撮影・選択 → サーバーでカロリー推定 → 品目ごとに修正して保存）と **手入力**                     |
| 履歴         | `/history`                  | 履歴     | 直近 30 日の摂取量バー、超過、寄付（確定 / 暫定）                                                               |
| 寄付         | `/donations`                | 寄付     | 累計寄付額、確定待ち、寄付の記録（台帳）、しくみの説明                                                          |
| 設定         | `/settings`                 | 設定     | 目標・レートの変更、API 接続確認                                                                                |

### 寄付のルール

- 寄付額 = 超過 kcal × レート ÷ 100（円未満切り捨て）。目標以内なら 0 円。
- 記録・修正できるのは **今日と昨日** だけです（夕食を翌朝に記録できるように 1 日の猶予を設けています）。それより前の日は API へのアクセス時に自動で **確定** し、確定時の目標・レートで寄付台帳に記録されます。確定後に目標やレートを変えても過去の寄付は変わりません。
- 「今日」はプロフィールのタイムゾーン（初期値はブラウザ / 端末のもの、なければ `Asia/Tokyo`）で判定します。
- 現時点では寄付額の **記録のみ** で、決済・送金は行いません。

### 写真からのカロリー推定

アップロードした写真の ID を `POST /api/meals/estimate` に送ると、品目ごとの kcal・合計・確からしさ・前提メモを返します。保存はユーザーが内容を確認してから行います。Web はブラウザで長辺 1,568px の JPEG に縮小してから送ります。

- `ANTHROPIC_API_KEY` があれば Claude（既定 `claude-opus-5-5`、`CALORIE_ESTIMATOR_MODEL` で変更可）の画像認識で推定します。構造化出力でスキーマを固定し、料理が写っていない写真は `NOT_FOOD` を返します。
- キーがない、または `CALORIE_ESTIMATOR=mock` のときは、写真を解析しない **サンプル推定**（`provider: "mock"`）を返し、画面にもその旨を表示します。ローカル開発・CI・E2E はこちらを使います。

### データベース（PostgreSQL）

データは PostgreSQL に保存します（Drizzle ORM。スキーマ `apps/web/src/server/db/schema.ts`、マイグレーション `apps/web/drizzle/`）。同じスキーマとマイグレーションを、次の 3 つの環境で使います。

| 環境                     | 接続先                                          | 設定                                                                                                              |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ローカル開発             | Docker の PostgreSQL 17（`compose.yaml`）       | `pnpm db:up` のあと `DATABASE_URL=postgres://calorie:calorie@localhost:5432/calorie_donate`                       |
| 本番                     | Neon などのマネージド PostgreSQL                | Neon の接続文字列（`?sslmode=require` 付き、サーバーレス環境では pooled 接続）を `DATABASE_URL` に設定            |
| エージェント・素早い確認 | PGlite（WASM の PostgreSQL をプロセス内で実行） | `DATABASE_URL` を **設定しない**。データは `apps/web/.data/pglite`（`PGLITE_DATA_DIR`、`memory://` でメモリのみ） |

- `DATABASE_URL` があれば node-postgres で接続し、なければ PGlite を使います。DB プロセスを起動しなくても `pnpm dev:web` やテストがそのまま動きます。
- Dockerなしで起動する場合は、`apps/web/.env.local` とシェル環境の `DATABASE_URL` を未設定にして `pnpm dev` を実行します。保存先の親フォルダーは初回アクセス時に自動作成されるので、手動作成は不要です。`PGLITE_DATA_DIR=memory://` を指定した場合は再起動するとデータが消えます。
- 起動後の最初のアクセス（`/api/health` を含む）で未適用のマイグレーションを当てます。本番では、デプロイ時に `DATABASE_URL=... pnpm db:migrate` を実行し、`DATABASE_AUTO_MIGRATE=false` にして自動適用を止めることを推奨します。
- スキーマを変えたら `pnpm db:generate` でマイグレーションを作ってコミットします。CI はスキーマとマイグレーションの食い違いを検出します。
- どのテーブルにも `user_id` があり、今は単一ユーザー（`local`）です。ログイン導入時はこの値を認証ユーザーに置き換えます。
- PGlite のデータディレクトリは 1 プロセスからしか開けません。同じディレクトリで dev サーバーを 2 つ起動しないでください。

### 期間別の記録とデモデータ

グラフ下の「記録サマリー」は、週・月・年で表示を切り替えられます。週は月曜始まり、月は暦月で日別表示し、年は12か月の集計だけを表示します。過去の年・月も指定でき、年表示の月を選ぶとその月の日別一覧へ移動します。進行中の週・月は今日までを集計し、年表示の未来の月は「未到来」とします。平均摂取カロリーは記録のある日のみで計算し、確定した寄付と確定待ちを分けて表示します。上段の習慣グラフは引き続き直近12週間です。

```sh
pnpm seed:demo # 前年1月から今日までのデモ専用DBを作成
pnpm dev:demo  # 通常の開発サーバーを停止してから実行（Web、ポート3000）
```

デモデータは `apps/web/.data/demo-pglite` に保存し、通常の `.data/pglite` や `DATABASE_URL` のDBには書き込みません。`dev:demo` は毎回シードを確認し、サンプル推定で起動します。通常モードへ戻すには停止後に `pnpm dev` を実行します。モバイルも同じWeb APIに接続するとデモ内容を閲覧できます。

デモには、未記録の月・日、目標以内・目標ちょうど・超過、0 kcalの記録、複数品目・メモ、過去の目標／寄付レート、確定済みと今日・昨日の暫定分が含まれます。固定IDで追加するため再実行しても重複せず、既存のデモDB内の手入力データも削除しません。PGliteを同時に開かないよう、デモサーバーを停止してから `seed:demo` を実行してください。

表示例: [年単位のサマリー](assets/demo/year-summary.jpg) / [月単位の日別記録](assets/demo/month-records.jpg)

### 写真の保存

食事の写真は `POST /api/photos`（base64、5 MB 以下）で保存し、食事の `photoId` に紐づけます。形式はファイル先頭のバイトで判定し（JPEG / PNG / WebP / GIF 以外は拒否）、`GET /api/photos/:id` で配信します。写真推定はアップロード済みの写真 ID を渡して行うので、画像を 2 回送ることはありません。食事を削除するか写真を差し替えると古い写真も削除され、食事に紐づかないまま 1 日たった写真は次のアップロード時に削除されます。現在は DB（`bytea`）に保存しています。写真が増えたら、オブジェクトストレージ（S3、Vercel Blob など）へ移す想定です。

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

Web: <http://localhost:3000>。初回は目標カロリーの設定画面が出ます。設定画面の「API 接続を確認」で `calorie-donate-api (ok)` を確認できます。両方同時に起動する場合は `pnpm dev`。Expo のターミナルで `i`（iOS Simulator）、`a`（Android Emulator）、または対応する Expo Go で QR コードを読み取ります。SDK 57 に対応する Expo Go を使ってください。iOS Simulator には Xcode、Android Emulator には Android Studio / Android SDK が必要です。

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

## API

すべて JSON。エラーは `{ "error": { "code": "...", "message": "..." } }`（`INVALID_REQUEST` 400 / `NOT_FOUND` 404 / `PROFILE_REQUIRED` 409 / `DAY_LOCKED` 409 / `NOT_FOOD` 422 / `ESTIMATION_FAILED` 502 / `INTERNAL_ERROR` 500）。キャッシュなし。

| メソッド           | パス                            | 内容                                                                                      |
| ------------------ | ------------------------------- | ----------------------------------------------------------------------------------------- |
| GET                | `/api/overview?date=`           | 今日の日付、プロフィール（未設定なら `null`）、指定日（既定: 今日）の記録と集計、寄付合計 |
| PUT                | `/api/profile`                  | 目標カロリー・寄付レート・タイムゾーン・ニックネームを保存                                |
| GET                | `/api/days/:date`               | 1日分の集計と食事                                                                         |
| GET                | `/api/history?days=`            | 直近 N 日（最大 90）の集計、新しい順                                                      |
| POST               | `/api/meals`                    | 食事を記録（今日・昨日のみ）                                                              |
| GET / PUT / DELETE | `/api/meals/:id`                | 食事の取得・更新・削除（今日・昨日のみ）                                                  |
| POST               | `/api/meals/estimate`           | 写真からカロリーを推定（保存はしない）                                                    |
| GET                | `/api/donations`                | 寄付台帳と合計                                                                            |
| GET                | `/api/health`, POST `/api/echo` | 接続確認用                                                                                |

両アプリは `@calorie-donate/api` の同じ fetch クライアントを使い、リクエストとレスポンスを Zod で検証します。接続不能、HTTP エラー（エラーコード付き）、不正レスポンス、タイムアウト（通常 10 秒、写真推定は 60 秒）を区別します。

### サーバーの環境変数（`apps/web/.env.local`）

| 変数                      | 既定                  | 内容                                       |
| ------------------------- | --------------------- | ------------------------------------------ |
| `ANTHROPIC_API_KEY`       | なし                  | 設定すると写真推定に Claude を使う         |
| `CALORIE_ESTIMATOR_MODEL` | `claude-opus-5-5`     | 推定に使うモデル                           |
| `CALORIE_ESTIMATOR`       | —                     | `mock` でサンプル推定に固定                |
| `DATABASE_URL`            | なし（PGlite を使用） | PostgreSQL の接続文字列                    |
| `PGLITE_DATA_DIR`         | `.data/pglite`        | PGlite のデータ置き場（`memory://` 可）    |
| `DATABASE_AUTO_MIGRATE`   | `true`                | `false` で起動時のマイグレーションを止める |

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

Vitest は共有クライアント、日付・寄付計算・習慣集計、サービス（確定処理・編集制限・写真・習慣集計・同時書き込み。PGlite で常に、`TEST_DATABASE_URL` があれば実際の PostgreSQL でも）、写真推定（Claude 応答の整形・失敗時の扱い・サンプル推定）を検証します。Playwright はメモリ上の PGlite とサンプル推定でサーバーを起動し、初期設定 → 手入力 → 編集 → 写真推定 → 削除 → 履歴・寄付・設定の一連の流れ、モバイルと同じ絶対 URL クライアントからの実 API 通信、API の入力エラーを検証します。GitHub Actions は frozen install と上記チェックを毎 PR 実行します。

Expo export / 型チェックはネイティブ端末での実行を保証しません。OS のネットワーク制約や実機 LAN 接続の確認は、上記の起動手順で端末を使って行います。ネイティブ配布ビルド、EAS、DB、認証、クラウドリソースは今回の範囲に含めていません。
