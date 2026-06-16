/* ═══════════════════════════════════════════════
   BlancoGestión — main.js
   Utilidades UI compartidas
   Namespace global: window.BG_UI
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ════════════════════════════════════
     TOAST
  ════════════════════════════════════ */
  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:18px;flex-shrink:0">${icons[type] || 'info'}</span>
      <span>${message}</span>
    `;
    container.appendChild(el);

    setTimeout(() => {
      el.style.animation = 'toast-out 0.25s ease forwards';
      setTimeout(() => el.remove(), 260);
    }, duration);
  }

  /* ════════════════════════════════════
     SIDEBAR TOGGLE (mobile)
  ════════════════════════════════════ */
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    let overlay   = document.getElementById('sidebar-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebar-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', toggleSidebar);
    }

    if (sidebar) sidebar.classList.toggle('open');
    overlay.classList.toggle('visible');
  }

  /* ════════════════════════════════════
     MODAL
  ════════════════════════════════════ */
  function openModal(overlayId) {
    const overlay = document.getElementById(overlayId || 'modal-overlay');
    if (!overlay) return;
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(overlayId) {
    const overlay = document.getElementById(overlayId || 'modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  /* ════════════════════════════════════
     STOCK BADGE
  ════════════════════════════════════ */
  function stockBadge(stock, reorderPoint = 10) {
    if (stock === 0)              return { cls: 'badge-out',  label: 'SIN STOCK' };
    if (stock <= (reorderPoint || 10)) return { cls: 'badge-low',  label: 'BAJO' };
    return                               { cls: 'badge-ok',   label: 'OK' };
  }

  /* ════════════════════════════════════
     FORMAT HELPERS
  ════════════════════════════════════ */
  function formatPrice(value) {
    if (value == null || value === '') return '—';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', minimumFractionDigits: 0
    }).format(value);
  }

  function formatDate(isoString) {
    if (!isoString) return '—';
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(isoString));
  }

  function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ════════════════════════════════════
     EXPORT CSV
  ════════════════════════════════════ */
  function exportCSV(rows, filename = 'export.csv') {
    if (!rows || !rows.length) { toast('No hay datos para exportar.', 'warning'); return; }
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const val = r[h] ?? '';
        const str = String(val).replace(/"/g, '""');
        return /[,"\n]/.test(str) ? `"${str}"` : str;
      }).join(','))
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast('CSV exportado correctamente.', 'success');
  }

  /* ════════════════════════════════════
     DEBOUNCE
  ════════════════════════════════════ */
  function debounce(fn, ms = 350) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /* ── Exportar namespace BG_UI ── */
  window.BG_UI = {
    toast,
    toggleSidebar,
    openModal,
    closeModal,
    stockBadge,
    formatPrice,
    formatDate,
    esc,
    exportCSV,
    debounce,
  };

})();
