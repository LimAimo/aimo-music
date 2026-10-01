/** 共用 N 段式滑块。位置、宽度与选中文字裁切均从真实 DOM 几何计算。 */
export function bindSegmentedControl(root, onSelect) {
  if (!root) return () => {};
  const indicator = root.querySelector('.seg-indicator');
  const buttons = [...root.querySelectorAll('.seg-item')];
  if (!indicator || !buttons.length) return () => {};
  const activeButton = () => buttons.find(button => button.classList.contains('is-active')) || buttons[0];
  function updateIndicator(target, animate = true) {
    if (!target) return;
    const parent = root.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    if (!animate) indicator.classList.add('no-motion');
    indicator.style.transform = `translate3d(${rect.left - parent.left}px, 0, 0)`;
    indicator.style.width = `${rect.width}px`;
    syncTextInversion();
    if (!animate) requestAnimationFrame(() => indicator.classList.remove('no-motion'));
  }
  function syncTextInversion() {
    const slider = indicator.getBoundingClientRect();
    for (const button of buttons) {
      const inverted = button.querySelector('.seg-text-invert');
      if (!inverted) continue;
      const rect = button.getBoundingClientRect();
      const start = Math.max(0, slider.left - rect.left);
      const end = Math.min(rect.width, slider.right - rect.left);
      const left = Math.min(100, Math.max(0, start / Math.max(rect.width, 1) * 100));
      const right = Math.min(100, Math.max(0, (rect.width - end) / Math.max(rect.width, 1) * 100));
      inverted.style.clipPath = end > start ? `inset(0 ${right}% 0 ${left}%)` : 'inset(0 100% 0 0)';
    }
  }
  function select(button) {
    buttons.forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
    updateIndicator(button);
    onSelect?.(button.dataset.value);
  }
  // 尽量避免尺寸变化后丢失实时几何，使用 ResizeObserver 自动校准。
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateIndicator(activeButton(), false)) : null;
  observer?.observe(root);
  buttons.forEach(button => observer?.observe(button));
  let pointer = null;
  const onPointerDown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const hit = e.target.closest('.seg-item');
    if (!hit) return;
    pointer = { id: e.pointerId, startX: e.clientX, dragging: false };
  };
  const onPointerMove = e => {
    if (!pointer || e.pointerId !== pointer.id) return;
    if (!pointer.dragging && Math.abs(e.clientX - pointer.startX) < 7) return;
    pointer.dragging = true;
    root.setPointerCapture?.(e.pointerId);
    const centers = buttons.map(button => button.getBoundingClientRect().left + button.getBoundingClientRect().width / 2);
    const x = e.clientX;
    if (x <= centers[0]) { updateIndicator(buttons[0], false); return; }
    if (x >= centers.at(-1)) { updateIndicator(buttons.at(-1), false); return; }
    let idx = centers.findIndex(center => x <= center);
    idx = Math.max(1, idx);
    const a = buttons[idx - 1].getBoundingClientRect();
    const b = buttons[idx].getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (x - centers[idx - 1]) / (centers[idx] - centers[idx - 1])));
    const parent = root.getBoundingClientRect();
    indicator.classList.add('no-motion');
    indicator.style.transform = `translate3d(${a.left - parent.left + (b.left - a.left) * t}px, 0, 0)`;
    indicator.style.width = `${a.width + (b.width - a.width) * t}px`;
    syncTextInversion();
  };
  const onPointerUp = e => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const dragged = pointer.dragging;
    pointer = null;
    indicator.classList.remove('no-motion');
    if (dragged) {
      e.preventDefault();
      const nearest = buttons.reduce((best, b) => {
        const mid = b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2;
        return Math.abs(mid - e.clientX) < best.d ? { d: Math.abs(mid - e.clientX), button: b } : best;
      }, { d: Infinity, button: activeButton() }).button;
      select(nearest);
      root.dataset.skipClick = '1';
      queueMicrotask(() => { delete root.dataset.skipClick; });
    }
  };
  const onClick = e => {
    if (root.dataset.skipClick) return;
    const button = e.target.closest('.seg-item');
    if (button && root.contains(button)) select(button);
  };
  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', onPointerUp);
  root.addEventListener('click', onClick);
  const onTransition = () => syncTextInversion();
  indicator.addEventListener('transitionrun', () => {
    let frame = 0;
    const tick = () => { syncTextInversion(); if (getComputedStyle(indicator).transitionProperty !== 'none') frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    indicator.addEventListener('transitionend', () => cancelAnimationFrame(frame), { once: true });
  });
  updateIndicator(activeButton(), false);
  return () => {
    observer?.disconnect();
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', onPointerUp);
    root.removeEventListener('pointercancel', onPointerUp);
    root.removeEventListener('click', onClick);
    indicator.removeEventListener('transitionend', onTransition);
  };
}

export function segmentedMarkup(items, active, className = '') {
  return `<div class="segmented ${className}" role="tablist"><span class="seg-indicator" aria-hidden="true"></span>${items.map(item => `<button type="button" role="tab" class="seg-item ${item.value === active ? 'is-active' : ''}" aria-selected="${item.value === active}" data-value="${item.value}"><span class="seg-label">${item.label}</span><span class="seg-text-invert" aria-hidden="true">${item.label}</span></button>`).join('')}</div>`;
}
