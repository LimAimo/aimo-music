import { trackIdentity } from '../api/providers.js';
/** 单曲循环只拦截自然播放结束；手动下一首不受单曲循环影响。 */
export function nextQueueIndex({ queue, queueIndex, repeat, shuffle }, direction = 1, random = Math.random, reason = 'manual') {
  if (!queue.length) return -1;
  if (reason === 'ended' && repeat === 'one') return Math.max(queueIndex, 0);
  if (shuffle && queue.length > 1 && direction > 0) {
    const other = Array.from({ length: queue.length }, (_, i) => i).filter(i => i !== queueIndex);
    return other[Math.min(other.length - 1, Math.floor(random() * other.length))];
  }
  const next = queueIndex + direction;
  if (next < 0 || next >= queue.length) return repeat === 'all' ? (next < 0 ? queue.length - 1 : 0) : -1;
  return next;
}

/** 一轮不重复的随机顺序，支持真正的历史上一首/下一首。只保存索引，不持久化临时顺序。 */
export class ShuffleHistory {
  constructor(random = Math.random) { this.random = random; this.reset([], -1); }
  reset(queue, currentIndex) {
    this.length = queue.length;
    this.history = currentIndex >= 0 && currentIndex < queue.length ? [currentIndex] : [];
    this.position = this.history.length - 1;
    this.remaining = Array.from({ length: queue.length }, (_, i) => i).filter(i => i !== currentIndex);
  }
  next(repeat = 'off') {
    if (this.position < this.history.length - 1) return this.history[++this.position];
    if (!this.length) return -1;
    if (!this.remaining.length) {
      if (repeat !== 'all') return -1;
      const current = this.history[this.position];
      this.remaining = Array.from({ length: this.length }, (_, i) => i).filter(i => i !== current);
      if (!this.remaining.length) return current;
    }
    const position = Math.min(this.remaining.length - 1, Math.floor(this.random() * this.remaining.length));
    const [index] = this.remaining.splice(position, 1);
    this.history = this.history.slice(0, this.position + 1);
    this.history.push(index);
    this.position++;
    return index;
  }
  previous() { return this.position > 0 ? this.history[--this.position] : -1; }
}

export function appendToQueue(queue, track) {
  if (!track) return queue;
  return [...queue, track];
}

export function pushRecent(recent, track) {
  return [track, ...recent.filter(t => trackIdentity(t) !== trackIdentity(track))].slice(0, 60);
}
