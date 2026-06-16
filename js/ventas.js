/* ═══════════════════════════════════════════════
   BlancoGestión — ventas.js
   Lógica completa de la página Ventas / Salida de Stock
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Estado ── */
  const STATE = {
    page:            1,
    perPage:         20,
    total:           0,
    search:          '',
    statusFilter:    'all',
    selectedProduct: null,  // { id, nombre, precio, stock, unidad }
  };

  const $ = id => document.getElementById(id);

  /* ════════════════════════════════════
     SUMMARY CARDS
  ════════════════════════════════════ */
  async function loadSummary() {
    try {
      const { revenue, units, count } = await BG.getSalesSummary();
      $('summary-revenue').textContent = BG_UI.formatPrice(revenue);
      $('summary-units').textContent   = units.toLocaleString('es-AR');
      $('summary-count').textContent   = count.toLocaleString('es-AR');
    } catch (err) {
      ['summary-revenue','summary-units','summary-count'].forEach(id => {
        $(id).textContent = '—';
      });
    }
  }

  /* ════════════════════════════════════
     PREVIEW TOTAL en tiempo real
  ════════════════════════════════════ */
  function updateTotalPreview() {
    const preview = $('sale-total-preview');
    if (!preview) return;
    if (!STATE.selectedProduct) {
      preview.textContent = '—';
      preview.className = 'text-center py-2 font-mono font-bold text-lg bg-surface-container-low rounded-lg border border-outline-variant text-on-surface-variant';
      return;
    }
    const qty = parseInt($('sale-quantity')?.value, 10) || 0;
    const total = qty * (STATE.selectedProduct.precio || 0);
    preview.textContent = BG_UI.formatPrice(total);
    preview.className = 'text-center py-2 font-mono font-bold text-lg bg-surface-container-low rounded-lg border border-primary text-primary';
  }

  /* ════════════════════════════════════
     TABLA DE VENTAS
  ════════════════════════════════════ */
  function renderSalesTable(rows) {
    const tbody = $('sales-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-on-surface-variant">
        <span class="material-symbols-outlined text-4xl block mx-auto mb-2 text-outline">payments</span>
        No hay ventas registradas aún.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(v => {
      const prod    = v.productos || {};
      const nombre  = prod.nombre  || '—';
      const cat     = prod.categoria || '';
      const estado  = v.estado === 'completed' ? 'Completado' : 'Pendiente';
      const badgeCls= v.estado === 'completed'
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800';

      return `
      <tr class="transition-colors hover:bg-surface-container-low/50">
        <td class="px-6 py-3">
          <p class="font-bold text-body-md">${BG_UI.esc(nombre)}</p>
          <p class="text-xs text-on-surface-variant">${BG_UI.esc(cat)}</p>
        </td>
        <td class="px-6 py-3 font-mono text-body-md text-on-surface-variant">#${v.id}</td>
        <td class="px-6 py-3 text-body-md font-bold font-mono">${v.cantidad ?? '—'}</td>
        <td class="px-6 py-3 font-mono text-body-md text-on-surface-variant">${BG_UI.formatPrice(v.precio_unitario)}</td>
        <td class="px-6 py-3 font-mono text-body-md font-bold">${BG_UI.formatPrice(v.total)}</td>
        <td class="px-6 py-3 text-xs text-on-surface-variant">${BG_UI.formatDate(v.created_at)}</td>
        <td class="px-6 py-3">
          <span class="text-xs font-bold px-2 py-1 rounded-full ${badgeCls}">${estado}</span>
          ${v.detalle ? `<p class="text-xs text-on-surface-variant mt-1 truncate max-w-[130px]" title="${BG_UI.esc(v.detalle)}">${BG_UI.esc(v.detalle)}</p>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  async function loadSales() {
    $('sales-tbody').innerHTML = `<tr><td colspan="7" class="text-center py-10">
      <span class="spinner" style="border-color:#e0e0e0;border-top-color:#000;width:28px;height:28px;border-width:3px;margin:0 auto;display:block"></span>
    </td></tr>`;

    try {
      const { data, count } = await BG.getSales({
        search:  STATE.search,
        status:  STATE.statusFilter,
        page:    STATE.page,
        perPage: STATE.perPage,
      });
      STATE.total = count;
      renderSalesTable(data);
      updateSalesPagination();
    } catch (err) {
      BG_UI.toast('Error cargando ventas: ' + err.message, 'error');
      $('sales-tbody').innerHTML = `<tr><td colspan="7" class="text-center py-8 text-error">Error: ${BG_UI.esc(err.message)}</td></tr>`;
    }
  }

  function updateSalesPagination() {
    const totalPages = Math.ceil(STATE.total / STATE.perPage) || 1;
    const from = ((STATE.page - 1) * STATE.perPage) + 1;
    const to   = Math.min(STATE.page * STATE.perPage, STATE.total);

    const info = $('sales-pagination-info');
    if (info) info.textContent = STATE.total
      ? `Mostrando ${from}–${to} de ${STATE.total}`
      : 'Sin ventas';

    const prev = $('sales-prev');
    const next = $('sales-next');
    if (prev) prev.disabled = STATE.page <= 1;
    if (next) next.disabled = STATE.page >= totalPages;
  }

  /* ════════════════════════════════════
     AUTOCOMPLETE DE PRODUCTO
  ════════════════════════════════════ */
  function showSuggestions(products) {
    const container = $('sale-product-suggestions');
    if (!products.length) {
      container.innerHTML = `<div class="px-4 py-3 text-on-surface-variant text-sm">Sin resultados para esa búsqueda.</div>`;
      container.classList.remove('hidden');
      return;
    }

    container.innerHTML = products.map(p => {
      const { cls, label } = BG_UI.stockBadge(p.stock);
      const stockInfo = p.stock === 0
        ? `<span class="text-xs badge-out px-1.5 rounded font-bold">SIN STOCK</span>`
        : `<span class="text-xs text-on-surface-variant">${p.stock} en stock</span>`;

      return `
      <div class="px-4 py-3 hover:bg-surface-container-low cursor-pointer flex items-center justify-between gap-2"
           onclick="VentasPage.selectProduct(${p.id}, ${JSON.stringify(p.nombre)}, ${p.precio || 0}, ${p.stock}, ${JSON.stringify(p.unidad_venta || 'unidad')})">
        <div>
          <p class="font-bold text-sm">${BG_UI.esc(p.nombre)}</p>
          <p class="text-xs text-on-surface-variant">${BG_UI.esc(p.categoria || '')}</p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="font-mono text-sm font-bold">${BG_UI.formatPrice(p.precio)}</p>
          ${stockInfo}
        </div>
      </div>`;
    }).join('');

    container.classList.remove('hidden');
  }

  function hideSuggestions() {
    setTimeout(() => $('sale-product-suggestions')?.classList.add('hidden'), 200);
  }

  function selectProduct(id, nombre, precio, stock, unidad) {
    STATE.selectedProduct = { id, nombre, precio, stock, unidad };

    const input = $('sale-product-search');
    if (input) input.value = nombre;

    const info = $('sale-product-info');
    if (info) {
      const { cls, label } = BG_UI.stockBadge(stock);
      info.innerHTML = `
        <span class="material-symbols-outlined text-sm text-green-700">check_circle</span>
        <span class="font-bold text-sm">${BG_UI.esc(nombre)}</span>
        <span class="text-on-surface-variant text-xs">·</span>
        <span class="font-mono text-sm font-bold">${BG_UI.formatPrice(precio)}</span>
        <span class="text-on-surface-variant text-xs">·</span>
        <span class="text-xs ${cls} px-1.5 rounded font-bold">${label} (${stock} uds.)</span>`;
      info.classList.remove('hidden');
    }

    $('sale-product-suggestions')?.classList.add('hidden');
    updateTotalPreview();
    $('sale-quantity')?.select();
    $('sale-quantity')?.focus();
  }

  /* ════════════════════════════════════
     REGISTRAR VENTA
  ════════════════════════════════════ */
  async function registerSale(e) {
    e.preventDefault();

    if (!STATE.selectedProduct) {
      BG_UI.toast('Seleccioná un producto de la lista.', 'warning');
      $('sale-product-search')?.focus();
      return;
    }

    const cantidad = parseInt($('sale-quantity')?.value, 10);
    if (!cantidad || cantidad < 1) {
      BG_UI.toast('La cantidad debe ser al menos 1.', 'warning');
      $('sale-quantity')?.focus();
      return;
    }

    if (cantidad > STATE.selectedProduct.stock) {
      BG_UI.toast(
        `Stock insuficiente. Disponible: ${STATE.selectedProduct.stock} unidades.`,
        'error'
      );
      $('sale-quantity')?.focus();
      return;
    }

    const detalle = $('sale-detalle')?.value.trim() || '';

    const btn = $('btn-register-sale');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></span> Registrando...`;

    try {
      await BG.registerSale(
        STATE.selectedProduct.id,
        cantidad,
        STATE.selectedProduct.precio || 0,
        detalle
      );

      const total = BG_UI.formatPrice(cantidad * (STATE.selectedProduct.precio || 0));
      BG_UI.toast(
        `✓ Venta registrada: ${cantidad}× ${STATE.selectedProduct.nombre} — ${total}`,
        'success',
        5000
      );

      resetSaleForm();
      await Promise.all([loadSales(), loadSummary()]);

    } catch (err) {
      BG_UI.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined">inventory_2</span> Registrar Venta / Salida de Stock`;
    }
  }

  function resetSaleForm() {
    STATE.selectedProduct = null;
    const input = $('sale-product-search');
    if (input) input.value = '';
    const qty = $('sale-quantity');
    if (qty) qty.value = 1;
    const det = $('sale-detalle');
    if (det) det.value = '';
    const info = $('sale-product-info');
    if (info) { info.innerHTML = ''; info.classList.add('hidden'); }
    updateTotalPreview();
  }

  /* ════════════════════════════════════
     EXPORTAR CSV
  ════════════════════════════════════ */
  async function exportSales() {
    try {
      const { data } = await BG.getSales({ status: STATE.statusFilter, perPage: 9999 });
      const rows = data.map(v => ({
        ID:            v.id,
        Fecha:         BG_UI.formatDate(v.created_at),
        Producto:      v.productos?.nombre || '—',
        Categoria:     v.productos?.categoria || '—',
        Cantidad:      v.cantidad,
        'Precio Unit': v.precio_unitario,
        Total:         v.total,
        Estado:        v.estado,
        Detalle:       v.detalle || '',
      }));
      BG_UI.exportCSV(rows, `ventas_${new Date().toISOString().slice(0,10)}.csv`);
    } catch (err) {
      BG_UI.toast('Error exportando: ' + err.message, 'error');
    }
  }

  /* ════════════════════════════════════
     INIT
  ════════════════════════════════════ */
  function init() {
    /* ── Formulario de venta ── */
    $('sale-form')?.addEventListener('submit', registerSale);

    /* ── Preview total al cambiar cantidad ── */
    $('sale-quantity')?.addEventListener('input', updateTotalPreview);

    /* ── Autocomplete búsqueda de producto ── */
    const searchInput = $('sale-product-search');
    searchInput?.addEventListener('input', BG_UI.debounce(async e => {
      const term = e.target.value.trim();
      if (term.length < 2) {
        $('sale-product-suggestions')?.classList.add('hidden');
        if (!term) resetSaleForm();
        return;
      }
      try {
        const products = await BG.searchProductsForSale(term);
        showSuggestions(products);
      } catch (err) {
        console.warn('Error buscando productos:', err);
      }
    }, 300));

    searchInput?.addEventListener('blur', hideSuggestions);
    searchInput?.addEventListener('keydown', e => {
      if (e.key === 'Escape') $('sale-product-suggestions')?.classList.add('hidden');
    });

    /* ── Búsqueda en historial (desktop) ── */
    $('sales-search')?.addEventListener('input', BG_UI.debounce(e => {
      STATE.search = e.target.value.trim();
      STATE.page   = 1;
      loadSales();
    }));

    /* ── Búsqueda en historial (mobile) ── */
    $('sales-search-mobile')?.addEventListener('input', BG_UI.debounce(e => {
      STATE.search = e.target.value.trim();
      STATE.page   = 1;
      loadSales();
    }));

    /* ── Filtros de estado ── */
    document.querySelectorAll('[data-status-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-status-filter]').forEach(b => {
          b.classList.remove('bg-primary', 'text-white', 'font-bold');
          b.classList.add('text-on-surface-variant');
        });
        btn.classList.add('bg-primary', 'text-white', 'font-bold');
        btn.classList.remove('text-on-surface-variant');
        STATE.statusFilter = btn.dataset.statusFilter;
        STATE.page = 1;
        loadSales();
      });
    });

    /* ── Paginación ── */
    $('sales-prev')?.addEventListener('click', () => {
      if (STATE.page > 1) { STATE.page--; loadSales(); }
    });
    $('sales-next')?.addEventListener('click', () => {
      const totalPages = Math.ceil(STATE.total / STATE.perPage);
      if (STATE.page < totalPages) { STATE.page++; loadSales(); }
    });

    /* ── Exportar ── */
    $('btn-export-sales')?.addEventListener('click', exportSales);

    /* ── Init data ── */
    loadSummary();
    loadSales();
  }

  /* Exponer para onclick inline (autocomplete dropdown) */
  window.VentasPage = { selectProduct };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
