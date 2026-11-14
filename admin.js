/**
 * PIZZERIA KAMAL - COMMERCIAL SAAS ADMIN DASHBOARD ENGINE
 * 
 * Capabilities:
 * - Secure Session-based Authentication & Setup Bootstrap
 * - Structured multi-price per dish (Solo, Normal, XL, Small, Medium, Large, etc.)
 * - Automatic category-based dish image assignment (zero file upload, 0 R2 dependencies)
 * - Static photo library with one-click path copying
 * - Categories management with safe deletion & reordering
 * - Best Sellers ("Nos meilleurs plats") carousel integration
 * - Cloudflare D1 synchronization with same-origin cookies and CSRF protection
 * - Restaurant public settings management
 */

(() => {
  'use strict';

  const STORAGE_KEY = 'kamal-menu-prototype';
  const SETTINGS_KEY = 'kamal-restaurant-settings';

  // Base state
  let menu = [];
  let currentView = 'overview';
  let activeDishSearch = '';
  let activeDishCat = 'all';
  let activeDishStatus = 'all';
  let activeDishFeatured = 'all';
  let activeDishSort = 'default';
  let pendingDeleteCatId = null;

  // Utilities
  const $ = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));

  const fmt = (v) =>
    typeof v === "number" ? v.toFixed(2).replace(".", ",") + " DH" : v;

  // Flatten all dishes with category context
  const getAllDishes = () =>
    menu.flatMap((cat) =>
      (cat.i || []).map((dish, index) => ({
        ...window.normalizeDish(dish, cat),
        categoryId: cat.id,
        categoryName: cat.t,
        categoryIcon: cat.icon || '🍽️',
        index,
      }))
    );

  /**
   * Helper to retrieve the default image of a category.
   * If not set or missing, safely falls back to 'img/logo.webp'.
   */
  function getCategoryDefaultImage(catId) {
    const cat = menu.find((c) => c.id === catId);
    return (cat && cat.img) ? cat.img : 'img/logo.webp';
  }

  // --------------------------------------------------------------------------
  // 1. DATA INITIALIZATION & SYNC
  // --------------------------------------------------------------------------
  async function loadInitialMenu() {
    try {
      const response = await fetch('/api/menu', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (response.ok) {
        const cloudMenu = await response.json();
        if (Array.isArray(cloudMenu) && cloudMenu.length > 0) {
          menu = window.normalizeMenuData(cloudMenu);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
          return;
        }
      }
    } catch (err) {
      console.warn('API menu indisponible; utilisation du cache local:', err);
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        menu = window.normalizeMenuData(JSON.parse(saved));
      } else {
        menu = window.normalizeMenuData(window.DEFAULT_MENU || []);
      }
    } catch (err) {
      console.warn('Erreur chargement localStorage:', err);
      menu = window.normalizeMenuData(window.DEFAULT_MENU || []);
    }
  }

  async function saveMenu(message = 'Modifications enregistrées') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
      refreshAll();
      const cloudSynced = await syncToBackend();
      if (cloudSynced) {
        showToast(`${message} · synchronisé avec le serveur`, 'success');
      } else {
        showToast('Modifications enregistrées localement.', 'info');
      }
    } catch (err) {
      showToast('Erreur lors de la sauvegarde: ' + err.message, 'warning');
    }
  }

  async function checkBackendConnection() {
    const pill = $('syncStatusPill');
    const text = $('syncStatusText');
    const adminEmail = $('adminEmail');

    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        cache: 'no-cache'
      });
      if (res.ok) {
        const authData = await res.json();
        pill?.classList.remove('offline');
        if (text) text.textContent = 'Cloudflare D1 Connecté';
        if (authData.email && adminEmail) {
          adminEmail.textContent = authData.email;
          const avatar = $('adminAvatar');
          if (avatar) avatar.textContent = authData.email.substring(0, 2).toUpperCase();
        }
        return true;
      }
    } catch (_) {}

    pill?.classList.add('offline');
    if (text) text.textContent = 'Mode Local (D1 non joint)';
    return false;
  }

  async function syncToBackend() {
    try {
      const response = await fetch('/api/menu/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ menu }),
        cache: 'no-store'
      });
      if (response.status === 401) {
        handleUnauthorized();
        return false;
      }
      if (!response.ok) return false;
      const result = await response.json();
      return result.success === true;
    } catch (_) {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // 2. TOAST NOTIFICATIONS
  // --------------------------------------------------------------------------
  function showToast(message, type = 'info') {
    const hub = $('toastHub');
    if (!hub) return;

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '✕';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${esc(message)}</span>
      <button class="toast-close-btn" aria-label="Fermer">✕</button>
    `;

    toast.querySelector('.toast-close-btn').addEventListener('click', () => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 250);
    });

    hub.appendChild(toast);

    setTimeout(() => {
      if (toast.isConnected) {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 250);
      }
    }, 4500);
  }

  // --------------------------------------------------------------------------
  // 3. AUTHENTICATION & LOGIN WORKFLOW
  // --------------------------------------------------------------------------
  async function checkAuthAndInit() {
    const authScreen = $('authScreen');
    const adminApp = $('adminApp');
    const loginForm = $('loginForm');
    const setupForm = $('setupForm');

    try {
      const res = await fetch('/api/auth/status', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        if (data.setupRequired) {
          // No admin configured: show bootstrap setup form
          if (authScreen) authScreen.style.display = 'flex';
          if (adminApp) adminApp.style.display = 'none';
          if (loginForm) loginForm.hidden = true;
          if (setupForm) setupForm.hidden = false;
          return false;
        }

        if (data.authenticated) {
          // Valid authenticated session
          if (authScreen) authScreen.style.display = 'none';
          if (adminApp) adminApp.style.display = 'flex';
          if (data.email) {
            const emailEl = $('adminEmail');
            if (emailEl) emailEl.textContent = data.email;
            const avatar = $('adminAvatar');
            if (avatar) avatar.textContent = data.email.substring(0, 2).toUpperCase();
          }
          return true;
        }

        // Unauthenticated: present login screen
        if (authScreen) authScreen.style.display = 'flex';
        if (adminApp) adminApp.style.display = 'none';
        if (loginForm) loginForm.hidden = false;
        if (setupForm) setupForm.hidden = true;
        return false;
      }
    } catch (err) {
      console.warn('API de statut non disponible:', err);
    }

    // Default: show login screen if API is unreachable
    if (authScreen) authScreen.style.display = 'flex';
    if (adminApp) adminApp.style.display = 'none';
    if (loginForm) loginForm.hidden = false;
    if (setupForm) setupForm.hidden = true;
    return false;
  }

  async function handleLoginFormSubmit(e) {
    e.preventDefault();
    const email = $('loginEmail')?.value.trim();
    const password = $('loginPassword')?.value;
    const errorMsg = $('loginErrorMsg');
    const submitBtn = $('loginSubmitBtn');

    if (errorMsg) errorMsg.hidden = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Connexion en cours...</span>';
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        const raw = await res.text().catch(() => '');
        data = { error: raw.trim() || `Erreur serveur HTTP ${res.status}` };
      }

      if (res.ok && data.success) {
        $('authScreen').style.display = 'none';
        $('adminApp').style.display = 'flex';
        if ($('adminEmail')) $('adminEmail').textContent = data.email || email;
        const avatar = $('adminAvatar');
        if (avatar) avatar.textContent = (data.email || email).substring(0, 2).toUpperCase();

        await loadInitialMenu();
        await loadSettings();
        populateCategoryFilters();
        refreshAll();
        await checkBackendConnection();
        showView('overview');
        showToast('Connexion réussie. Bienvenue sur le tableau de bord.', 'success');
        return;
      }

      if (errorMsg) {
        errorMsg.textContent = data.error || `Identifiants incorrects (HTTP ${res.status}).`;
        errorMsg.hidden = false;
      }
    } catch (err) {
      if (errorMsg) {
        errorMsg.textContent = 'Erreur réseau : ' + err.message;
        errorMsg.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Se connecter au tableau de bord</span>';
      }
    }
  }

  async function handleSetupFormSubmit(e) {
    e.preventDefault();
    const email = $('setupEmail')?.value.trim();
    const password = $('setupPassword')?.value;
    const passwordConfirm = $('setupPasswordConfirm')?.value;
    const setupSecret = $('setupSecret')?.value.trim();
    const errorMsg = $('setupErrorMsg');
    const submitBtn = $('setupSubmitBtn');

    if (errorMsg) errorMsg.hidden = true;

    if (password.length < 8) {
      if (errorMsg) {
        errorMsg.textContent = 'Le mot de passe doit comporter au moins 8 caractères.';
        errorMsg.hidden = false;
      }
      return;
    }

    if (password !== passwordConfirm) {
      if (errorMsg) {
        errorMsg.textContent = 'Les mots de passe ne correspondent pas.';
        errorMsg.hidden = false;
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Création du compte...</span>';
    }

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, setupSecret })
      });

      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        const raw = await res.text().catch(() => '');
        data = { error: raw.trim() || `Erreur serveur HTTP ${res.status}` };
      }

      if (res.ok && data.success) {
        $('authScreen').style.display = 'none';
        $('adminApp').style.display = 'flex';
        if ($('adminEmail')) $('adminEmail').textContent = data.email || email;
        const avatar = $('adminAvatar');
        if (avatar) avatar.textContent = (data.email || email).substring(0, 2).toUpperCase();

        await loadInitialMenu();
        await loadSettings();
        populateCategoryFilters();
        refreshAll();
        await checkBackendConnection();
        showView('overview');
        showToast('Compte administrateur créé avec succès !', 'success');
        return;
      }

      if (errorMsg) {
        errorMsg.textContent = data.error || `Erreur (${res.status}) lors de la création du compte.`;
        errorMsg.hidden = false;
      }
    } catch (err) {
      if (errorMsg) {
        errorMsg.textContent = 'Erreur serveur : ' + err.message;
        errorMsg.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Créer le compte et accéder au tableau de bord</span>';
      }
    }
  }

  async function handleLogout() {
    if (!confirm('Voulez-vous vous déconnecter du tableau de bord ?')) return;

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin'
      });
    } catch (_) {}

    $('adminApp').style.display = 'none';
    $('authScreen').style.display = 'flex';
    $('loginForm').hidden = false;
    $('setupForm').hidden = true;
    if ($('loginPassword')) $('loginPassword').value = '';
    if ($('loginErrorMsg')) $('loginErrorMsg').hidden = true;
    showToast('Déconnexion effectuée avec succès.', 'info');
  }

  function handleUnauthorized() {
    $('adminApp').style.display = 'none';
    $('authScreen').style.display = 'flex';
    $('loginForm').hidden = false;
    $('setupForm').hidden = true;
    const loginErrorMsg = $('loginErrorMsg');
    if (loginErrorMsg) {
      loginErrorMsg.textContent = 'Votre session a expiré. Veuillez vous reconnecter.';
      loginErrorMsg.hidden = false;
    }
  }

  // --------------------------------------------------------------------------
  // 4. RENDU DE LA VUE 1 : VUE D'ENSEMBLE & STATISTIQUES
  // --------------------------------------------------------------------------
  function renderOverview() {
    const dishes = getAllDishes();
    const totalDishes = dishes.length;
    const availableDishes = dishes.filter((d) => d.available !== false).length;
    const unavailableDishes = totalDishes - availableDishes;
    const featuredDishes = dishes.filter((d) => d.best).length;
    const totalCategories = menu.length;

    if ($('statTotalDishes')) $('statTotalDishes').textContent = totalDishes;
    if ($('statAvailableDishes')) $('statAvailableDishes').textContent = availableDishes;
    if ($('statUnavailableDishes')) $('statUnavailableDishes').textContent = unavailableDishes;
    if ($('statFeaturedDishes')) $('statFeaturedDishes').textContent = featuredDishes;
    if ($('statTotalCategories')) $('statTotalCategories').textContent = totalCategories;

    if ($('dishesNavBadge')) $('dishesNavBadge').textContent = totalDishes;
    if ($('catsNavBadge')) $('catsNavBadge').textContent = totalCategories;
    if ($('featuredNavBadge')) $('featuredNavBadge').textContent = featuredDishes;


    // Category distribution bars
    const barsList = $('categoryBarsList');
    if (barsList) {
      const catCounts = menu.map((c) => ({
        name: c.t,
        icon: c.icon || '🍽️',
        count: c.i?.length || 0,
      }));
      catCounts.sort((a, b) => b.count - a.count);

      const maxCount = Math.max(...catCounts.map((c) => c.count), 1);
      barsList.innerHTML = catCounts
        .slice(0, 6)
        .map((c) => {
          const pct = Math.round((c.count / maxCount) * 100);
          return `
            <div class="cat-bar-item">
              <div class="cat-bar-header">
                <span>${esc(c.icon)} ${esc(c.name)}</span>
                <strong>${c.count} plat(s)</strong>
              </div>
              <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  // --------------------------------------------------------------------------
  // 5. RENDU DE LA VUE 2 : TABLE DES PLATS & TARIFS
  // --------------------------------------------------------------------------
  function renderDishesTable() {
    const tbody = $('dishesTableBody');
    const emptyState = $('emptyDishesState');
    if (!tbody) return;

    let rows = getAllDishes();

    // Filters
    if (activeDishSearch) {
      rows = rows.filter(
        (d) =>
          d.n.toLowerCase().includes(activeDishSearch) ||
          (d.d || '').toLowerCase().includes(activeDishSearch) ||
          (d.prices || []).some((p) => String(p.amount).includes(activeDishSearch))
      );
    }
    if (activeDishCat !== 'all') {
      rows = rows.filter((d) => d.categoryId === activeDishCat);
    }
    if (activeDishStatus === 'available') {
      rows = rows.filter((d) => d.available !== false);
    } else if (activeDishStatus === 'unavailable') {
      rows = rows.filter((d) => d.available === false);
    }
    if (activeDishFeatured === 'featured') {
      rows = rows.filter((d) => d.best);
    }

    // Sorting
    if (activeDishSort === 'name-asc') {
      rows.sort((a, b) => a.n.localeCompare(b.n));
    } else if (activeDishSort === 'price-asc') {
      rows.sort((a, b) => (a.p || 0) - (b.p || 0));
    } else if (activeDishSort === 'price-desc') {
      rows.sort((a, b) => (b.p || 0) - (a.p || 0));
    }

    if (rows.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    tbody.innerHTML = rows
      .map((d) => {
        const pricesHtml = d.prices && d.prices.length > 1
          ? d.prices.map((p) => `<span class="admin-price-badge"><span class="price-label">${esc(p.label || 'Taille')}</span> <span class="price-val">${fmt(p.amount)}</span></span>`).join('')
          : `<span class="admin-price-badge"><span class="price-val">${fmt(d.p)}</span></span>`;

        return `
          <tr>
            <td>
              <div class="dish-meta-cell">
                <div class="dish-thumb-box" data-action="zoom-photo" data-img="${esc(d.img || 'img/logo.webp')}" data-title="${esc(d.n)}">
                  <img src="${esc(d.img || 'img/logo.webp')}" class="dish-thumb-img" alt="${esc(d.n)}" onerror="this.src='img/logo.webp'">
                </div>
                <div class="dish-copy">
                  <span class="dish-name-title">${esc(d.n)}</span>
                  <span class="dish-desc-text" title="${esc(d.d || '')}">${esc(d.d || 'Sans description')}</span>
                </div>
              </div>
            </td>
            <td><span class="category-pill">${esc(d.categoryIcon)} ${esc(d.categoryName)}</span></td>
            <td><div class="admin-price-cell">${pricesHtml}</div></td>
            <td style="text-align: center;">
              <button class="status-switch ${d.available !== false ? 'available' : 'unavailable'}" data-action="toggle-status" data-cat="${esc(d.categoryId)}" data-idx="${d.index}" title="Cliquer pour changer la disponibilité">
                ${d.available !== false ? '● Disponible' : '○ Masqué'}
              </button>
            </td>
            <td style="text-align: center;">
              <button class="star-btn ${d.best ? 'is-starred' : ''}" data-action="toggle-featured" data-cat="${esc(d.categoryId)}" data-idx="${d.index}" title="${d.best ? 'Retirer du carrousel' : 'Ajouter au carrousel'}">
                ${d.best ? '⭐' : '☆'}
              </button>
            </td>
            <td>
              <div class="row-actions-group">
                <button class="action-icon-btn" data-action="edit-dish" data-cat="${esc(d.categoryId)}" data-idx="${d.index}" title="Modifier le plat et ses prix">
                  <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="action-icon-btn delete-btn" data-action="delete-dish" data-cat="${esc(d.categoryId)}" data-idx="${d.index}" title="Supprimer ce plat">
                  <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  // --------------------------------------------------------------------------
  // 6. MODALE PLAT : MULTI-PRIX ET ATTRIBUTION AUTOMATIQUE D'IMAGE SELON CATÉGORIE
  // --------------------------------------------------------------------------
  function openDishModal(catId = null, index = null) {
    const isEdit = index !== null;
    const modal = $('dishModal');
    const form = $('dishForm');

    form.reset();
    $('priceErrorMsg').hidden = true;

    $('dishModalTitle').textContent = isEdit ? 'Modifier le plat et ses tarifs' : 'Ajouter un nouveau plat';
    $('dishEditOriginalCat').value = catId || '';
    $('dishEditOriginalIndex').value = isEdit ? index : '';

    const pathInput = $('modalDishImgPath');
    const previewImg = $('dishPreviewImg');

    if (isEdit) {
      const cat = menu.find((c) => c.id === catId);
      const dish = cat?.i[index];
      if (!dish) return;

      const normalized = window.normalizeDish(dish, cat);
      $('modalDishName').value = normalized.n || '';
      $('modalDishCat').value = cat.id;
      $('modalDishDesc').value = normalized.d || '';

      const currentImg = normalized.img || getCategoryDefaultImage(cat.id);
      pathInput.value = currentImg;
      previewImg.src = currentImg;

      // Track if dish image differs from its category default
      pathInput.dataset.isCustom = (normalized.img && normalized.img !== cat.img) ? 'true' : 'false';

      $('modalDishAvailable').checked = normalized.available !== false;
      $('modalDishBest').checked = !!normalized.best;

      renderPriceRows(normalized.prices);
    } else {
      const defaultCatId = catId || menu[0]?.id || '';
      $('modalDishCat').value = defaultCatId;

      // AUTOMATIC: Assign category's default image to new dish
      const defaultImg = getCategoryDefaultImage(defaultCatId);
      pathInput.value = defaultImg;
      previewImg.src = defaultImg;
      pathInput.dataset.isCustom = 'false';

      $('modalDishAvailable').checked = true;
      $('modalDishBest').checked = false;

      renderPriceRows([{ label: '', amount: '' }]);
    }

    modal.showModal();
  }

  function handleDishFormSubmit(e) {
    e.preventDefault();

    const name = $('modalDishName').value.trim();
    const catId = $('modalDishCat').value;
    const desc = $('modalDishDesc').value.trim();
    let img = $('modalDishImgPath').value.trim();
    const available = $('modalDishAvailable').checked;
    const best = $('modalDishBest').checked;

    // Fallback: If image path was left empty, automatically use category default image
    if (!img) {
      img = getCategoryDefaultImage(catId);
    }

    const prices = collectPricesFromForm();
    if (!prices || prices.length === 0) {
      showToast('Veuillez spécifier au moins un prix valide.', 'warning');
      return;
    }

    const cat = menu.find((c) => c.id === catId);
    if (!cat) {
      showToast('Catégorie introuvable.', 'warning');
      return;
    }

    const originalCatId = $('dishEditOriginalCat').value;
    const originalIndexStr = $('dishEditOriginalIndex').value;
    const isEdit = originalIndexStr !== '';

    const newDishData = {
      n: name,
      d: desc,
      img: img,
      prices: prices,
      p: prices[0]?.amount || 0,
      available: available,
      best: best,
    };
    if (prices.length > 1) {
      newDishData.x = prices[1].amount;
    }

    if (isEdit) {
      const origIndex = parseInt(originalIndexStr, 10);
      const origCat = menu.find((c) => c.id === originalCatId);

      if (origCat && origCat.id === cat.id) {
        origCat.i[origIndex] = { ...origCat.i[origIndex], ...newDishData };
      } else if (origCat) {
        origCat.i.splice(origIndex, 1);
        cat.i.push(newDishData);
      }
      showToast(`Plat « ${name} » mis à jour avec ${prices.length} option(s) de prix.`, 'success');
    } else {
      if (!cat.i) cat.i = [];
      cat.i.push(newDishData);
      showToast(`Plat « ${name} » ajouté au menu.`, 'success');
    }

    $('dishModal').close();
    saveMenu();
  }

  // --------------------------------------------------------------------------
  // 7. GESTIONNAIRE D'OPTIONS DE PRIX (MULTI-PRIX)
  // --------------------------------------------------------------------------
  function renderPriceRows(prices = []) {
    const container = $('priceRowsContainer');
    if (!container) return;

    if (!prices || prices.length === 0) {
      prices = [{ label: '', amount: '' }];
    }

    container.innerHTML = prices
      .map((p, index) => createPriceRowHtml(index, p.label || '', p.amount ?? ''))
      .join('');

    attachPriceRowListeners();
  }

  function createPriceRowHtml(index, label, amount) {
    return `
      <div class="price-row" data-price-index="${index}">
        <div class="price-col label-col">
          <label class="price-sublabel">Taille / Option</label>
          <input type="text" class="price-label-input" value="${esc(label)}" placeholder="Ex: Solo, 1 pers., XL..." maxlength="30">
        </div>
        <div class="price-col amount-col">
          <label class="price-sublabel">Montant (DH) <span class="required">*</span></label>
          <div class="amount-input-wrap">
            <input type="number" step="0.5" min="0" class="price-amount-input" value="${esc(amount)}" placeholder="0.00" required>
            <span class="currency-tag">DH</span>
          </div>
        </div>
        <div class="price-col actions-col">
          <button type="button" class="btn-remove-price" data-remove-price="${index}" title="Supprimer cette option de prix" aria-label="Supprimer">
            ✕
          </button>
        </div>
      </div>
    `;
  }

  function attachPriceRowListeners() {
    const container = $('priceRowsContainer');
    if (!container) return;

    container.querySelectorAll('[data-remove-price]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const rows = container.querySelectorAll('.price-row');
        if (rows.length <= 1) {
          showToast('Un plat doit comporter au moins une option de prix.', 'warning');
          return;
        }
        const row = e.target.closest('.price-row');
        row.remove();
        reindexPriceRows();
      });
    });
  }

  function reindexPriceRows() {
    const container = $('priceRowsContainer');
    if (!container) return;
    container.querySelectorAll('.price-row').forEach((row, idx) => {
      row.dataset.priceIndex = idx;
      const removeBtn = row.querySelector('.btn-remove-price');
      if (removeBtn) removeBtn.dataset.removePrice = idx;
    });
  }

  function addPriceRow(label = '', amount = '') {
    const container = $('priceRowsContainer');
    if (!container) return;

    const currentRows = container.querySelectorAll('.price-row');
    const newIndex = currentRows.length;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = createPriceRowHtml(newIndex, label, amount);

    const newRow = tempDiv.firstElementChild;
    container.appendChild(newRow);

    newRow.querySelector('[data-remove-price]').addEventListener('click', () => {
      const rows = container.querySelectorAll('.price-row');
      if (rows.length <= 1) {
        showToast('Un plat doit comporter au moins une option de prix.', 'warning');
        return;
      }
      newRow.remove();
      reindexPriceRows();
    });

    const amountInput = newRow.querySelector('.price-amount-input');
    if (amountInput) amountInput.focus();
  }

  function collectPricesFromForm() {
    const container = $('priceRowsContainer');
    if (!container) return null;

    const rows = container.querySelectorAll('.price-row');
    const prices = [];

    rows.forEach((row) => {
      const label = row.querySelector('.price-label-input')?.value.trim() || '';
      const amountStr = row.querySelector('.price-amount-input')?.value.trim() || '';
      const amount = parseFloat(amountStr);

      if (!isNaN(amount) && amount >= 0) {
        prices.push({ label, amount });
      }
    });

    return prices;
  }

  // --------------------------------------------------------------------------
  // 8. RENDU DE LA VUE 3 : CATÉGORIES (AVEC SÉCURITÉ DE SUPPRESSION)
  // --------------------------------------------------------------------------
  function renderCategories() {
    const grid = $('categoryCardsGrid');
    if (!grid) return;

    grid.innerHTML = menu
      .map((cat, idx) => {
        const dishCount = cat.i?.length || 0;
        const groupLabel = cat.g === 'repas' ? '🍽️ Repas' : cat.g === 'boissons' ? '🥤 Boissons & Jus' : '🍰 Desserts';

        return `
          <article class="cat-admin-card">
            <div class="cat-card-img-wrap">
              <img src="${esc(cat.img || 'img/logo.webp')}" class="cat-card-img" alt="${esc(cat.t)}" onerror="this.src='img/logo.webp'">
            </div>
            <div class="cat-card-info">
              <h3 class="cat-card-title">${esc(cat.icon || '🍽️')} ${esc(cat.t)}</h3>
              <p class="cat-card-meta">${dishCount} plat(s) · ${groupLabel}</p>
            </div>
            <div class="cat-card-reorder">
              <button class="reorder-btn" data-action="cat-up" data-idx="${idx}" title="Monter" ${idx === 0 ? 'disabled' : ''}>▲</button>
              <button class="reorder-btn" data-action="cat-down" data-idx="${idx}" title="Descendre" ${idx === menu.length - 1 ? 'disabled' : ''}>▼</button>
            </div>
            <div class="row-actions-group">
              <button class="action-icon-btn" data-action="edit-cat" data-id="${esc(cat.id)}" title="Modifier la catégorie">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="action-icon-btn delete-btn" data-action="delete-cat" data-id="${esc(cat.id)}" title="Supprimer la catégorie">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function openCategoryModal(catId = null) {
    const modal = $('categoryModal');
    const form = $('categoryForm');
    form.reset();

    const isEdit = !!catId;
    $('categoryModalTitle').textContent = isEdit ? 'Modifier la catégorie' : 'Ajouter une catégorie';
    $('modalCatOriginalId').value = catId || '';

    if (isEdit) {
      const cat = menu.find((c) => c.id === catId);
      if (!cat) return;
      $('modalCatName').value = cat.t || '';
      $('modalCatIcon').value = cat.icon || '🍽️';
      $('modalCatGroup').value = cat.g || 'repas';
      $('modalCatImage').value = cat.img || '';
    } else {
      $('modalCatIcon').value = '🍽️';
      $('modalCatGroup').value = 'repas';
      $('modalCatImage').value = 'img/logo.webp';
    }

    modal.showModal();
  }

  function handleCategoryFormSubmit(e) {
    e.preventDefault();
    const origId = $('modalCatOriginalId').value;
    const name = $('modalCatName').value.trim();
    const icon = $('modalCatIcon').value.trim() || '🍽️';
    const group = $('modalCatGroup').value;
    const img = $('modalCatImage').value.trim() || 'img/logo.webp';

    const slug = origId || name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    if (origId) {
      const cat = menu.find((c) => c.id === origId);
      if (cat) {
        cat.t = name;
        cat.icon = icon;
        cat.g = group;
        cat.img = img;
        showToast(`Catégorie « ${name} » modifiée.`, 'success');
      }
    } else {
      if (menu.some((c) => c.id === slug)) {
        showToast('Une catégorie portant ce nom existe déjà.', 'warning');
        return;
      }
      menu.push({
        id: slug,
        t: name,
        g: group,
        icon: icon,
        img: img,
        i: [],
      });
      showToast(`Catégorie « ${name} » créée.`, 'success');
    }

    $('categoryModal').close();
    populateCategoryFilters();
    saveMenu();
  }

  function requestDeleteCategory(catId) {
    const cat = menu.find((c) => c.id === catId);
    if (!cat) return;

    pendingDeleteCatId = catId;
    const dishCount = cat.i?.length || 0;
    $('deleteCatModalTitle').textContent = `Supprimer « ${cat.t} » ?`;
    $('deleteCatWarningText').innerHTML = `Cette catégorie contient <strong>${dishCount} plat(s)</strong>. Si vous confirmez, la catégorie et tous ses plats associés seront supprimés du menu.`;

    $('deleteCatModal').showModal();
  }

  function confirmCategoryDelete() {
    if (!pendingDeleteCatId) return;

    const idx = menu.findIndex((c) => c.id === pendingDeleteCatId);
    if (idx !== -1) {
      const deletedCat = menu.splice(idx, 1)[0];
      saveMenu(`Catégorie « ${deletedCat.t} » supprimée.`);
      populateCategoryFilters();
    }

    pendingDeleteCatId = null;
    $('deleteCatModal').close();
  }

  // --------------------------------------------------------------------------
  // 9. RENDU DE LA VUE 4 : NOS MEILLEURS PLATS (CARROUSEL)
  // --------------------------------------------------------------------------
  function renderFeaturedView() {
    const grid = $('featuredSelectionGrid');
    const counter = $('featuredCounter');
    if (!grid) return;

    let dishes = getAllDishes();
    const searchVal = ($('featuredSearchInput')?.value || '').toLowerCase().trim();
    const catVal = $('featuredCatFilter')?.value || 'all';

    if (searchVal) {
      dishes = dishes.filter((d) => d.n.toLowerCase().includes(searchVal) || (d.d || '').toLowerCase().includes(searchVal));
    }
    if (catVal !== 'all') {
      dishes = dishes.filter((d) => d.categoryId === catVal);
    }

    const featuredTotal = getAllDishes().filter((d) => d.best).length;
    if (counter) counter.textContent = featuredTotal;

    grid.innerHTML = dishes
      .map((d) => {
        const pricesText = d.prices && d.prices.length > 1
          ? d.prices.map((p) => `${p.label ? p.label + ': ' : ''}${p.amount} DH`).join(' · ')
          : `${d.p} DH`;

        return `
          <div class="featured-select-card ${d.best ? 'is-featured' : ''}" data-action="toggle-featured" data-cat="${esc(d.categoryId)}" data-idx="${d.index}">
            <img src="${esc(d.img || 'img/logo.webp')}" class="featured-card-thumb" alt="${esc(d.n)}" onerror="this.src='img/logo.webp'">
            <div class="featured-card-details">
              <strong>${esc(d.n)}</strong>
              <span>${esc(d.categoryIcon)} ${esc(d.categoryName)} · ${esc(pricesText)}</span>
            </div>
            <div class="featured-checkbox-wrap">
              ${d.best ? '⭐' : '○'}
            </div>
          </div>
        `;
      })
      .join('');
  }

  // --------------------------------------------------------------------------
  // 10. RENDU DE LA VUE 5 : MÉDIATHÈQUE STATIQUE (AVEC COPIE EN 1 CLIC)
  // --------------------------------------------------------------------------
  function renderPhotos() {
    const grid = $('mediaLibraryGrid');
    const badge = $('photoCountBadge');
    if (!grid) return;

    const searchVal = ($('photoSearchInput')?.value || '').toLowerCase().trim();
    const catVal = $('photoCatFilter')?.value || 'all';

    const photos = [];

    // 1. Category photos
    menu.forEach((cat) => {
      if (cat.img) {
        photos.push({
          name: `Catégorie : ${cat.t}`,
          path: cat.img,
          type: 'category',
          catId: cat.id,
          catName: cat.t,
          icon: cat.icon || '🍽️',
        });
      }
    });

    // 2. Dish photos
    getAllDishes().forEach((dish) => {
      if (dish.img) {
        photos.push({
          name: dish.n,
          path: dish.img,
          type: 'dish',
          catId: dish.categoryId,
          catName: dish.categoryName,
          icon: dish.categoryIcon || '🍽️',
        });
      }
    });

    // Deduplicate by path
    const seenPaths = new Set();
    const uniquePhotos = photos.filter((p) => {
      if (seenPaths.has(p.path)) return false;
      seenPaths.add(p.path);
      return true;
    });

    let filtered = uniquePhotos;
    if (searchVal) {
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(searchVal) || p.path.toLowerCase().includes(searchVal));
    }
    if (catVal !== 'all') {
      filtered = filtered.filter((p) => p.catId === catVal);
    }

    if (badge) badge.textContent = `${filtered.length} photo(s) répertoriée(s)`;

    grid.innerHTML = filtered
      .map((p) => `
        <article class="photo-card">
          <div class="photo-card-img-wrap" style="cursor: pointer;" data-action="copy-img-path" data-path="${esc(p.path)}" title="Cliquer pour copier le chemin">
            <img src="${esc(p.path)}" alt="${esc(p.name)}" loading="lazy" onerror="this.src='img/logo.webp'">
          </div>
          <div class="photo-card-body">
            <h4 class="photo-card-title">${esc(p.name)}</h4>
            <span class="photo-card-path" title="${esc(p.path)}">${esc(p.path)}</span>
            <div style="margin-top: 8px; display: flex; gap: 6px;">
              <button type="button" class="btn btn-sm btn-secondary" style="flex: 1;" data-action="copy-img-path" data-path="${esc(p.path)}">
                📋 Copier le chemin
              </button>
            </div>
          </div>
        </article>
      `)
      .join('');
  }

  // --------------------------------------------------------------------------
  // 11. PARAMÈTRES DU RESTAURANT
  // --------------------------------------------------------------------------
  async function loadSettings() {
    try {
      const response = await fetch('/api/settings', {
        method: 'GET',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (response.ok) {
        const data = await response.json();
        applySettingsToForm(data);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
        return;
      }
    } catch (_) {}

    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        applySettingsToForm(JSON.parse(saved));
      } catch (_) {}
    }
  }

  function applySettingsToForm(settings) {
    if (!settings || typeof settings !== 'object') return;
    if ($('setRestoName') && settings.name) $('setRestoName').value = settings.name;
    if ($('setRestoTagline') && settings.tagline !== undefined) $('setRestoTagline').value = settings.tagline;
    if ($('setRestoDesc') && settings.desc !== undefined) $('setRestoDesc').value = settings.desc;
    if ($('setRestoPhone') && settings.phone !== undefined) $('setRestoPhone').value = settings.phone;
    if ($('setRestoWhatsApp') && settings.whatsapp !== undefined) $('setRestoWhatsApp').value = settings.whatsapp;
    if ($('setRestoAddress') && settings.address !== undefined) $('setRestoAddress').value = settings.address;
    if ($('setRestoWifi') && settings.wifi !== undefined) $('setRestoWifi').value = settings.wifi;
    if ($('setRestoHours') && settings.hours !== undefined) $('setRestoHours').value = settings.hours;
    if ($('setRestoInstagram') && settings.instagram !== undefined) $('setRestoInstagram').value = settings.instagram;
    if ($('setRestoMaps') && settings.maps !== undefined) $('setRestoMaps').value = settings.maps;
  }

  async function handleSettingsSubmit(e) {
    e.preventDefault();
    const settings = {
      name: $('setRestoName')?.value.trim() || 'La Pizzeria Kamal',
      tagline: $('setRestoTagline')?.value.trim() || '',
      desc: $('setRestoDesc')?.value.trim() || '',
      phone: $('setRestoPhone')?.value.trim() || '',
      whatsapp: $('setRestoWhatsApp')?.value.trim() || '',
      address: $('setRestoAddress')?.value.trim() || '',
      wifi: $('setRestoWifi')?.value.trim() || '',
      hours: $('setRestoHours')?.value.trim() || '',
      instagram: $('setRestoInstagram')?.value.trim() || '',
      maps: $('setRestoMaps')?.value.trim() || '',
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: JSON.stringify(settings)
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.ok) {
        showToast('Paramètres du restaurant synchronisés avec le serveur.', 'success');
        return;
      }
    } catch (_) {}

    showToast('Paramètres enregistrés localement.', 'info');
  }

  // --------------------------------------------------------------------------
  // 12. GESTION DES VUES & ROUTAGE INTERNE
  // --------------------------------------------------------------------------
  function showView(viewName) {
    currentView = viewName;

    document.querySelectorAll('.admin-view').forEach((el) => el.classList.remove('active'));
    document.querySelectorAll('.nav-link[data-view]').forEach((el) => el.classList.remove('active'));

    const targetView = $(`view-${viewName}`);
    const targetNavLink = document.querySelector(`.nav-link[data-view="${viewName}"]`);

    if (targetView) targetView.classList.add('active');
    if (targetNavLink) targetNavLink.classList.add('active');

    const titles = {
      overview: "Vue d'ensemble",
      dishes: 'Plats & Tarifs',
      categories: 'Catégories',
      featured: 'Nos meilleurs plats',
      photos: 'Médiathèque des photos',
      settings: 'Paramètres du restaurant',
    };

    if ($('breadcrumbTitle')) $('breadcrumbTitle').textContent = titles[viewName] || viewName;
    if ($('pageTitle')) $('pageTitle').textContent = titles[viewName] || viewName;

    if (viewName === 'overview') renderOverview();
    if (viewName === 'dishes') renderDishesTable();
    if (viewName === 'categories') renderCategories();
    if (viewName === 'featured') renderFeaturedView();
    if (viewName === 'photos') renderPhotos();

    // Close mobile drawer if open
    $('sidebar')?.classList.remove('open');
    $('sidebarBackdrop')?.classList.remove('active');
  }

  function refreshAll() {
    renderOverview();
    renderDishesTable();
    renderCategories();
    renderFeaturedView();
    renderPhotos();
  }

  function populateCategoryFilters() {
    const filters = [$('dishCatFilter'), $('featuredCatFilter'), $('photoCatFilter')];
    const modalSelect = $('modalDishCat');

    const filterOptions =
      `<option value="all">Toutes les catégories</option>` +
      menu.map((c) => `<option value="${esc(c.id)}">${esc(c.icon || '🍽️')} ${esc(c.t)}</option>`).join('');

    filters.forEach((select) => {
      if (select) {
        const currentVal = select.value;
        select.innerHTML = filterOptions;
        select.value = currentVal || 'all';
      }
    });

    if (modalSelect) {
      const currentModalVal = modalSelect.value;
      modalSelect.innerHTML = menu
        .map((c) => `<option value="${esc(c.id)}">${esc(c.icon || '🍽️')} ${esc(c.t)}</option>`)
        .join('');
      if (currentModalVal) modalSelect.value = currentModalVal;
    }
  }

  // --------------------------------------------------------------------------
  // 13. ÉCOUTEURS D'ÉVÉNEMENTS
  // --------------------------------------------------------------------------
  function setupEventListeners() {
    // Navigation
    document.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => showView(btn.dataset.view));
    });

    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => showView(btn.dataset.goto));
    });

    // Mobile sidebar
    $('mobileMenuBtn')?.addEventListener('click', () => {
      $('sidebar')?.classList.add('open');
      $('sidebarBackdrop')?.classList.add('active');
    });

    $('sidebarCloseBtn')?.addEventListener('click', () => {
      $('sidebar')?.classList.remove('open');
      $('sidebarBackdrop')?.classList.remove('active');
    });

    $('sidebarBackdrop')?.addEventListener('click', () => {
      $('sidebar')?.classList.remove('open');
      $('sidebarBackdrop')?.classList.remove('active');
    });

    // Dishes Toolbar Filters
    $('dishSearchInput')?.addEventListener('input', (e) => {
      activeDishSearch = e.target.value.toLowerCase().trim();
      $('clearDishSearch').hidden = !activeDishSearch;
      renderDishesTable();
    });

    $('clearDishSearch')?.addEventListener('click', () => {
      $('dishSearchInput').value = '';
      activeDishSearch = '';
      $('clearDishSearch').hidden = true;
      renderDishesTable();
    });

    $('dishCatFilter')?.addEventListener('change', (e) => {
      activeDishCat = e.target.value;
      renderDishesTable();
    });

    $('dishStatusFilter')?.addEventListener('change', (e) => {
      activeDishStatus = e.target.value;
      renderDishesTable();
    });

    $('dishFeaturedFilter')?.addEventListener('change', (e) => {
      activeDishFeatured = e.target.value;
      renderDishesTable();
    });

    $('dishSortSelect')?.addEventListener('change', (e) => {
      activeDishSort = e.target.value;
      renderDishesTable();
    });

    $('resetDishFiltersBtn')?.addEventListener('click', () => {
      $('dishSearchInput').value = '';
      $('dishCatFilter').value = 'all';
      $('dishStatusFilter').value = 'all';
      $('dishFeaturedFilter').value = 'all';
      $('dishSortSelect').value = 'default';
      activeDishSearch = '';
      activeDishCat = 'all';
      activeDishStatus = 'all';
      activeDishFeatured = 'all';
      activeDishSort = 'default';
      $('clearDishSearch').hidden = true;
      renderDishesTable();
    });

    // Featured & Photos Filters
    $('featuredSearchInput')?.addEventListener('input', renderFeaturedView);
    $('featuredCatFilter')?.addEventListener('change', renderFeaturedView);

    $('photoSearchInput')?.addEventListener('input', renderPhotos);
    $('photoCatFilter')?.addEventListener('change', renderPhotos);

    // Modal Trigger Buttons
    $('addDishBtn')?.addEventListener('click', () => openDishModal());
    $('topAddDishBtn')?.addEventListener('click', () => openDishModal());
    $('quickAddDish')?.addEventListener('click', () => openDishModal());
    $('addCategoryBtn')?.addEventListener('click', () => openCategoryModal());

    // Modal Close Buttons
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.closeModal;
        const modal = $(modalId);
        if (modal) modal.close();
      });
    });

    // Multi-Price: Add option & Quick chip suggestions
    $('addPriceOptionBtn')?.addEventListener('click', () => addPriceRow());

    document.querySelectorAll('.price-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const label = chip.dataset.chip;
        const emptyRow = Array.from(document.querySelectorAll('.price-row')).find((row) => {
          const inp = row.querySelector('.price-label-input');
          return inp && !inp.value.trim();
        });

        if (emptyRow) {
          const inp = emptyRow.querySelector('.price-label-input');
          inp.value = label;
          emptyRow.querySelector('.price-amount-input')?.focus();
        } else {
          addPriceRow(label, '');
        }
      });
    });

    // AUTOMATIC CATEGORY IMAGE: Update dish image when changing category
    $('modalDishCat')?.addEventListener('change', (e) => {
      const selectedCatId = e.target.value;
      const isEdit = $('dishEditOriginalIndex').value !== '';
      const pathInput = $('modalDishImgPath');
      const previewImg = $('dishPreviewImg');

      // For new dishes, or existing dishes where the image hasn't been explicitly customized:
      if (!isEdit || pathInput?.dataset.isCustom !== 'true') {
        const newImg = getCategoryDefaultImage(selectedCatId);
        if (pathInput) pathInput.value = newImg;
        if (previewImg) previewImg.src = newImg;
      }
    });

    // Reset/assign category default image explicitly
    $('useCatDefaultImgBtn')?.addEventListener('click', () => {
      const selectedCatId = $('modalDishCat')?.value;
      const catImg = getCategoryDefaultImage(selectedCatId);
      const pathInput = $('modalDishImgPath');
      if (pathInput) {
        pathInput.value = catImg;
        pathInput.dataset.isCustom = 'false';
      }
      const previewImg = $('dishPreviewImg');
      if (previewImg) previewImg.src = catImg;
      showToast(`Image par défaut de la catégorie assignée (${catImg})`, 'info');
    });

    // Manual input in image path updates preview and flags custom image
    $('modalDishImgPath')?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const previewImg = $('dishPreviewImg');
      if (previewImg) previewImg.src = val || 'img/logo.webp';
      $('modalDishImgPath').dataset.isCustom = 'true';
    });

    // Forms submit handlers
    $('dishForm')?.addEventListener('submit', handleDishFormSubmit);
    $('categoryForm')?.addEventListener('submit', handleCategoryFormSubmit);
    $('settingsForm')?.addEventListener('submit', handleSettingsSubmit);
    $('confirmDeleteCatBtn')?.addEventListener('click', confirmCategoryDelete);

    // Global delegation for dynamic actions (edit, delete, toggle, copy path)
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const catId = target.dataset.cat;
      const idx = target.dataset.idx !== undefined ? parseInt(target.dataset.idx, 10) : null;
      const id = target.dataset.id;
      const path = target.dataset.path;

      if (action === 'edit-dish') {
        openDishModal(catId, idx);
      } else if (action === 'toggle-status') {
        const cat = menu.find((c) => c.id === catId);
        if (cat && cat.i[idx]) {
          const d = cat.i[idx];
          d.available = d.available === false;
          saveMenu(`Plat « ${d.n} » marqué ${d.available ? 'disponible' : 'masqué'}.`);
        }
      } else if (action === 'toggle-featured') {
        const cat = menu.find((c) => c.id === catId);
        if (cat && cat.i[idx]) {
          const d = cat.i[idx];
          d.best = !d.best;
          saveMenu(`Plat « ${d.n} » ${d.best ? 'ajouté au' : 'retiré du'} carrousel.`);
        }
      } else if (action === 'delete-dish') {
        const cat = menu.find((c) => c.id === catId);
        if (cat && cat.i[idx]) {
          const d = cat.i[idx];
          if (confirm(`Confirmez-vous la suppression du plat « ${d.n} » ?`)) {
            cat.i.splice(idx, 1);
            saveMenu(`Plat « ${d.n} » supprimé.`);
          }
        }
      } else if (action === 'edit-cat') {
        openCategoryModal(id);
      } else if (action === 'delete-cat') {
        requestDeleteCategory(id);
      } else if (action === 'cat-up') {
        if (idx > 0) {
          const temp = menu[idx];
          menu[idx] = menu[idx - 1];
          menu[idx - 1] = temp;
          saveMenu('Ordre des catégories mis à jour.');
        }
      } else if (action === 'cat-down') {
        if (idx < menu.length - 1) {
          const temp = menu[idx];
          menu[idx] = menu[idx + 1];
          menu[idx + 1] = temp;
          saveMenu('Ordre des catégories mis à jour.');
        }
      } else if (action === 'copy-img-path') {
        if (path) {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(path).then(() => {
              showToast(`Chemin « ${path} » copié !`, 'success');
            }).catch(() => {
              showToast(`Chemin : ${path}`, 'info');
            });
          } else {
            showToast(`Chemin : ${path}`, 'info');
          }
        }
      }
    });

    // JSON Export
    $('exportBtn')?.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(menu, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `kamal-menu-backup-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Copie de sauvegarde du menu exportée.', 'success');
    });

    // Logout
    $('logoutBtn')?.addEventListener('click', handleLogout);
  }

  function setupAuthEventListeners() {
    $('loginForm')?.addEventListener('submit', handleLoginFormSubmit);
    $('setupForm')?.addEventListener('submit', handleSetupFormSubmit);

    $('switchToLoginBtn')?.addEventListener('click', () => {
      $('setupForm').hidden = true;
      $('loginForm').hidden = false;
    });

    $('switchToSetupBtn')?.addEventListener('click', () => {
      $('loginForm').hidden = true;
      $('setupForm').hidden = false;
    });
  }

  // --------------------------------------------------------------------------
  // 14. INITIALISATION DE L'APPLICATION
  // --------------------------------------------------------------------------
  async function init() {
    setupEventListeners();
    setupAuthEventListeners();

    const authenticated = await checkAuthAndInit();
    if (authenticated) {
      await loadInitialMenu();
      await loadSettings();
      populateCategoryFilters();
      refreshAll();
      await checkBackendConnection();
      showView('overview');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
