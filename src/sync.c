#include <emscripten.h>

typedef struct __attribute__((packed)) {
    int id;
    int start_ms;
    int end_ms;
} SubtitleItem;

EMSCRIPTEN_KEEPALIVE
int find_subtitle_id(const SubtitleItem items[], int count, int current_ms) {
    if (items == NULL || count <= 0) return -1;

    for (int i = 0; i < count; i++) {
        if (current_ms >= items[i].start_ms && current_ms <= items[i].end_ms) {
            return items[i].id;
        }
    }

    return -1; // 該当する字幕がない時間帯（無音など）
}