/* ═══════════════════════════════════════════════
   BlancoGestión — auth.js
   Manejo de sesión, roles y protección de rutas
   Namespace global: window.BG_AUTH
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ════════════════════════════════════
     HELPERS INTERNOS
  ════════════════════════════════════ */

  /** Obtener la sesión activa de Supabase */
  async function getSession() {
    const { data, error } = await BG.db.auth.getSession();
    if (error) return null;
    return data?.session ?? null;
  }

  /** Obtener el usuario actual */
  async function getUser() {
    const session = await getSession();
    return session?.user ?? null;
  }

  /** Verificar si el usuario tiene rol admin (via user_metadata) */
  async function isAdmin() {
    const user = await getUser();
    if (!user) return false;
    return user.user_metadata?.role === 'admin';
  }

  /* ════════════════════════════════════
     LOGIN / LOGOUT
  ════════════════════════════════════ */

  async function login(email, password) {
    const { data, error } = await BG.db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function logout() {
    await BG.db.auth.signOut();
    window.location.href = getRootPath() + 'index.html';
  }

  /* ════════════════════════════════════
     PROTECCIÓN DE RUTAS
  ════════════════════════════════════ */

  /**
   * Llamar al inicio de panel.html.
   * Si no hay sesión → login. Si no es admin → index.
   */
  async function requireAdmin() {
    const session = await getSession();
    if (!session) {
      window.location.href = getRootPath() + 'login.html';
      return false;
    }
    const admin = await isAdmin();
    if (!admin) {
      window.location.href = getRootPath() + 'index.html';
      return false;
    }
    return true;
  }

  /** Detectar si estamos en /pages/ para armar rutas relativas */
  function getRootPath() {
    const path = window.location.pathname;
    return path.includes('/pages/') ? '../' : '';
  }

  /* ════════════════════════════════════
     NAV: mostrar/ocultar enlace PANEL
     y actualizar botón login/logout
  ════════════════════════════════════ */

  async function updateNav() {
    const admin = await isAdmin();
    const user  = await getUser();

    // Mostrar/ocultar links de panel en sidebar y topnav
    document.querySelectorAll('[data-admin-only]').forEach(el => {
      el.style.display = admin ? '' : 'none';
    });

    // Ocultar links de Stock y Ventas (reemplazados por Panel)
    document.querySelectorAll('[data-hide-if-admin]').forEach(el => {
      el.style.display = admin ? 'none' : '';
    });

    // Botón de cuenta en topnav
    const btnAccount = document.getElementById('btn-account');
    if (btnAccount) {
      if (user) {
        btnAccount.title = user.email;
        btnAccount.onclick = logout;
        btnAccount.innerHTML = `<span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">account_circle</span>`;
      } else {
        btnAccount.title = 'Iniciar sesión';
        btnAccount.onclick = () => { window.location.href = getRootPath() + 'login.html'; };
        btnAccount.innerHTML = `<span class="material-symbols-outlined">login</span>`;
      }
    }

    // Info de usuario en sidebar (panel.html)
    const sidebarUser = document.getElementById('sidebar-user-info');
    if (sidebarUser && user) {
      sidebarUser.innerHTML = `
        <div class="flex items-center gap-sm w-full">
          <div class="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-on-surface-variant" style="font-variation-settings:'FILL' 1">account_circle</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-label-caps text-label-caps text-primary truncate">ADMIN</p>
            <p class="text-[10px] text-on-surface-variant truncate">${user.email}</p>
          </div>
          <button onclick="BG_AUTH.logout()" title="Cerrar sesión"
            class="p-1.5 hover:bg-surface-container-highest rounded-full transition-colors flex-shrink-0"
            title="Cerrar sesión">
            <span class="material-symbols-outlined text-sm text-on-surface-variant">logout</span>
          </button>
        </div>`;
    }
  }

  /* ── Exportar namespace BG_AUTH ── */
  window.BG_AUTH = {
    getSession,
    getUser,
    isAdmin,
    login,
    logout,
    requireAdmin,
    updateNav,
  };

})();
