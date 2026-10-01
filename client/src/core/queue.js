export function nextQueueIndex({ queue, queueIndex, repeat, shuffle }, direction = 1, random = Math.random) {
  if (!queue.length) return -1;
  if (repeat === 'one' && direction > 0) return Math.max(queueIndex, 0);
  if (shuffle && queue.length > 1 && direction > 0) {
    const other = Array.from({ length: queue.length }, (_, i) => i).filter(i => i !== queueIndex);
    return other[Math.floor(random() * other.length)];
  }
  const next = queueIndex + direction;
  if (next < 0 || next >= queue.length) return repeat === 'all' ? (next < 0 ? queue.length - 1 : 0) : -1;
  return next;
}

export function appendToQueue(queue, track) {
  if (!track || queue.length >= 500) return queue;
  return [...queue, track];
}

export function pushRecent(recent, track) {
  return [track, ...recent.filter(t => t.id !== track.id)].slice(0, 60);
}
