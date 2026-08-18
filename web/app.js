let subtitlesData = [];
let subtitlesMap = new Map();
let wasmFindSubtitleId = null;
let structBufferPtr = null;

const audio = document.getElementById('audio-player');
const textEn = document.getElementById('text-en');
const textJa = document.getElementById('text-ja');
const langSelect = document.getElementById('lang-select');

// ループ管理用フラグ
let isLoopRunning = false;

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

// 初期化処理
const initWasm = async () => {
    try {
        wasmFindSubtitleId = Module.cwrap('find_subtitle_id', 'number', ['pointer', 'number', 'number']);

        const response = await fetch('script.json');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        subtitlesData = await response.json();
        subtitlesMap.clear();
        subtitlesData.forEach(item => subtitlesMap.set(item.id, item));

        // C言語の構造体領域（12バイト/件）確保
        const ITEM_SIZE = 12; 
        structBufferPtr = Module._malloc(subtitlesData.length * ITEM_SIZE);

        subtitlesData.forEach((item, index) => {
            const offset = structBufferPtr + index * ITEM_SIZE;
            Module.setValue(offset, item.id, 'i32');
            Module.setValue(offset + 4, item.start, 'i32');
            Module.setValue(offset + 8, item.end, 'i32');
        });

        console.log('WASM & Subtitle Data Ready');
        renderSubtitle();
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
audio.addEventListener('playing', startLoop); // 再開時や速度変更後の追従を強化
audio.addEventListener('seeked', renderSubtitle);
audio.addEventListener('ratechange', renderSubtitle); // 速度変更時にも即座に反映
audio.addEventListener('timeupdate', renderSubtitle); // 保険用（万が一ループが停止してもフォールバック）
langSelect.addEventListener('change', renderSubtitle);