/* ═══════════════════════════════════════════════
   BlancoGestión — stock.js
   Lógica completa de la página Gestión de Stock
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Estado ── */
  const STATE = {
    page:        1,
    perPage:     20,
    total:       0,
    search:      '',
    stockFilter: 'all',
    editingId:   null,
    uploadedUrl: null,
    // Ajuste de stock
    adjustId:      null,
    adjustCurrent: 0,
    adjustType:    'add',  // 'add' | 'sub'
  };

  const $ = id => document.getElementById(id);

  /* ════════════════════════════════════
     RENDER TABLA
  ════════════════════════════════════ */
  function renderTable(rows) {
    const tbody = $('products-tbody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-on-surface-variant">
        <span class="material-symbols-outlined text-4xl block mx-auto mb-2 text-outline">inventory_2</span>
        No hay productos que coincidan.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(p => {
      const { cls, label } = BG_UI.stockBadge(p.stock);
      const img = p.imagen_url
        ? `<img src="${BG_UI.esc(p.imagen_url)}" class="w-10 h-10 object-cover rounded-lg border border-outline-variant img-gray" alt=""/>`
        : `<div class="w-10 h-10 rounded-lg border border-outline-variant bg-surface-container flex items-center justify-center"><span class="material-symbols-outlined text-sm text-outline">imagesmode</span></div>`;

      return `
      <tr data-id="${p.id}" class="transition-colors hover:bg-surface-container-low/50">
        <td class="px-6 py-3">
          <div class="flex items-center gap-3">
            ${img}
            <div>
              <p class="font-bold text-body-md">${BG_UI.esc(p.nombre)}</p>
              <p class="text-xs text-on-surface-variant truncate max-w-[180px]">${BG_UI.esc(p.descripcion || '')}</p>
            </div>
          </div>
        </td>
        <td class="px-6 py-3 text-on-surface-variant text-body-md">${BG_UI.esc(p.categoria || '—')}</td>
        <td class="px-6 py-3 font-mono text-body-md">
          <span class="flex items-center gap-2">
            <span class="font-bold text-lg ${p.stock === 0 ? 'text-error' : p.stock <= 10 ? 'text-yellow-700' : ''}">${p.stock ?? 0}</span>
            <span class="text-xs ${cls} px-1.5 py-0.5 rounded font-bold">${label}</span>
          </span>
        </td>
        <td class="px-6 py-3 font-mono text-body-md font-bold">${BG_UI.formatPrice(p.precio)}</td>
        <td class="px-6 py-3 text-xs text-on-surface-variant">${BG_UI.esc(p.unidad_venta || 'unidad')}</td>
        <td class="px-6 py-3 text-xs text-on-surface-variant">${BG_UI.formatDate(p.created_at)}</td>
        <td class="px-6 py-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <button onclick="StockPage.editProduct(${p.id})"
              class="p-1.5 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface-variant"
              title="Editar producto">
              <span class="material-symbols-outlined text-base">edit</span>
            </button>
            <button onclick="StockPage.adjustStock(${p.id}, '${BG_UI.esc(p.nombre)}', ${p.stock})"
              class="p-1.5 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface-variant"
              title="Ajustar stock">
              <span class="material-symbols-outlined text-base">tune</span>
            </button>
            <button onclick="StockPage.deleteProduct(${p.id}, '${BG_UI.esc(p.nombre)}')"
              class="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-error"
              title="Desactivar producto">
              <span class="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  /* ════════════════════════════════════
     LOAD PRODUCTS
  ════════════════════════════════════ */
  async function loadProducts() {
    const spinner = $('table-spinner');
    if (spinner) spinner.classList.remove('hidden');

    try {
      const { data, count } = await BG.getProducts({
        search:      STATE.search,
        stockFilter: STATE.stockFilter,
        page:        STATE.page,
        perPage:     STATE.perPage,
      });

      STATE.total = count;
      renderTable(data);
      updatePagination();
    } catch (err) {
      BG_UI.toast('Error cargando productos: ' + err.message, 'error');
    } finally {
      if (spinner) spinner.classList.add('hidden');
    }
  }

  /* ════════════════════════════════════
     PAGINACIÓN
  ════════════════════════════════════ */
  function updatePagination() {
    const totalPages = Math.ceil(STATE.total / STATE.perPage) || 1;
    const from = ((STATE.page - 1) * STATE.perPage) + 1;
    const to   = Math.min(STATE.page * STATE.perPage, STATE.total);

    const info = $('pagination-info');
    if (info) info.textContent = STATE.total
      ? `Mostrando ${from}–${to} de ${STATE.total} productos`
      : 'Sin resultados';

    const count = $('products-count');
    if (count) count.textContent = `Pág. ${STATE.page}/${totalPages}`;

    const prev = $('pagination-prev');
    const next = $('pagination-next');
    if (prev) prev.disabled = STATE.page <= 1;
    if (next) next.disabled = STATE.page >= totalPages;
  }

  /* ════════════════════════════════════
     MODAL NUEVO / EDITAR PRODUCTO
  ════════════════════════════════════ */
  function openNewProduct() {
    STATE.editingId   = null;
    STATE.uploadedUrl = null;
    $('modal-title').textContent = 'Nuevo Producto';
    $('product-form').reset();
    clearImagePreview();
    BG_UI.openModal('modal-overlay');
  }

  async function editProduct(id) {
    try {
      const { data, error } = await BG.db.from('productos').select('*').eq('id', id).single();
      if (error || !data) throw new Error('Producto no encontrado');

      STATE.editingId   = id;
      STATE.uploadedUrl = data.imagen_url || null;
      $('modal-title').textContent = 'Editar Producto';

      // Rellenar campos
      if ($('field-name'))        $('field-name').value        = data.nombre      || '';
      if ($('field-category'))    $('field-category').value    = data.categoria   || 'Baño';
      if ($('field-stock'))       $('field-stock').value       = data.stock       ?? 0;
      if ($('field-price-sale'))  $('field-price-sale').value  = data.precio      ?? '';
      if ($('field-description')) $('field-description').value = data.descripcion || '';
      if ($('field-unit'))        $('field-unit').value        = data.unidad_venta || 'unidad';

      // Preview imagen
      if (data.imagen_url) showImagePreview(data.imagen_url);

      BG_UI.openModal('modal-overlay');
    } catch (err) {
      BG_UI.toast('Error al cargar producto: ' + err.message, 'error');
    }
  }

  async function saveProduct() {
    const nombre = $('field-name')?.value.trim();
    if (!nombre) {
      BG_UI.toast('El nombre del producto es requerido.', 'warning');
      $('field-name')?.focus();
      return;
    }

    const btn = $('modal-save-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px"></span> Guardando...`;

    try {
      const payload = {
        nombre,
        categoria:    $('field-category')?.value   || 'Otro',
        stock:        parseInt($('field-stock')?.value, 10) || 0,
        precio:       parseFloat($('field-price-sale')?.value) || null,
        descripcion:  $('field-description')?.value.trim() || null,
        imagen_url:   STATE.uploadedUrl || null,
        unidad_venta: $('field-unit')?.value || 'unidad',
      };

      // Quitar nulls para no pissar datos en edición
      Object.keys(payload).forEach(k => {
        if (payload[k] === null || payload[k] === undefined || payload[k] === '') {
          if (STATE.editingId) {
            // En edición conservamos los nulls para poder borrar el valor
          } else {
            delete payload[k];
          }
        }
      });

      await BG.saveProduct(payload, STATE.editingId);
      BG_UI.toast(
        STATE.editingId ? '✓ Producto actualizado correctamente.' : '✓ Producto creado correctamente.',
        'success'
      );
      BG_UI.closeModal('modal-overlay');
      loadProducts();
    } catch (err) {
      BG_UI.toast('Error al guardar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar Producto';
    }
  }

  /* ════════════════════════════════════
     MODAL AJUSTE DE STOCK
  ════════════════════════════════════ */
  function adjustStock(id, nombre, currentStock) {
    STATE.adjustId      = id;
    STATE.adjustCurrent = currentStock;
    STATE.adjustType    = 'add';

    $('adjust-product-name').textContent    = nombre;
    $('adjust-current-stock').textContent   = currentStock;
    $('adjust-quantity').value              = 1;
    $('adjust-reason').value                = '';
    updateAdjustPreview();

    // Reset botones tipo
    setAdjustType('add');

    BG_UI.openModal('modal-adjust-overlay');
    setTimeout(() => $('adjust-quantity')?.focus(), 200);
  }

  function setAdjustType(type) {
    STATE.adjustType = type;
    const btnAdd = $('adjust-type-add');
    const btnSub = $('adjust-type-sub');

    if (type === 'add') {
      btnAdd.className = 'py-2 border-2 border-primary bg-primary text-on-primary rounded-lg font-bold text-sm flex items-center justify-center gap-xs transition-all';
      btnSub.className = 'py-2 border-2 border-outline-variant text-on-surface-variant rounded-lg font-bold text-sm flex items-center justify-center gap-xs transition-all hover:border-primary';
    } else {
      btnSub.className = 'py-2 border-2 border-error bg-error text-white rounded-lg font-bold text-sm flex items-center justify-center gap-xs transition-all';
      btnAdd.className = 'py-2 border-2 border-outline-variant text-on-surface-variant rounded-lg font-bold text-sm flex items-center justify-center gap-xs transition-all hover:border-primary';
    }
    updateAdjustPreview();
  }

  function updateAdjustPreview() {
    const qty = parseInt($('adjust-quantity')?.value, 10) || 0;
    const delta = STATE.adjustType === 'add' ? qty : -qty;
    const result = STATE.adjustCurrent + delta;
    const preview = $('adjust-result-preview');
    if (!preview) return;
    preview.textContent = result < 0 ? '⚠ Negativo' : result;
    preview.className = `font-bold font-mono text-lg ${result < 0 ? 'text-error' : result === 0 ? 'text-yellow-700' : 'text-green-700'}`;
  }

  async function confirmAdjust() {
    const qty = parseInt($('adjust-quantity')?.value, 10);
    if (!qty || qty < 1) {
      BG_UI.toast('Ingresá una cantidad válida.', 'warning');
      return;
    }

    const delta = STATE.adjustType === 'add' ? qty : -qty;
    const result = STATE.adjustCurrent + delta;
    if (result < 0) {
      BG_UI.toast(`Stock insuficiente. Disponible: ${STATE.adjustCurrent} unidades.`, 'error');
      return;
    }

    const btn = $('adjust-confirm-btn');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      await BG.updateStock(STATE.adjustId, delta);
      const nombre = $('adjust-product-name').textContent;
      const accion = STATE.adjustType === 'add' ? 'sumaron' : 'restaron';
      BG_UI.toast(`✓ Se ${accion} ${qty} unidades de "${nombre}". Stock actual: ${result}`, 'success', 5000);
      BG_UI.closeModal('modal-adjust-overlay');
      loadProducts();
    } catch (err) {
      BG_UI.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirmar';
    }
  }

  /* ════════════════════════════════════
     ELIMINAR PRODUCTO
  ════════════════════════════════════ */
  function deleteProduct(id, nombre) {
    if (!confirm(`¿Desactivar "${nombre}"?\nEl producto no se eliminará de la base de datos.`)) return;
    BG.deleteProduct(id)
      .then(() => {
        BG_UI.toast(`"${nombre}" desactivado correctamente.`, 'success');
        loadProducts();
      })
      .catch(err => BG_UI.toast(err.message, 'error'));
  }

  /* ════════════════════════════════════
     UPLOAD DE IMAGEN
  ════════════════════════════════════ */
  function showImagePreview(url) {
    const preview = $('upload-preview');
    if (!preview) return;
    preview.innerHTML = `
      <div class="relative inline-block mt-2">
        <img src="${BG_UI.esc(url)}" class="h-24 w-24 object-cover rounded-lg border border-outline-variant"/>
        <button type="button" onclick="StockPage.clearImage()"
          class="absolute -top-2 -right-2 w-6 h-6 bg-error text-white rounded-full text-xs flex items-center justify-center shadow">✕</button>
      </div>`;
  }

  function clearImagePreview() {
    const preview = $('upload-preview');
    if (preview) preview.innerHTML = '';
    STATE.uploadedUrl = null;
  }

  function clearImage() {
    clearImagePreview();
    const input = $('upload-input');
    if (input) input.value = '';
  }

  async function handleImageUpload(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      BG_UI.toast('La imagen supera los 5MB.', 'warning');
      return;
    }

    const zone = $('upload-zone');
    const pEl  = zone?.querySelector('p');
    const orig = pEl?.textContent;
    if (pEl) pEl.textContent = 'Subiendo imagen...';

    try {
      const url = await BG.uploadProductImage(file);
      STATE.uploadedUrl = url;
      showImagePreview(url);
      BG_UI.toast('Imagen subida correctamente.', 'success');
    } catch (err) {
      BG_UI.toast('Error subiendo imagen: ' + err.message, 'error');
    } finally {
      if (pEl && orig) pEl.textContent = orig;
    }
  }

  /* ════════════════════════════════════
     EXPORTAR CSV
  ════════════════════════════════════ */
  async function exportCSV() {
    try {
      const { data } = await BG.getProducts({
        stockFilter: STATE.stockFilter,
        search:      STATE.search,
        perPage:     9999,
      });
      const rows = data.map(p => ({
        ID:         p.id,
        Nombre:     p.nombre,
        Categoria:  p.categoria,
        Stock:      p.stock,
        Precio:     p.precio,
        Unidad:     p.unidad_venta,
        Descripcion:p.descripcion || '',
      }));
      BG_UI.exportCSV(rows, `stock_${new Date().toISOString().slice(0,10)}.csv`);
    } catch (err) {
      BG_UI.toast('Error exportando: ' + err.message, 'error');
    }
  }

  /* ════════════════════════════════════
     INIT
  ════════════════════════════════════ */
  function init() {
    /* ── Nuevo producto ── */
    $('btn-new-product')?.addEventListener('click', openNewProduct);

    /* ── Modal producto: cerrar ── */
    $('modal-close-btn')?.addEventListener('click',  () => BG_UI.closeModal('modal-overlay'));
    $('modal-cancel-btn')?.addEventListener('click', () => BG_UI.closeModal('modal-overlay'));
    $('modal-overlay')?.addEventListener('click', e => {
      if (e.target === $('modal-overlay')) BG_UI.closeModal('modal-overlay');
    });

    /* ── Guardar producto ── */
    $('modal-save-btn')?.addEventListener('click', saveProduct);
    $('product-form')?.addEventListener('submit', e => { e.preventDefault(); saveProduct(); });

    /* ── Modal ajuste: tipo ── */
    $('adjust-type-add')?.addEventListener('click', () => setAdjustType('add'));
    $('adjust-type-sub')?.addEventListener('click', () => setAdjustType('sub'));
    $('adjust-quantity')?.addEventListener('input',  updateAdjustPreview);
    $('adjust-confirm-btn')?.addEventListener('click', confirmAdjust);
    $('modal-adjust-overlay')?.addEventListener('click', e => {
      if (e.target === $('modal-adjust-overlay')) BG_UI.closeModal('modal-adjust-overlay');
    });

    /* ── Search desktop ── */
    $('search-input')?.addEventListener('input', BG_UI.debounce(e => {
      STATE.search = e.target.value.trim();
      STATE.page   = 1;
      loadProducts();
    }));

    /* ── Search mobile ── */
    $('search-input-mobile')?.addEventListener('input', BG_UI.debounce(e => {
      STATE.search = e.target.value.trim();
      STATE.page   = 1;
      loadProducts();
    }));

    /* ── Filtros de stock ── */
    document.querySelectorAll('[data-stock-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-stock-filter]').forEach(b => {
          b.classList.remove('bg-primary', 'text-on-primary', 'font-bold');
          b.classList.add('text-on-surface-variant');
        });
        btn.classList.add('bg-primary', 'text-on-primary', 'font-bold');
        btn.classList.remove('text-on-surface-variant');
        STATE.stockFilter = btn.dataset.stockFilter;
        STATE.page = 1;
        loadProducts();
      });
    });

    /* ── Paginación ── */
    $('pagination-prev')?.addEventListener('click', () => {
      if (STATE.page > 1) { STATE.page--; loadProducts(); }
    });
    $('pagination-next')?.addEventListener('click', () => {
      const totalPages = Math.ceil(STATE.total / STATE.perPage);
      if (STATE.page < totalPages) { STATE.page++; loadProducts(); }
    });

    /* ── Exportar ── */
    $('btn-export')?.addEventListener('click', exportCSV);

    /* ── Upload imagen ── */
    const uploadZone  = $('upload-zone');
    const uploadInput = $('upload-input');
    uploadZone?.addEventListener('click', () => uploadInput?.click());
    uploadInput?.addEventListener('change', e => handleImageUpload(e.target.files[0]));
    uploadZone?.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone?.addEventListener('drop', e => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      handleImageUpload(e.dataTransfer.files[0]);
    });

    /* ── Auto-apply URL filter param (ej: desde index "filtro=low") ── */
    const urlParams = new URLSearchParams(window.location.search);
    const filterParam = urlParams.get('filter');
    if (filterParam) {
      const btn = document.querySelector(`[data-stock-filter="${filterParam}"]`);
      if (btn) btn.click();
    }

    /* ── Cargar datos ── */
    loadProducts();
  }

  /* Exponer para botones inline del DOM */
  window.StockPage = { editProduct, adjustStock, deleteProduct, clearImage };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
