/* ═══════════════════════════════════════════════
   BlancoGestión — cart.js
   Carrito de consulta (no es checkout real, arma
   un único mensaje de WhatsApp con todo el pedido)
   Namespace global: window.BG_CART
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  const WA_NUMBER  = '5493364193123';
  const STORAGE_KEY = 'bg_cart_v1';

  let items = {}; // { [productId]: { id, nombre, precio, imagen_url, stock, cantidad } }

  /* ════════════════════════════════════
     PERSISTENCIA
  ════════════════════════════════════ */
  function load() {
    try {
      items = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      items = {};
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  /* ════════════════════════════════════
     MUTACIONES
  ════════════════════════════════════ */

  /**
   * Agrega cantidad de un producto al carrito, clampeando contra el stock.
   * Devuelve la cantidad final que quedó en el carrito para ese producto.
   */
  function add(product, qty) {
    const existing = items[product.id];
    const current   = existing ? existing.cantidad : 0;
    const wanted    = current + Math.max(1, parseInt(qty, 10) || 1);
    const finalQty  = Math.min(wanted, product.stock);

    items[product.id] = {
      id:         product.id,
      nombre:     product.nombre,
      precio:     product.precio,
      imagen_url: product.imagen_url,
      stock:      product.stock,
      cantidad:   finalQty,
    };

    persist();
    render();
    return finalQty;
  }

  function setQty(id, qty) {
    const item = items[id];
    if (!item) return;
    const clamped = Math.max(1, Math.min(parseInt(qty, 10) || 1, item.stock));
    item.cantidad = clamped;
    persist();
    render();
  }

  function remove(id) {
    delete items[id];
    persist();
    render();
  }

  function clear() {
    items = {};
    persist();
    render();
  }

  /* ════════════════════════════════════
     LECTURA
  ════════════════════════════════════ */
  function getItems()  { return Object.values(items); }
  function getCount()  { return getItems().reduce((s, i) => s + i.cantidad, 0); }
  function getTotal()  { return getItems().reduce((s, i) => s + i.cantidad * (i.precio || 0), 0); }

  function buildWhatsAppMessage() {
    const list = getItems();
    if (!list.length) return '';

    const lineas = list.map(i => `• ${i.cantidad}x ${i.nombre}`).join('\n');
    const total  = BG_UI.formatPrice(getTotal());

    const msg = `¡Hola! Quiero consultar por este pedido:\n\n${lineas}\n\nTotal estimado: ${total}\n¿Cómo seguimos?`;
    return msg;
  }

  function sendOrder() {
    const msg = buildWhatsAppMessage();
    if (!msg) {
      BG_UI.toast('El carrito está vacío.', 'warning');
      return;
    }
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  /* ════════════════════════════════════
     RENDER
  ════════════════════════════════════ */
  function render() {
    renderBadge();
    renderDrawer();
  }

  function renderBadge() {
    const badge = document.getElementById('cart-badge');
    const fab   = document.getElementById('cart-fab');
    if (!badge || !fab) return;
    const count = getCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
    fab.style.display = count > 0 ? '' : 'none';
  }

  function renderDrawer() {
    const list  = document.getElementById('cart-items');
    const empty = document.getElementById('cart-empty');
    const footer = document.getElementById('cart-footer');
    if (!list) return;

    const data = getItems();

    if (!data.length) {
      list.innerHTML = '';
      if (empty)  empty.style.display = '';
      if (footer) footer.style.display = 'none';
      return;
    }

    if (empty)  empty.style.display = 'none';
    if (footer) footer.style.display = '';

    list.innerHTML = data.map(i => {
      const img = i.imagen_url
        ? `<img src="${BG_UI.esc(i.imagen_url)}" class="w-12 h-12 object-cover rounded-lg flex-shrink-0"/>`
        : `<div class="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0"><span class="material-symbols-outlined text-outline text-lg">imagesmode</span></div>`;
      return `
        <div class="flex items-center gap-sm py-sm border-b border-outline-variant" data-cart-item="${i.id}">
          ${img}
          <div class="flex-1 min-w-0">
            <p class="font-bold text-sm truncate">${BG_UI.esc(i.nombre)}</p>
            <p class="text-xs text-on-surface-variant font-mono">${BG_UI.formatPrice(i.precio)} c/u</p>
          </div>
          <div class="flex items-center gap-xs flex-shrink-0">
            <button data-cart-decr="${i.id}" class="w-6 h-6 flex items-center justify-center border border-outline-variant rounded hover:bg-surface-container-low text-sm">−</button>
            <span class="w-6 text-center font-mono text-sm">${i.cantidad}</span>
            <button data-cart-incr="${i.id}" class="w-6 h-6 flex items-center justify-center border border-outline-variant rounded hover:bg-surface-container-low text-sm">+</button>
          </div>
          <button data-cart-remove="${i.id}" class="p-1 text-on-surface-variant hover:text-error flex-shrink-0">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>`;
    }).join('');

    const totalEl = document.getElementById('cart-total');
    if (totalEl) totalEl.textContent = BG_UI.formatPrice(getTotal());
  }

  /* ════════════════════════════════════
     EVENTOS DELEGADOS (drawer)
  ════════════════════════════════════ */
  function bindDrawerEvents() {
    const list = document.getElementById('cart-items');
    if (!list) return;
    list.addEventListener('click', (e) => {
      const incr = e.target.closest('[data-cart-incr]');
      const decr = e.target.closest('[data-cart-decr]');
      const rm   = e.target.closest('[data-cart-remove]');
      if (incr) {
        const id = incr.getAttribute('data-cart-incr');
        const item = items[id];
        if (!item) return;
        if (item.cantidad >= item.stock) {
          BG_UI.toast(`No hay más stock disponible de "${item.nombre}".`, 'warning');
          return;
        }
        setQty(id, item.cantidad + 1);
      } else if (decr) {
        const id = decr.getAttribute('data-cart-decr');
        const next = (items[id]?.cantidad || 0) - 1;
        if (next < 1) remove(id); else setQty(id, next);
      } else if (rm) {
        remove(rm.getAttribute('data-cart-remove'));
      }
    });
  }

  /* ════════════════════════════════════
     INIT
  ════════════════════════════════════ */
  function init() {
    load();
    bindDrawerEvents();
    render();
  }

   // Agrega esto antes de window.BG_CART = {...}
async function payWithMP() {
  const list = getItems();
  if (!list.length) {
    BG_UI.toast('El carrito está vacío.', 'warning');
    return;
  }

  try {
    BG_UI.toast('Redirigiendo a Mercado Pago...', 'success');

    const response = await fetch('/api/create-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: list }),
    });

    const data = await response.json();

    if (!response.ok || !data.init_point) {
      BG_UI.toast('Error al iniciar el pago. Intentá de nuevo.', 'warning');
      return;
    }

    window.location.href = data.init_point;

  } catch (err) {
    console.error(err);
    BG_UI.toast('Error de conexión. Intentá de nuevo.', 'warning');
  }
}
   
  /* ── Exportar namespace BG_CART ── */
  window.BG_CART = {
    init,
    add,
    setQty,
    remove,
    clear,
    getItems,
    getCount,
    getTotal,
    buildWhatsAppMessage,
    sendOrder,
    payWithMP,
    render,
  };

})();
