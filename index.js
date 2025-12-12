#!/usr/bin/env node

const { program } = require('commander');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

/**
 * コマンドを実行し、リアルタイムでログを表示しつつ、
 * 完了後に全出力を文字列として返す関数
 */
function runCommandWithOutput(commandStr) {
  return new Promise((resolve, reject) => {
    // shell: true で実行
    const child = spawn(commandStr, { shell: true });

    let allStdout = '';
    let allStderr = '';

    // 標準出力
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
      allStdout += data.toString();
    });

    // 標準エラー出力
    child.stderr.on('data', (data) => {
      process.stderr.write(data);
      allStderr += data.toString();
    });

    // 終了処理
    child.on('close', (code) => {
      if (code === 0) {
        resolve(allStdout);
      } else {
        const err = new Error(`Command failed with exit code ${code}`);
        err.stderr = allStderr;
        reject(err);
      }
    });
    
    child.on('error', (err) => reject(err));
  });
}

program
  .name('blog-to-video')
  .description('ブログ記事から解説動画を自動生成するCLIツール')
  .argument('<url>', 'ブログ記事のURL')
  .argument('<name>', 'プロジェクト名（出力フォルダ名に使用）')
  .argument('<header>', 'ヘッダー文字')
  .argument('<title>', '記事タイトル')
  .requiredOption('-i, --image <path>', '背景画像 (必須)')
  .option('--embed-thumb <path>', '埋め込み画像')
  .option('--title-size <number>', 'タイトル文字サイズ')
  .option('--title-offset-y <number>', 'タイトル位置調整')
  .option('--title-line-spacing <number>', 'タイトル行間調整')
  .option('--tts <type>', 'TTSエンジン (google | openai)', 'google')
  .option('--debug', 'デバッグモード (途中経過ファイルの保存など)')
  // ★追加: image-only オプション
  .option('--image-only', '画像生成のみを実行し、音声生成と動画結合をスキップする')
  .action(async (url, name, header, title, options) => {
    try {
      const timestamp = getFormattedDate();
      
      // === ディレクトリとパスの設定 ===
      const baseOutputDir = path.join(__dirname, 'outputs', name);
      
      let debugDir = null;
      if (options.debug) {
        debugDir = path.join(baseOutputDir, `debug_${timestamp}`);
        if (!fs.existsSync(baseOutputDir)) fs.mkdirSync(baseOutputDir, { recursive: true });
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      } else {
        if (!fs.existsSync(baseOutputDir)) fs.mkdirSync(baseOutputDir, { recursive: true });
      }

      // 各ファイルのパス定義
      const imagePath = path.join(baseOutputDir, `screen-${timestamp}.png`);
      const videoPath = path.join(baseOutputDir, `video-${timestamp}.mp4`);
      
      // 音声ファイルとテキストファイルの出力パス
      const audioPath = path.join(baseOutputDir, `dub-${timestamp}.mp3`);
      const textPath = path.join(baseOutputDir, `script-${timestamp}.txt`);

      // === 背景画像のパス解決 ===
      const bgImagePath = path.resolve(process.cwd(), options.image);
      if (!fs.existsSync(bgImagePath) && !bgImagePath.includes(':')) {
        throw new Error(`指定された背景画像が見つかりません: ${bgImagePath}`);
      }

      console.log(`🚀 プロジェクト "${name}" の処理を開始します...`);
      console.log(`📂 出力先: ${baseOutputDir}`);
      if (options.debug) {
        console.log(`🐞 Debug Mode: ON (${debugDir})`);
      }
      if (options.imageOnly) {
        console.log(`🖼️  Image Only Mode: ON (音声生成と動画結合はスキップされます)`);
      }

      // =========================================================
      // Step 1: text-on-image (画像生成)
      // =========================================================
      // image-onlyモードの場合はステップ表示を変更
      const step1Label = options.imageOnly ? '[1/1]' : '[1/3]';
      console.log(`\n${step1Label} 🖼️  タイトル画像を生成中 (text-on-image)...`);
      
      let imgExtraArgs = '';
      if (options.embedThumb) imgExtraArgs += ` --embed-thumb "${path.resolve(process.cwd(), options.embedThumb)}"`;
      if (options.titleSize) imgExtraArgs += ` --title-size ${options.titleSize}`;
      if (options.titleOffsetY) imgExtraArgs += ` --title-offset-y ${options.titleOffsetY}`;
      if (options.titleLineSpacing) imgExtraArgs += ` --title-line-spacing ${options.titleLineSpacing}`;

      await runCommandWithOutput(
        `text-on-image -i "${bgImagePath}" --header "${header}" --title "${title}" ${imgExtraArgs} --output "${imagePath}"`
      );
      console.log(`  ✅ 画像生成完了: ${path.basename(imagePath)}`);

      // ★追加: image-only が指定されていたらここで終了
      if (options.imageOnly) {
        console.log(`\n✨ 画像生成のみ完了しました！`);
        return; // 処理を終了
      }

      // =========================================================
      // Step 2: blog-dub-ja (音声生成)
      // =========================================================
      console.log('\n[2/3] 🎙️  ブログ記事から音声を生成中 (blog-dub-ja)...');
      
      const ttsType = options.tts || 'google';

      let dubCmd = `blog-dub-ja "${url}" -o "${name}" --tts ${ttsType} --mp3-output "${audioPath}" --txt-output "${textPath}"`;
      
      if (options.debug && debugDir) {
        dubCmd += ` -d "${debugDir}"`;
      }
      
      console.log(`  Running: ${dubCmd}`);
      
      // 実行
      await runCommandWithOutput(dubCmd);
      
      // 指定したパスにファイルができているか確認
      if (!fs.existsSync(audioPath)) {
        throw new Error('音声ファイルが生成されていません。blog-dub-ja のログを確認してください。');
      }

      console.log(`  ✅ 音声生成完了: ${path.basename(audioPath)}`);
      console.log(`  📝 テキスト保存: ${path.basename(textPath)}`);


      // =========================================================
      // Step 3: audio-to-video (動画結合)
      // =========================================================
      console.log('\n[3/3] 🎬 音声と画像を結合中 (audio-to-video)...');

      // 指定したパスを使って動画結合 (audio-to-video は -a が音声入力)
      const videoCmd = `audio-to-video -i "${imagePath}" -a "${audioPath}" -o "${videoPath}"`;
      
      console.log(`  Running: ${videoCmd}`);
      
      await runCommandWithOutput(videoCmd);
      
      console.log(`\n✨ 全ての処理が完了しました！`);
      console.log(`🎥 動画ファイル: ${videoPath}`);

    } catch (error) {
      console.error('\n❌ エラーが発生しました:');
      if (error.stderr) {
        console.error('--- stderr ---');
        console.error(error.stderr);
      }
      console.error(error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);