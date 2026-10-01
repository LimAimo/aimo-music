/** LRC 解析：多个时间戳、毫秒、offset、翻译对齐及纯文本歌词。 */
export function parseLrc(source = '', translation = '') {
  const main = readLrc(source);
  const trans = readLrc(translation);
  if (!main.length) return [];
  return main.map(line => {
    const matched = trans.find(t => Math.abs(t.time - line.time) < 0.26);
    return { ...line, translation: matched && matched.text !== line.text ? matched.text : '' };
  });
}

export function readLrc(source = '') {
  if (typeof source !== 'string') return [];
  const offset = Number(source.match(/^\[offset:([+-]?\d+)\]/mi)?.[1] || 0) / 1000;
  const rows = [];
  for (const line of source.replace(/\r/g, '').split('\n')) {
    const tags = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!tags.length) continue;
    const text = line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim();
    if (!text) continue;
    for (const tag of tags) {
      const fraction = tag[3] ? Number(tag[3]) / Math.pow(10, tag[3].length) : 0;
      rows.push({ time: Math.max(0, Number(tag[1]) * 60 + Number(tag[2]) + fraction + offset), text });
    }
  }
  return rows.sort((a, b) => a.time - b.time);
}

export function activeLyricIndex(lines, time) {
  let left = 0, right = lines.length - 1, result = -1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (lines[mid].time <= time + 0.04) { result = mid; left = mid + 1; }
    else right = mid - 1;
  }
  return result;
}

export function formatTime(seconds) {
  const v = Math.max(0, Number.isFinite(seconds) ? Math.floor(seconds) : 0);
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
}
