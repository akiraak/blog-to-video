#!/usr/bin/env node

const { program } = require('commander');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = util.promisify(exec);

// 日時フォーマット関数
function getFormattedDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${y}${m}${d}-${h}${min}${s}`;
}

program
  .name('blog-to-video')
  .description('ブログ記事から解説動画を自動生成するCLIツール')
  .argument('<url>', 'ブログ記事のURL')
  .argument('<name>', 'プロジェクト名（出力フォルダ名に使用）')
  .argument('<header>', '画像の上部に表示するヘッダー文字')
  .argument('<title>', '画像の中央に表示する記事タイトル')
  // 背景画像 (必須)
  .requiredOption('-i, --image <path>', '背景画像のファイルパス (必須)')
  // 埋め込み画像 (任意)
  .option('--embed-thumb <path>', '右側に埋め込む画像のパス')
  // ★追加: タイトル調整オプション
  .option('--title-size <number>', 'タイトルの文字サイズ')
  .option('--title-offset-y <number>', 'タイトルの上下位置調整')
  .option('--title-line-spacing <number>', 'タイトルの行間調整 (例: -30)') // ★ここを追加
  .action(async (url, name, header, title, options) => {
    try {
      const timestamp = getFormattedDate();
      
      // 出力先設定
      const baseOutputDir = path.join(__dirname, 'outputs', name);
      if (!fs.existsSync(baseOutputDir)) fs.mkdirSync(baseOutputDir, { recursive: true });

      // ファイルパス定義
      const imagePath = path.join(baseOutputDir, `screen-${timestamp}.png`);

      // === 背景画像の処理 ===
      const bgImagePath = path.resolve(process.cwd(), options.image);
      if (!fs.existsSync(bgImagePath) && !bgImagePath.includes(':')) {
        throw new Error(`指定された背景画像が見つかりません: ${bgImagePath}`);
      }

      // === オプション引数の構築 ===
      let extraArgs = '';

      // 埋め込み画像
      if (options.embedThumb) {
        const thumbPath = path.resolve(process.cwd(), options.embedThumb);
        if (!fs.existsSync(thumbPath)) {
          throw new Error(`指定された埋め込み画像が見つかりません: ${thumbPath}`);
        }
        console.log(`🖼️  埋め込み画像: ${thumbPath}`);
        extraArgs += ` --embed-thumb "${thumbPath}"`;
      }

      // タイトルサイズ
      if (options.titleSize) {
        extraArgs += ` --title-size ${options.titleSize}`;
      }

      // タイトル位置 (Y)
      if (options.titleOffsetY) {
        extraArgs += ` --title-offset-y ${options.titleOffsetY}`;
      }

      // ★追加: タイトル行間
      if (options.titleLineSpacing) {
        extraArgs += ` --title-line-spacing ${options.titleLineSpacing}`;
      }

      console.log(`🚀 プロジェクト "${name}" の処理を開始します...`);
      console.log(`📂 出力先: ${baseOutputDir}`);
      console.log(`🖼️  背景画像: ${bgImagePath}`);

      // ---------------------------------------------------------
      // Step 1: text-on-image (画像生成)
      // ---------------------------------------------------------
      console.log('\n[1/3] 🖼️  タイトル画像を生成中 (text-on-image)...');
      
      // コマンド構築
      const command = `text-on-image -i "${bgImagePath}" --header "${header}" --title "${title}" ${extraArgs} --output "${imagePath}"`;
      
      await execAsync(command);
      console.log(`  ✅ 画像生成完了: ${path.basename(imagePath)}`);
      
      console.log('\n✨ 処理が完了しました！');

    } catch (error) {
      console.error('\n❌ エラーが発生しました:');
      console.error(error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);