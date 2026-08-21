let subtitlesData = [];
let subtitlesMap = new Map();
let wasmFindSubtitleId = null;
let structBufferPtr = null;
let isLoopRunning = false;

// UI要素
const audio = document.getElementById('audio-player');
const textEn = document.getElementById('text-en');
const textJa = document.getElementById('text-ja');
const langSelect = document.getElementById('lang-select');
const contentSelect = document.getElementById('content-select');

// 📚 コンテンツ定義一覧（ファイルパスを環境に合わせて変更してください）
const CONTENTS = {
    lesson1: {
        audio: 'audio/easy_english_01.mp3',
        json: 'data/script_01.json'
    },
    lesson2: {
        audio: 'audio/easy_english_02.mp3',
        json: 'data/script_02.json'
    },
    lesson3: {
        audio: 'audio/easy_english_03.mp3',
        json: 'data/script_03.json'
    }
};

// 字幕描画処理
function renderSubtitle() {
    if (!wasmFindSubtitleId || !structBufferPtr || subtitlesData.length === 0) return;

    // 音声の現在位置（ミリ秒）を取得
    const currentMs = Math.floor(audio.currentTime * 1000);

    // C言語関数（WASM）の呼び出し
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

// レンダリングループ
function animationLoop() {
    if (audio.paused || audio.ended) {
        isLoopRunning = false;
        return;
    }

    renderSubtitle();
    requestAnimationFrame(animationLoop);
}

// ループ開始関数（多重起動防止）
function startLoop() {
    if (!isLoopRunning) {
        isLoopRunning = true;
        requestAnimationFrame(animationLoop);
    }
}

// 🔄 コンテンツの動的読み込み処理
async function loadContent(contentKey) {
    const target = CONTENTS[contentKey];
    if (!target) return;

    // 1. 音声を停止してソースを差し替え
    audio.pause();
    audio.src = target.audio;
    audio.load();

    try {
        // 2. 新しい JSON データの取得
        const response = await fetch(target.json);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
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

        console.log(`Content loaded successfully: ${contentKey}`);
        
        // 字幕表示の即時更新
        renderSubtitle();
    } catch (err) {
        console.error('Failed to load content:', err);
    }
}

// WASM 初期化処理
const initWasm = async () => {
    try {
        wasmFindSubtitleId = Module.cwrap('find_subtitle_id', 'number', ['pointer', 'number', 'number']);

        // 初期選択されているコンテンツを読み込む
        await loadContent(contentSelect.value);

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

// イベントリスナーの設定
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