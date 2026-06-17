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

  async function getSession() {
    const { data, error } = await BG.db.auth.getSession();
    if (error) return null;
    return data?.session ?? null;
  }

  async function getUser() {
    const session = await getSession();
    return session?.user ?? null;
  }

  async function isAdmin() {
    const user = await getUser();
    if (!user) return false;
    return user.user_metadata?.role === 'admin';
  }

  async function getProfile() {
    const user = await getUser();
    if (!user) return null;
    const { data } = await BG.db
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    return data;
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
    window.location.href = '/';
  }

  /* ════════════════════════════════════
     PROTECCIÓN DE RUTAS
  ════════════════════════════════════ */

  async function requireAdmin() {
    const session = await getSession();
    if (!session) {
      window.location.href = '/pages/login.html';
      return false;
    }
    const admin = await isAdmin();
    if (!admin) {
      window.location.href = '/';
      return false;
    }
    return true;
  }

  /* ════════════════════════════════════
     NAV: actualiza todos los elementos
     según si hay sesión o no
  ════════════════════════════════════ */

  async function updateNav() {
    const session = await getSession();
    const user    = session?.user ?? null;
    const admin   = user ? user.user_metadata?.role === 'admin' : false;

    /* -- Links solo para admins (PANEL) -- */
    document.querySelectorAll('[data-admin-only]').forEach(el => {
      el.style.display = admin ? '' : 'none';
    });

    /* -- Links que se ocultan si es admin -- */
    document.querySelectorAll('[data-hide-if-admin]').forEach(el => {
      el.style.display = admin ? 'none' : '';
    });

    /* ── Nuevo dropdown de cuenta (index + mi-cuenta) ── */
    const wrap          = document.getElementById('account-menu-wrap');
    const btnLogin      = document.getElementById('btn-login');
    const avatarName    = document.getElementById('avatar-name');
    const mobileLogin   = document.getElementById('mobile-login-link');
    const mobileCuenta  = document.getElementById('mobile-cuenta-link');
    const mobilePedidos = document.getElementById('mobile-pedidos-link');
    const mobileLogout  = document.getElementById('mobile-logout-btn');

    if (user) {
      // Traer perfil para mostrar el nombre
      const profile = await getProfile();
      const nombre  = profile?.nombre || user.email?.split('@')[0] || '';

      // Desktop: mostrar avatar, ocultar "Ingresar"
      if (wrap)     wrap.style.display     = 'block';
      if (btnLogin) btnLogin.style.display  = 'none';
      if (avatarName && nombre) avatarName.textContent = nombre;

      // Mobile sidebar: mostrar cuenta/pedidos/logout, ocultar login
      if (mobileLogin)    mobileLogin.style.display   = 'none';
      if (mobileCuenta)   mobileCuenta.style.display  = 'flex';
      if (mobilePedidos)  mobilePedidos.style.display = 'flex';
      if (mobileLogout)   mobileLogout.style.display  = 'flex';

    } else {
      // Desktop: ocultar avatar, mostrar "Ingresar"
      if (wrap)     wrap.style.display     = 'none';
      if (btnLogin) btnLogin.style.display  = 'flex';
      if (avatarName) avatarName.textContent = '';

      // Mobile sidebar: mostrar login, ocultar el resto
      if (mobileLogin)    mobileLogin.style.display   = 'flex';
      if (mobileCuenta)   mobileCuenta.style.display  = 'none';
      if (mobilePedidos)  mobilePedidos.style.display = 'none';
      if (mobileLogout)   mobileLogout.style.display  = 'none';
    }

    /* ── Info de usuario en sidebar del panel admin ── */
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
            class="p-1.5 hover:bg-surface-container-highest rounded-full transition-colors flex-shrink-0">
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
    getProfile,
    login,
    logout,
    requireAdmin,
    updateNav,
  };

})();
