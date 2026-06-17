/* ═══════════════════════════════════════════════
   BlancoGestión — supabase.js
   Cliente Supabase + todas las funciones de datos
   Namespace global: window.BG
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Credenciales desde env-config.js o fallback ──
  const SUPABASE_URL = 'https://uroatkbpzaabxncrbfyn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyb2F0a2JwemFhYnhuY3JiZnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjI4ODQsImV4cCI6MjA5NzE5ODg4NH0.nL1PLn-gFv4wM75acEKL-q2cr2-5-LRzKbX86QC8stg';
  // ── Inicializar cliente ──
  const { createClient } = window.supabase;
  const db = createClient(SUPABASE_URL, SUPABASE_KEY);

  /* ════════════════════════════════════
     PRODUCTOS
  ════════════════════════════════════ */

  /**
   * Obtener lista de productos con filtros opcionales.
   * @param {object} opts - { search, category, stockFilter, page, perPage }
   */
  async function getProducts(opts = {}) {
    const { search = '', category = '', stockFilter = 'all', page = 1, perPage = 25 } = opts;

    let query = db.from('productos').select('*', { count: 'exact' }).eq('activo', true);

    if (search) {
      query = query.or(`nombre.ilike.%${search}%,descripcion.ilike.%${search}%,categoria.ilike.%${search}%`);
    }
    if (category) {
      query = query.eq('categoria', category);
    }
    if (stockFilter === 'low') {
      query = query.gt('stock', 0).lte('stock', 10);
    } else if (stockFilter === 'out') {
      query = query.eq('stock', 0);
    }

    const from = (page - 1) * perPage;
    query = query.order('nombre', { ascending: true }).range(from, from + perPage - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data || [], count: count || 0 };
  }

  /**
   * Lista de categorías distintas entre los productos activos, para poblar
   * el filtro del catálogo público. Se deduplica en el cliente porque
   * Supabase REST no expone DISTINCT directo sin una función RPC.
   */
  async function getCategories() {
    const { data, error } = await db
      .from('productos')
      .select('categoria')
      .eq('activo', true)
      .not('categoria', 'is', null);
    if (error) throw error;
    const unique = [...new Set(data.map(p => p.categoria).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b, 'es'));
  }

  /**
   * Buscar productos por nombre/descripción para el autocomplete de ventas.
   */
  async function searchProductsForSale(term) {
    const { data, error } = await db
      .from('productos')
      .select('id, nombre, categoria, precio, stock, imagen_url, unidad_venta')
      .eq('activo', true)
      .or(`nombre.ilike.%${term}%,categoria.ilike.%${term}%`)
      .order('nombre', { ascending: true })
      .limit(10);
    if (error) throw error;
    return data || [];
  }

  /**
   * Guardar producto nuevo o editar existente.
   * El objeto debe coincidir con las columnas de la tabla productos.
   */
  async function saveProduct(payload, id = null) {
    // Mapear campos del formulario a columnas reales de la tabla
    const row = {
      nombre:      payload.nombre      ?? null,
      descripcion: payload.descripcion ?? null,
      categoria:   payload.categoria   ?? null,
      precio:      payload.precio      ?? null,
      stock:       payload.stock       ?? 0,
      imagen_url:  payload.imagen_url  ?? null,
      unidad_venta:payload.unidad_venta ?? 'unidad',
      activo:      true,
    };

    if (id) {
      const { data, error } = await db.from('productos').update(row).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await db.from('productos').insert(row).select().single();
      if (error) throw error;
      return data;
    }
  }

  /**
   * Actualizar sólo el stock de un producto (delta positivo o negativo).
   */
  async function updateStock(id, delta) {
    // Primero obtenemos stock actual para validar
    const { data: prod, error: e1 } = await db
      .from('productos').select('stock, nombre').eq('id', id).single();
    if (e1) throw e1;

    const newStock = (prod.stock || 0) + delta;
    if (newStock < 0) throw new Error(`Stock insuficiente para "${prod.nombre}" (disponible: ${prod.stock})`);

    const { data, error } = await db
      .from('productos').update({ stock: newStock }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  /**
   * Desactivar producto (soft delete).
   */
  async function deleteProduct(id) {
    const { error } = await db.from('productos').update({ activo: false }).eq('id', id);
    if (error) throw error;
  }

  /* ════════════════════════════════════
     VENTAS  (tabla: ventas)
     Si no existe, la creamos con RPC o la ignoramos gracefully.
  ════════════════════════════════════ */

  /**
   * Registrar una venta. Descuenta stock automáticamente.
   */
  async function registerSale(productoId, cantidad, precioUnitario, detalle = '') {
    // 1. Descontar stock
    await updateStock(productoId, -cantidad);

    // 2. Insertar en tabla ventas
    const total = cantidad * precioUnitario;
    const { data, error } = await db.from('ventas').insert({
      producto_id:    productoId,
      cantidad:       cantidad,
      precio_unitario:precioUnitario,
      total:          total,
      detalle:        detalle || null,
      estado:         'completed',
    }).select().single();

    if (error) {
      // Si la tabla no existe todavía, devolver objeto parcial sin romper
      if (error.code === '42P01') {
        console.warn('Tabla ventas no encontrada. Creá la tabla en Supabase.');
        return { producto_id: productoId, cantidad, total };
      }
      throw error;
    }
    return data;
  }

  /**
   * Obtener ventas con join a productos.
   */
  async function getSales(opts = {}) {
    const { search = '', status = 'all', page = 1, perPage = 20 } = opts;

    let query = db
      .from('ventas')
      .select(`
        id, created_at, cantidad, precio_unitario, total, estado, detalle,
        productos:producto_id ( nombre, categoria )
      `, { count: 'exact' });

    if (status !== 'all') query = query.eq('estado', status);
    if (search) query = query.ilike('productos.nombre', `%${search}%`);

    const from = (page - 1) * perPage;
    query = query.order('created_at', { ascending: false }).range(from, from + perPage - 1);

    const { data, error, count } = await query;
    if (error) {
      if (error.code === '42P01') return { data: [], count: 0 }; // tabla no existe aún
      throw error;
    }
    return { data: data || [], count: count || 0 };
  }

  /**
   * Estadísticas de ventas de los últimos 30 días.
   */
  async function getSalesSummary() {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data, error } = await db
      .from('ventas')
      .select('total, cantidad')
      .gte('created_at', since.toISOString());

    if (error) {
      if (error.code === '42P01') return { revenue: 0, units: 0, count: 0 };
      throw error;
    }

    const revenue = (data || []).reduce((s, r) => s + (r.total || 0), 0);
    const units   = (data || []).reduce((s, r) => s + (r.cantidad || 0), 0);
    return { revenue, units, count: (data || []).length };
  }

  /* ════════════════════════════════════
     DASHBOARD STATS (index.html)
  ════════════════════════════════════ */

  async function getDashboardStats() {
    const { data, error } = await db
      .from('productos')
      .select('stock')
      .eq('activo', true);
    if (error) throw error;

    const totalProducts = data.length;
    const totalStock    = data.reduce((s, p) => s + (p.stock || 0), 0);
    const lowStock      = data.filter(p => p.stock > 0 && p.stock <= 10).length;
    const outOfStock    = data.filter(p => p.stock === 0).length;
    return { totalProducts, totalStock, lowStock, outOfStock };
  }

  /* ════════════════════════════════════
     STORAGE — subida de imágenes
  ════════════════════════════════════ */

  /**
   * Subir imagen al bucket 'productos' y devolver URL pública.
   */
  async function uploadProductImage(file) {
    const ext  = file.name.split('.').pop();
    const path = `public/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await db.storage
      .from('productos')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;

    const { data } = db.storage.from('productos').getPublicUrl(path);
    return data.publicUrl;
  }

  /* ── Exportar namespace BG ── */
  window.BG = {
    db,
    // Productos
    getProducts,
    getCategories,
    searchProductsForSale,
    saveProduct,
    updateStock,
    deleteProduct,
    // Ventas
    registerSale,
    getSales,
    getSalesSummary,
    // Dashboard
    getDashboardStats,
    // Storage
    uploadProductImage,
  };

})();
