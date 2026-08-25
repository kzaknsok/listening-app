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

// 📜 CIで生成された manifest.json から存在するコンテンツ一覧を取得
async function fetchManifest() {
    try {
        const response = await fetch('manifest.json');
        if (!response.ok) throw new Error('Manifest not found');
        return await response.json();
    } catch (err) {
        console.warn('Failed to load manifest.json, falling back to default.', err);
        return ['easy_english_01']; // フォールバック
    }
}

// ドロップダウンを動的に構築
async function populateContentSelect() {
    contentSelect.innerHTML = '';
    const bases = await fetchManifest();

    bases.forEach(base => {
        const opt = document.createElement('option');
        opt.value = base;
        opt.textContent = base;
        contentSelect.appendChild(opt);
    });

    return bases;
}

// 字幕描画処理
function renderSubtitle() {
    if (!wasmFindSubtitleId || !structBufferPtr || subtitlesData.length === 0) return;

    const currentMs = Math.floor(audio.currentTime * 1000);

    // C言語関数の呼び出し
    const activeId = wasmFindSubtitleId(structBufferPtr, subtitlesData.length, currentMs);

    if (activeId !== -1) {
        const item = subtitlesMap.get(activeId);
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

function startLoop() {
    if (!isLoopRunning) {
        isLoopRunning = true;
        requestAnimationFrame(animationLoop);
    }
}

// 🔄 コンテンツ読み込み処理
async function loadContent(baseName) {
    if (!baseName) return;

    const audioPath = `${baseName}.mp3`;
    const jsonPath  = `${baseName}.json`;

    audio.pause();
    audio.src = audioPath;
    audio.load();

    try {
        const response = await fetch(jsonPath);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status} (${jsonPath})`);
        
        let rawData = await response.json();

        // 1. JSON データの時間単位（秒 vs ミリ秒）を自動判定してミリ秒に補正
        // データ内に小数（0.12など）が含まれるか、数値が極端に小さければ「秒」と判定
        const isSecondsFormat = rawData.some(item => !Number.isInteger(item.start) || item.start < 1000);

        const normalizedData = rawData.map(item => {
            const startMs = isSecondsFormat ? Math.round(Number(item.start) * 1000) : Math.round(Number(item.start));
            const endMs   = isSecondsFormat ? Math.round(Number(item.end) * 1000)   : Math.round(Number(item.end));
            return {
                ...item,
                _startMs: startMs,
                _endMs: endMs
            };
        });

        // 2. start 時間で昇順ソート
        normalizedData.sort((a, b) => a._startMs - b._startMs);

        subtitlesData = normalizedData;
        subtitlesMap.clear();
        subtitlesData.forEach(item => subtitlesMap.set(item.id, item));

        // メモリ解放と再確保
        if (structBufferPtr !== null) {
            Module._free(structBufferPtr);
            structBufferPtr = null;
        }

        const ITEM_SIZE = 12; // int32_t × 3 = 12 bytes
        structBufferPtr = Module._malloc(subtitlesData.length * ITEM_SIZE);

        // 3. ミリ秒に正規化した値を WASM のメモリ領域へ展開
        subtitlesData.forEach((item, index) => {
            const offset = structBufferPtr + index * ITEM_SIZE;
            Module.setValue(offset,     item.id,       'i32');
            Module.setValue(offset + 4, item._startMs, 'i32');
            Module.setValue(offset + 8, item._endMs,   'i32');
        });

        console.log(`Loaded content successfully: ${baseName} (Format: ${isSecondsFormat ? 'Seconds' : 'Milliseconds'})`);
        renderSubtitle();
    } catch (err) {
        console.error('Failed to load content:', err);
        textEn.textContent = 'ファイルの読み込みに失敗しました。';
        textJa.textContent = '';
    }
}

// 初期化処理
const initWasm = async () => {
    try {
        wasmFindSubtitleId = Module.cwrap('find_subtitle_id', 'number', ['pointer', 'number', 'number']);

        const validBases = await populateContentSelect();

        if (validBases.length > 0) {
            await loadContent(validBases[0]);
        } else {
            textEn.textContent = '利用可能なコンテンツがありません。';
            textJa.textContent = '';
        }

    } catch (err) {
        console.error('Initialization failed:', err);
    }
};

// 初期化タイミング
if (typeof Module !== 'undefined' && Module.calledRun) {
    initWasm();
} else {
    Module.onRuntimeInitialized = initWasm;
}

// イベントリスナー
audio.addEventListener('play', startLoop);
audio.addEventListener('playing', startLoop);
audio.addEventListener('seeked', renderSubtitle);
audio.addEventListener('ratechange', renderSubtitle);
audio.addEventListener('timeupdate', renderSubtitle);

langSelect.addEventListener('change', renderSubtitle);

contentSelect.addEventListener('change', (e) => {
    loadContent(e.target.value);
});