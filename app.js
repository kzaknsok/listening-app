let subtitlesData = [];
let wasmFindSubtitleId = null;
let structBufferPtr = null;

const audio = document.getElementById('audio-player');
const textEn = document.getElementById('text-en');
const textJa = document.getElementById('text-ja');
const langSelect = document.getElementById('lang-select');

// 字幕更新処理
function renderSubtitle() {
    if (!wasmFindSubtitleId || !structBufferPtr || subtitlesData.length === 0) return;

    const currentMs = Math.floor(audio.currentTime * 1000);

    // C言語の関数を呼び出して現在のIDを取得 ('pointer' 型で渡す)
    const activeId = wasmFindSubtitleId(structBufferPtr, subtitlesData.length, currentMs);

    if (activeId !== -1) {
        const item = subtitlesData.find(s => s.id === activeId);
        if (item) {
            const mode = langSelect.value;
            textEn.textContent = (mode === 'both' || mode === 'en') ? item.text : '';
            textJa.textContent = (mode === 'both' || mode === 'ja') ? item.japanese : '';
            return;
        }
    }
    
    // 空白時間（該当なし）の処理
    textEn.textContent = '';
    textJa.textContent = '';
}

// WASMの初期化完了イベント
Module.onRuntimeInitialized = async () => {
    try {
        // C言語関数のバインド (第1引数は pointer に修正)
        wasmFindSubtitleId = Module.cwrap('find_subtitle_id', 'number', ['pointer', 'number', 'number']);

        // JSONデータの読み込み
        const response = await fetch('script.json');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
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
        renderSubtitle(); // 初期描画
    } catch (err) {
        console.error('Initialization failed:', err);
    }
};

// イベントリスナーの設定（再生中・停止中の位置変更・言語切替に対応）
audio.addEventListener('timeupdate', renderSubtitle);
langSelect.addEventListener('change', renderSubtitle);