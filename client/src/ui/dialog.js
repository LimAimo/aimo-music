import { icon } from './icons.js';
import { escapeHtml } from './render.js';

export function showConfirmDialog(title, message, { confirm = '确认', destructive = false } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `<section class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="dialog-head"><h2 id="dialog-title">${escapeHtml(title)}</h2><button type="button" class="icon-button" data-dialog="cancel" aria-label="关闭">${icon('close')}</button></div><p>${escapeHtml(message)}</p><div class="dialog-actions"><button class="button button-ghost" data-dialog="cancel">取消</button><button class="button ${destructive ? 'button-danger' : 'button-primary'}" data-dialog="confirm">${escapeHtml(confirm)}</button></div></section>`;
    const previousFocus = document.activeElement;
    function close(result) { document.removeEventListener('keydown', keydown); overlay.remove(); previousFocus?.focus?.(); resolve(result); }
    function keydown(event) { if (event.key === 'Escape') close(false); if (event.key === 'Tab') { const bs = [...overlay.querySelectorAll('button')]; const index = bs.indexOf(document.activeElement); if (event.shiftKey && index === 0) { bs.at(-1).focus(); event.preventDefault(); } else if (!event.shiftKey && index === bs.length - 1) { bs[0].focus(); event.preventDefault(); } } }
    overlay.addEventListener('click', e => { const btn = e.target.closest('[data-dialog]'); if (btn) close(btn.dataset.dialog === 'confirm'); else if (e.target === overlay) close(false); });
    document.addEventListener('keydown', keydown);
    document.body.append(overlay);
    overlay.querySelector(destructive ? '[data-dialog="cancel"]' : '[data-dialog="confirm"]')?.focus();
  });
}
