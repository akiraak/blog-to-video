# blog-to-video
ブログやニュースの記事を日本語の動画にする

## 準備
プロジェクトのルートディレクトリに `.env` ファイルを作成し、以下の形式でAPIキーとクレデンシャルファイルのパスを設定してください。

```
GOOGLE_APPLICATION_CREDENTIALS="./gcp-key.json"
OPENAI_API_KEY=sk-***
```

gcp-key.json (Google Cloudのサービスアカウントキー) もプロジェクトルートに配置するか、パスを適切に書き換えてください。

## 実行

```bash
node index.js \
  [BLOG-URL] \
  [NAME] \
  "[HEADER-TEXT]" \
  "[TITLE-TEXT]" \
  -i background.png \
  --embed-thumb [THUMB-FILEPATH]
```

[![日本語吹替: Spoorの鳥類モニタリング、関心が急上昇](http://img.youtube.com/vi/UkRe45Yaeok/0.jpg)](https://www.youtube.com/watch?v=UkRe45Yaeok)
