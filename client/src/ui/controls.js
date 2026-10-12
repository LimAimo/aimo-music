/**
 * 全站唯一 N 段式控制器：保持 DOM，不通过重渲染切换选中态。
 * 指示器跟手插值、松手吸附；按钮点击与外部导航均使用同一套 260ms 动画。
 */
export function bindSegmentedControl(root, onSelect, { draggable = true } = {}) {
  if (!root) return () => {};
  const indicator = root.querySelector('.seg-indicator');
  const buttons = [...root.querySelectorAll('.seg-item')];
  if (!indicator || !buttons.length) return () => {};
  let active = buttons.find(button => button.classList.contains('is-active')) || buttons[0];
  let pointer = null;
  let frame = 0;
  let quietFrame = 0;
  let animating = false;
  let motionTimer = 0;
  let suppressClick = false;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  function geometry(button) {
    const rootRect = root.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    return { x: rect.left - rootRect.left, width: rect.width, center: rect.left + rect.width / 2 };
  }
  function syncTextInversion() {
    const slider = indicator.getBoundingClientRect();
    buttons.forEach(button => {
      const text = button.querySelector('.seg-text-invert');
      if (!text) return;
      const rect = button.getBoundingClientRect();
      const start = Math.max(0, slider.left - rect.left);
      const end = Math.min(rect.width, slider.right - rect.left);
      const left = Math.min(100, Math.max(0, start / Math.max(1, rect.width) * 100));
      const right = Math.min(100, Math.max(0, (rect.width - end) / Math.max(1, rect.width) * 100));
      text.style.clipPath = end > start ? `inset(0 ${right}% 0 ${left}%)` : 'inset(0 100% 0 0)';
    });
  }
  function trackAnimation() {
    cancelAnimationFrame(frame);
    if (reducedMotion?.matches) { syncTextInversion(); return; }
    const tick = () => {
      syncTextInversion();
      if (animating) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }
  function place(x, width, animate = true) {
    cancelAnimationFrame(quietFrame);
    if (!animate || reducedMotion?.matches) indicator.classList.add('no-motion');
    else indicator.classList.remove('no-motion');
    indicator.style.transform = `translate3d(${x}px, 0, 0)`;
    indicator.style.width = `${width}px`;
    if (!animate || reducedMotion?.matches) {
      // 几何已同步时，文字裁切可以在当前帧直接计算。
      syncTextInversion();
    } else {
      animating = true;
      trackAnimation();
      clearTimeout(motionTimer);
      motionTimer = setTimeout(stopAnimation, 330);
    }
  }
  function stopAnimation() {
    animating = false;
    cancelAnimationFrame(frame);
    syncTextInversion();
  }
  function update(button, animate = true) {
    const { x, width } = geometry(button);
    place(x, width, animate);
  }
  function setValue(value, { animate = true, notify = false } = {}) {
    const next = buttons.find(button => button.dataset.value === value);
    if (!next) return false;
    const changed = next !== active;
    active = next;
    buttons.forEach(button => {
      const selected = button === next;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    update(next, animate);
    if (changed && notify) onSelect?.(next.dataset.value);
    return changed;
  }
  function updateFromPointer(clientX) {
    const slots = buttons.map(geometry);
    const first = slots[0];
    const last = slots.at(-1);
    if (clientX <= first.center) { place(first.x, first.width, false); return; }
    if (clientX >= last.center) { place(last.x, last.width, false); return; }
    const rightIndex = slots.findIndex(item => clientX <= item.center);
    const left = slots[rightIndex - 1];
    const right = slots[rightIndex];
    const t = Math.max(0, Math.min(1, (clientX - left.center) / (right.center - left.center)));
    place(left.x + (right.x - left.x) * t, left.width + (right.width - left.width) * t, false);
  }
  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const hit = e.target.closest?.('.seg-item');
    if (!hit || !root.contains(hit)) return;
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
  }
  function onPointerMove(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    const dx = e.clientX - pointer.x;
    const dy = e.clientY - pointer.y;
    if (!pointer.dragging) {
      if (Math.abs(dx) < 5 || Math.abs(dy) > Math.abs(dx)) return;
      pointer.dragging = true;
      stopAnimation();
      root.classList.add('is-dragging');
      root.setPointerCapture?.(e.pointerId);
    }
    e.preventDefault();
    updateFromPointer(e.clientX);
  }
  function onPointerUp(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    const wasDragging = pointer.dragging;
    pointer = null;
    root.classList.remove('is-dragging');
    if (!wasDragging) return;
    suppressClick = true;
    // Chromium/Safari 的合成 click 可能在 microtask 之后才发出。
    setTimeout(() => { suppressClick = false; }, 0);
    const nearest = buttons.reduce((best, button) => {
      const distance = Math.abs(geometry(button).center - e.clientX);
      return distance < best.distance ? { button, distance } : best;
    }, { button: active, distance: Infinity }).button;
    setValue(nearest.dataset.value, { notify: true });
    if (root.hasPointerCapture?.(e.pointerId)) root.releasePointerCapture(e.pointerId);
  }
  function onPointerCancel(e) {
    if (!pointer || pointer.id !== e.pointerId) return;
    pointer = null;
    root.classList.remove('is-dragging');
    update(active);
  }
  function onClick(e) {
    if (suppressClick) return;
    const button = e.target.closest?.('.seg-item');
    if (button && root.contains(button)) setValue(button.dataset.value, { notify: true });
  }
  function onKeyDown(e) {
    const currentIndex = buttons.indexOf(active);
    const nextIndex = e.key === 'ArrowRight' ? Math.min(buttons.length - 1, currentIndex + 1)
      : e.key === 'ArrowLeft' ? Math.max(0, currentIndex - 1)
      : e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : -1;
    if (nextIndex < 0) return;
    e.preventDefault();
    setValue(buttons[nextIndex].dataset.value, { notify: true });
    buttons[nextIndex].focus();
  }
  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
      // 避免宽度变化或字体加载打断正在执行的点击动画。
      if (pointer?.dragging || animating) return;
      cancelAnimationFrame(quietFrame);
      quietFrame = requestAnimationFrame(() => update(active, false));
    }) : null;
  observer?.observe(root);
  buttons.forEach(button => observer?.observe(button));
  if (draggable) root.addEventListener('pointerdown', onPointerDown);
  if (draggable) root.addEventListener('pointermove', onPointerMove);
  if (draggable) root.addEventListener('pointerup', onPointerUp);
  if (draggable) root.addEventListener('pointercancel', onPointerCancel);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  indicator.addEventListener('transitionend', stopAnimation);
  setValue(active.dataset.value, { animate: false });
  const cleanup = () => {
    observer?.disconnect();
    clearTimeout(motionTimer);
    cancelAnimationFrame(quietFrame);
    stopAnimation();
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', onPointerUp);
    root.removeEventListener('pointercancel', onPointerCancel);
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKeyDown);
    indicator.removeEventListener('transitionend', stopAnimation);
  };
  cleanup.setValue = setValue;
  return cleanup;
}

export function segmentedMarkup(items, active, className = '') {
  return `<div class="segmented ${className}" role="tablist"><span class="seg-indicator" aria-hidden="true"></span>${items.map(item => `<button type="button" role="tab" class="seg-item ${item.value === active ? 'is-active' : ''}" aria-selected="${item.value === active}" tabindex="${item.value === active ? 0 : -1}" data-value="${item.value}"><span class="seg-label">${item.label}</span><span class="seg-text-invert" aria-hidden="true">${item.label}</span></button>`).join('')}</div>`;
}
