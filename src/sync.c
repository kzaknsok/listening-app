#include <emscripten.h>

// __attribute__((packed)) を追加して、強制的に12バイト（4*3）で固定
typedef struct __attribute__((packed)) {
    int id;
    int start_ms;
    int end_ms;
} SubtitleItem;

EMSCRIPTEN_KEEPALIVE
int find_subtitle_id(const SubtitleItem items[], int count, int current_ms) {
    int low = 0;
    int high = count - 1;

    while (low <= high) {
        int mid = low + (high - low) / 2;

        if (current_ms >= items[mid].start_ms && current_ms <= items[mid].end_ms) {
            return items[mid].id;
        }
        if (current_ms < items[mid].start_ms) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    return -1;
}