let subtitlesData = [];
let wasmFindSubtitleId = null;
let structBufferPtr = null;

// WASMの初期化完了イベント
Module.onRuntimeInitialized = async () => {
    // C言語関数のバインド
    wasmFindSubtitleId = Module.cwrap('find_subtitle_id', 'number', ['number', 'number', 'number']);

    // JSONデータの読み込み
    const response = await fetch('/assets/script.json');
    subtitlesData = await response.json();

    // C言語の構造体配列（SubtitleItem: int 3つ = 12バイト）用にメモリを確保
    const ITEM_SIZE = 12; 
    structBufferPtr = Module._malloc(subtitlesData.length * ITEM_SIZE);

    // C言語のメモリ領域へデータを書き込み
    subtitlesData.forEach((item, index) => {
        const offset = structBufferPtr + index * ITEM_SIZE;
        Module.setValue(offset, item.id, 'i32');
        Module.setValue(offset + 4, item.start, 'i32');
        Module.setValue(offset + 8, item.end, 'i32');
    });

    console.log('WASM & Subtitle Data Ready');
};

const audio = document.getElementById('audio-player');
const textEn = document.getElementById('text-en');
const textJa = document.getElementById('text-ja');
const langSelect = document.getElementById('lang-select');

// 音声再生に伴う字幕更新処理 (高速なアニメーションフレームで更新)
function updateSubtitle() {
    if (audio.paused || !wasmFindSubtitleId || !structBufferPtr) {
        requestAnimationFrame(updateSubtitle);
        return;
    }

    const currentMs = Math.floor(audio.currentTime * 1000);

    // C言語の関数を呼び出して現在のIDを取得（超高速）
    const activeId = wasmFindSubtitleId(structBufferPtr, subtitlesData.length, currentMs);

    if (activeId !== -1) {
        const item = subtitlesData.find(s => s.id === activeId);
        const mode = langSelect.value;

        textEn.textContent = (mode === 'both' || mode === 'en') ? item.text : '';
        textJa.textContent = (mode === 'both' || mode === 'ja') ? item.japanese : '';
    } else {
        // 空白時間（該当なし）の処理
        textEn.textContent = '';
        textJa.textContent = '';
    }

    requestAnimationFrame(updateSubtitle);
}

audio.addEventListener('play', () => {
    requestAnimationFrame(updateSubtitle);
});