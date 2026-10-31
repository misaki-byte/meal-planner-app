# 初心者向け：Supabaseと公開の準備

コードの実装と、ご自身のアカウントで行う初回設定は別の作業です。以下の順に進めると、同じアカウントでスマホとパソコンからデータを共有できます。画面の名称はサービスの更新で多少変わる場合があります。

## 1. まずプルリクエストを確認

1. GitHubの `meal-planner-app` を開き、**Pull requests** から今回の変更を開きます。
2. 説明と **Files changed** を確認します。
3. **Checks** が成功していることを確認します。
4. まだ公開したくない場合は、PRをマージせず、そのままにしておけます。すでにVercelと連携済みの場合、マージで本番デプロイが始まる設定もあるため、公開準備後にマージしてください。

以下はローカルで確認する方法です。GitHubから該当ブランチを取得し、Node.js 22以上を入れたパソコンのターミナルで実行します。

```sh
git clone https://github.com/misaki-byte/meal-planner-app.git
cd meal-planner-app
git switch codex/family-meal-planner
npm ci
```

## 2. Supabaseの無料プロジェクトを作る

1. [Supabase](https://supabase.com/) にサインインします。
2. **New project** を押します。無料プランの組織を選び、名前を `meal-planner-app` などにします。
3. データベースのパスワードを作成し、パスワードマネージャーなどで保管します。このパスワードをアプリやGitHubへ入力する必要はありません。
4. Regionは、選べる場合は日本に近いものを選びます。
5. 作成が終わるまで待ちます。有料プランの選択や有料APIの登録は不要です。

## 3. SQLを実行する

1. GitHubの該当ブランチから `supabase/schema.sql` を開き、全文をコピーします。
2. Supabaseの左メニュー **SQL Editor** → **New query** を開きます。
3. 貼り付けて **Run** を押します。`Success` と表示されれば完了です。
4. **Table Editor** に `planner_data` があることを確認します。RLSはSQLに含まれるので、無効にしないでください。

SQLは新規プロジェクト用です。既存の同名テーブルがないプロジェクトを使ってください。このアプリ以外のテーブルは変更しません。

## 4. URLと公開用キーを設定する

1. Supabaseのプロジェクト **Connect**、または **Project Settings → API / API Keys** を開きます。
2. **Project URL**（`https://...supabase.co`）と **Publishable key**（通常 `sb_publishable_...`）を確認します。旧式のプロジェクトは `anon public` も利用できます。
3. アプリのフォルダで `.env.example` をコピーし、`.env.local` という名前にします。
4. 次の2行の右側だけをご自身の値へ置き換えます。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://あなたのプロジェクトID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=あなたの公開用Publishableキー
```

**Secret key / service_role key は使いません。** `NEXT_PUBLIC_` から始まる値はブラウザに渡ります。公開用キーを使い、アクセス制限はログイン認証とRLSが担当します。実際の `.env.local` はGitの対象外です。

## 5. ログイン認証を設定する

1. Supabaseの **Authentication → Sign In / Providers** で **Email** が有効なことを確認します。
2. メールアドレスの確認（Confirm email）は有効のままを推奨します。
3. **Authentication → URL Configuration** で、ローカル確認時は次を登録します。
   - **Site URL**：`http://localhost:3000`
   - **Redirect URLs**：`http://localhost:3000`
4. 保存します。確認メールやパスワード再設定メールが、このアプリへ戻れるようになります。

無料の標準メール送信には送信数や送信先の制限がある場合があります。初回の確認・再設定メールが届かないときは、SupabaseのAuthログ、迷惑メール、メール送信設定を確認してください。送信先制限が表示される場合は、Supabaseで許可された自分のメールアドレスで確認するか、無料枠のあるSMTPを設定します。

## 6. パソコンで起動する

```sh
npm run dev
```

1. ブラウザで `http://localhost:3000` を開きます。
2. **はじめての方：新規登録** を押します。
3. メールアドレスと8文字以上のパスワードを入力します。
4. 確認メールのリンクを開き、ログインします。
5. 新規アカウントでは、4店舗が登録された空のレシピ帳から始まります。最初のレシピを追加してください。
6. 一度閉じて開き直し、同じアカウントでデータが残っていることを確認します。

`.env.local` を変更したら、ターミナルで `Ctrl+C` を押し、`npm run dev` を実行し直します。接続画面にならない場合は変数名・URL・キーを確認します。

## 7. 内容を確認した後、Vercelで公開する

**ここからは本番公開の操作です。アプリとPRの内容を確認してから実施してください。開発作業中には実行していません。**

1. [Vercel](https://vercel.com/) へGitHubアカウントでサインインし、無料の **Hobby** プランを選びます。
2. **Add New → Project** から `meal-planner-app` をImportします。
3. Framework Presetが **Next.js**、Root Directoryがリポジトリのルートであることを確認します。
4. 本番ブランチは `main` を使用します。今回のPRが確認済みで、mainにマージされていることを確認してください。
5. **Environment Variables** に次を追加します。ローカルと同じ値を使います。
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
6. **Deploy** を押します。これで初めて公開されます。
7. 表示された `https://...vercel.app` のURLを控えます。
8. Supabaseの **Authentication → URL Configuration** を開き、**Site URL** をこの公開URLへ変更し、**Redirect URLs** に同じ公開URLを追加します。localhostはローカル開発用として残せます。
9. 公開URLで新規登録・ログインを確認します。確認メールとパスワード再設定も一度確認してください。

Vercelで環境変数を後から変更した場合は、**Redeploy** が必要です。公開用変数はビルド時に取り込まれます。Previewでログインを試す場合は、そのPreviewのURLもSupabaseのRedirect URLsへ明示的に追加してください。

## 8. スマートフォンで使い始める

1. スマホからVercelの公開URLを開きます。
2. パソコンと同じアカウントでログインします。
3. レシピ・献立・買い物の内容が一致することを確認します。別端末の編集は画面右上の再読込で取得できます。
4. iPhoneはSafariの共有メニューから **ホーム画面に追加**、AndroidはChromeのメニューから **アプリをインストール** または **ホーム画面に追加** を選びます。

ホーム画面起動にはHTTPSの公開URLを使います。買い物リストの表示と保存には通信が必要です。

## 困ったとき

| 状況                     | 確認すること                                                                      |
| ------------------------ | --------------------------------------------------------------------------------- |
| 設定ガイドのまま         | 環境変数2つの名前と値、開発サーバーの再起動／VercelのRedeploy                     |
| ログインできない         | 確認メールを開いたか、メールアドレス・パスワード、Email Provider                  |
| 確認メールが届かない     | 迷惑メール、Authログ、無料メール送信の制限、SMTP設定                              |
| DBの準備を求められる     | SQL全文を実行したか、URLとキーが同じプロジェクトのものか                          |
| 別端末の更新という表示   | 再読込してから、保存できなかった操作をやり直す                                    |
| 長期間使わず接続できない | SupabaseのDashboardで無料プロジェクトが一時停止していないか確認し、必要ならResume |
| スマホと内容が違う       | 同じアカウントと公開URLか確認し、右上から再読込                                   |

保管用の控えとして設定画面の **データを書き出す** も利用できます。データの復元・保守については [運用ガイド](OPERATIONS.md) を参照してください。
