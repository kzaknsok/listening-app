let subtitlesData = [];
let subtitlesMap = new Map();
let wasmFindSubtitleId = null;
let structBufferPtr = null;

// ループ管理用フラグ
let isLoopRunning = false;

// UI要素
const audio = document.getElementById('audio-player');
const textEn = document.getElementById('text-en');
const textJa = document.getElementById('text-ja');
const langSelect = document.getElementById('lang-select');
const contentSelect = document.getElementById('content-select');

// 📚 利用可能なコンテンツのベース名（拡張子なしのファイル名一覧）
const CONTENT_BASES = [
    "easy_english_01",
    "easy_english_02",
    "easy_english_03"
];

// ファイルパスや文字列から拡張子を除いたベース名を取得するヘルパー関数
function getBaseName(path) {
    const filename = path.split('/').pop(); // パスからファイル名部分を抽出
    return filename.substring(0, filename.lastIndexOf('.')) || filename; // 拡張子を除去
}

// 字幕描画処理
function renderSubtitle() {
    if (!wasmFindSubtitleId || !structBufferPtr || subtitlesData.length === 0) return;

    const currentMs = Math.floor(audio.currentTime * 1000);

    // C言語関数の呼び出し
    const activeId = wasmFindSubtitleId(structBufferPtr, subtitlesData.length, currentMs);

    if (activeId !== -1) {
        const item = subtitlesMap.get(activeId); // MapからO(1)で高速取得
        if (item) {
            const mode = langSelect.value;
            textEn.textContent = (mode === 'both' || mode === 'en') ? item.text : '';
            textJa.textContent = (mode === 'both' || mode === 'ja') ? item.japanese : '';
            return;
        }
    }
    
    textEn.textContent = '';
    textJa.textContent = '';
}

// レンダリングループ（停止しない安全構造）
function animationLoop() {
    if (audio.paused || audio.ended) {
        isLoopRunning = false;
        return;
    }

    renderSubtitle();
    requestAnimationFrame(animationLoop);
}

// ループ開始関数（多重起動を防止）
function startLoop() {
    if (!isLoopRunning) {
        isLoopRunning = true;
        requestAnimationFrame(animationLoop);
    }
}

// 🔄 コンテンツ読み込み処理（ベース名から .mp3 と .json を自動生成）
async function loadContent(baseName) {
    const audioPath = `assets/${baseName}.mp3`;
    const jsonPath  = `assets/${baseName}.json`;

    // 1. 音声を停止してソースを変更
    audio.pause();
    audio.src = audioPath;
    audio.load();

    try {
        // 2. 対応する JSON データを取得
        const response = await fetch(jsonPath);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status} (${jsonPath})`);
        
        subtitlesData = await response.json();
        subtitlesMap.clear();
        subtitlesData.forEach(item => subtitlesMap.set(item.id, item));

        // 3. 古い WASM メモリ領域の解放（メモリリーク防止）
        if (structBufferPtr !== null) {
            Module._free(structBufferPtr);
            structBufferPtr = null;
        }

        // 4. 新しいデータ数に合わせて C 言語領域（12バイト/件）を確保
        const ITEM_SIZE = 12; 
        structBufferPtr = Module._malloc(subtitlesData.length * ITEM_SIZE);

        // 5. C 言語のメモリへ構造体データを展開
        subtitlesData.forEach((item, index) => {
            const offset = structBufferPtr + index * ITEM_SIZE;
            Module.setValue(offset, item.id, 'i32');
            Module.setValue(offset + 4, item.start, 'i32');
            Module.setValue(offset + 8, item.end, 'i32');
        });

        console.log(`Loaded content successfully: ${baseName}`);
        
        // 字幕の初期描画
        renderSubtitle();
    } catch (err) {
        console.error('Failed to load content:', err);
    }
}

// select 要素の option をファイル名ベースで動的に生成する
function populateContentSelect() {
    contentSelect.innerHTML = '';
    CONTENT_BASES.forEach(rawPath => {
        const baseName = getBaseName(rawPath); // 拡張子なしのベース名を取得
        
        const opt = document.createElement('option');
        opt.value = baseName;
        opt.textContent = baseName; // 表示用テキストにも拡張子抜きのベース名を設定
        contentSelect.appendChild(opt);
    });
}

// 初期化処理
const initWasm = async () => {
    try {
        wasmFindSubtitleId = Module.cwrap('find_subtitle_id', 'number', ['pointer', 'number', 'number']);

        // 1. ドロップダウン選択肢の動的生成
        populateContentSelect();

        // 2. 先頭のコンテンツをロード
        if (CONTENT_BASES.length > 0) {
            const firstBase = getBaseName(CONTENT_BASES[0]);
            await loadContent(firstBase);
        }

    } catch (err) {
        console.error('Initialization failed:', err);
    }
};

// 初期化タイミングの安全策
if (typeof Module !== 'undefined' && Module.calledRun) {
    initWasm();
} else {
    Module.onRuntimeInitialized = initWasm;
}

// イベント設定
audio.addEventListener('play', startLoop);
audio.addEventListener('playing', startLoop);
audio.addEventListener('seeked', renderSubtitle);
audio.addEventListener('ratechange', renderSubtitle);
audio.addEventListener('timeupdate', renderSubtitle);

langSelect.addEventListener('change', renderSubtitle);

// コンテンツ切り替えイベント
contentSelect.addEventListener('change', (e) => {
    loadContent(e.target.value);
});