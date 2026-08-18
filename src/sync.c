#include <emscripten.h>

typedef struct {
    int id;
    int start_ms;
    int end_ms;
} SubtitleItem;

EMSCRIPTEN_KEEPALIVE
int find_subtitle_id(SubtitleItem items[], int count, int current_ms) {
    int low = 0;
    int high = count - 1;

    while (low <= high) {
        int mid = low + (high - low) / 2;

        if (current_ms >= items[mid].start_ms && current_ms <= items[mid].end_ms) {
            return items[mid].id; // 該当するIDを返却
        }
        if (current_ms < items[mid].start_ms) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    return -1; // 空白時間（該当字幕なし）
}