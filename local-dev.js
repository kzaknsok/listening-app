// Test File
let subtitlesData = [];

const audio = document.getElementById('audio-player');
const textEn = document.getElementById('text-en');
const textJa = document.getElementById('text-ja');
const langSelect = document.getElementById('lang-select');

// JSON読み込み
async function init() {
    try {
        const response = await fetch('assets/script.json');
        subtitlesData = await response.json();
        console.log('[Local Dev] 字幕データを読み込みました:', subtitlesData.length, '件');
    } catch (err) {
        console.error('[Local Dev] script.json の読み込みに失敗しました:', err);
    }
}

// C言語(WASM)側の二分探索ロジックをJavaScriptで完全再現
function findSubtitleIdJS(items, currentMs) {
    let low = 0;
    let high = items.length - 1;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const item = items[mid];

        if (currentMs >= item.start && currentMs <= item.end) {
            return item.id;
        }
        if (currentMs < item.start) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }
    return -1;
}

// 描画更新ルーティン
function updateSubtitle() {
    if (audio.paused || subtitlesData.length === 0) {
        requestAnimationFrame(updateSubtitle);
        return;
    }

    const currentMs = Math.floor(audio.currentTime * 1000);
    const activeId = findSubtitleIdJS(subtitlesData, currentMs);

    if (activeId !== -1) {
        const item = subtitlesData.find(s => s.id === activeId);
        const mode = langSelect.value;

        textEn.textContent = (mode === 'both' || mode === 'en') ? item.text : '';
        textJa.textContent = (mode === 'both' || mode === 'ja') ? item.japanese : '';
    } else {
        textEn.textContent = '';
        textJa.textContent = '';
    }

    requestAnimationFrame(updateSubtitle);
}

audio.addEventListener('play', () => {
    requestAnimationFrame(updateSubtitle);
});

init();