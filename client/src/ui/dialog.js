import { icon } from './icons.js';
import { escapeHtml } from './render.js';

/** 居中 Modal / 手机底部 Sheet，共用进入与退出动画，并保持底部操作按钮可达。 */
export function showConfirmDialog(title, message, { confirm = '确认', destructive = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `<section class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="dialog-head"><h2 id="dialog-title">${escapeHtml(title)}</h2><button type="button" class="icon-button" data-dialog="cancel" aria-label="关闭">${icon('close')}</button></div><p>${escapeHtml(message)}</p><div class="dialog-actions"><button type="button" class="button button-ghost" data-dialog="cancel">取消</button><button type="button" class="button ${destructive ? 'button-danger' : 'button-primary'}" data-dialog="confirm">${escapeHtml(confirm)}</button></div></section>`;
    const previousFocus = document.activeElement;
    let leaving = false;
    document.body.classList.add('modal-open');
    function close(result) {
      if (leaving) return;
      leaving = true;
      overlay.classList.add('is-leaving');
      overlay.querySelectorAll('button').forEach(button => { button.disabled = true; });
      document.removeEventListener('keydown', keydown);
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260;
      setTimeout(() => {
        overlay.remove();
        document.body.classList.remove('modal-open');
        previousFocus?.focus?.({ preventScroll: true });
        resolve(result);
      }, duration);
    }
    function keydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(false); }
      if (event.key !== 'Tab') return;
      const buttons = [...overlay.querySelectorAll('button:not(:disabled)')];
      const index = buttons.indexOf(document.activeElement);
      if (event.shiftKey && index === 0) { buttons.at(-1).focus(); event.preventDefault(); }
      else if (!event.shiftKey && index === buttons.length - 1) { buttons[0].focus(); event.preventDefault(); }
    }
    overlay.addEventListener('click', event => {
      const button = event.target.closest('[data-dialog]');
      if (button) close(button.dataset.dialog === 'confirm');
      else if (event.target === overlay) close(false);
    });
    document.addEventListener('keydown', keydown);
    document.body.append(overlay);
    overlay.querySelector(destructive ? '[data-dialog="cancel"]' : '[data-dialog="confirm"]')?.focus({ preventScroll: true });
  });
}
