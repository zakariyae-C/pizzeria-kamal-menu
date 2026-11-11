/**
 * PIZZERIA KAMAL - COMMERCIAL SAAS ADMIN DASHBOARD ENGINE
 * Handles:
 * - Structured multi-price per dish (Solo, Normal, XL, Small, Medium, Large, etc.)
 * - Categories management with safe deletion & reordering
 * - Best Sellers ("Nos meilleurs plats") carousel integration
 * - Media library & Cloudflare R2 upload preparation
 * - Cloudflare D1 / Worker hybrid synchronization with localStorage fallback
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

  const formatBytes = (bytes) => {
    if (!bytes || bytes < 0) return '0 o';
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  };

  /**
   * Compresse n'importe quelle image (JPG, PNG, JFIF, etc.) et la convertit en WebP.
   * Force l'extension .webp, redimensionne si > maxDimension et applique la compression qualité.
   */
  function compressAndConvertToWebp(file, maxDimension = 1100, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("Aucun fichier fourni."));
        return;
      }

      // 1. Dériver un nom propre avec extension obligatoire .webp
      const originalName = file.name || "image.jpg";
      const cleanBase = originalName
        .replace(/\.[^/.]+$/, "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      const webpFileName = `${cleanBase || "plat"}.webp`;

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Erreur de lecture du fichier image."));
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Format d'image non valide ou fichier corrompu."));
        img.onload = () => {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Redimensionnement proportionnel si supérieur à maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Génération du DataURL WebP (idéal pour aperçu et stockage local léger)
          const webpDataUrl = canvas.toDataURL("image/webp", quality);

          // Génération du Blob WebP pour téléversement R2
          canvas.toBlob(
            (blob) => {
              const compressedSize = blob ? blob.size : Math.round(webpDataUrl.length * 0.75);
              const savings = Math.max(0, Math.round(((file.size - compressedSize) / file.size) * 100));

              let webpFile = null;
              if (blob) {
                try {
                  webpFile = new File([blob], webpFileName, { type: "image/webp" });
                } catch (_) {}
              }

              resolve({
                webpFile,
                blob,
                webpDataUrl,
                webpFileName,
                originalSize: file.size,
                compressedSize,
                savings,
                width,
                height,
              });
            },
            "image/webp",
            quality
          );
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

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

  // --------------------------------------------------------------------------
  // 1. DATA INITIALIZATION & SYNC
  // --------------------------------------------------------------------------
  async function loadInitialMenu() {
    // In production, D1 is the source of truth. Local storage is only a fallback
    // for offline preview or when the API has not been configured yet.
    try {
      const response = await fetch('/api/menu', { method: 'GET', cache: 'no-store' });
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
        showToast('Modifications enregistrées sur cet appareil uniquement. Synchronisation Cloudflare indisponible.', 'warning');
      }
    } catch (err) {
      showToast('Erreur lors de la sauvegarde locale: ' + err.message, 'warning');
    }
  }

  async function checkBackendConnection() {
    const pill = $('syncStatusPill');
    const text = $('syncStatusText');
    const adminEmail = $('adminEmail');

    try {
      const res = await fetch('/api/auth/me', { method: 'GET', cache: 'no-cache' });
      if (res.ok) {
        const authData = await res.json();
        pill.classList.remove('offline');
        text.textContent = 'Cloudflare D1 Connecté';
        if (authData.email) {
          adminEmail.textContent = authData.email;
        }
        return true;
      }
    } catch (_) {
      // Local development or offline mode
    }

    pill.classList.add('offline');
    text.textContent = 'Mode Local (localStorage)';
    adminEmail.textContent = 'Mode hors ligne · non authentifié';
    return false;
  }

  async function syncToBackend() {
    try {
      const response = await fetch('/api/menu/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu }),
        cache: 'no-store'
      });
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
    const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${esc(message)}</span>`;
    hub.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // --------------------------------------------------------------------------
  // 3. MULTI-PRICE OPTIONS MANAGER (CRITIQUE)
  // --------------------------------------------------------------------------
  function createPriceRow(label = '', amount = '') {
    const row = document.createElement('div');
    row.className = 'price-row-item';
    row.innerHTML = `
      <input type="text" class="price-row-label-input" placeholder="Taille / Label (ex: Solo, Normal, XL, 1 pers...)" value="${esc(label)}" maxlength="30">
      <div class="price-row-amount-wrap">
        <input type="number" class="price-row-amount-input" placeholder="0.00" value="${amount !== '' ? amount : ''}" min="0" step="0.5" required>
        <span class="price-row-currency">DH</span>
      </div>
      <button type="button" class="delete-price-row-btn" title="Supprimer cette option de prix" aria-label="Supprimer option de prix">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    `;

    const delBtn = row.querySelector('.delete-price-row-btn');
    delBtn.onclick = () => {
      const container = $('priceRowsContainer');
      if (container.children.length > 1) {
        row.remove();
        updateDeletePriceButtonsState();
      } else {
        showToast('Un plat doit comporter au moins un prix.', 'warning');
      }
    };

    return row;
  }

  function updateDeletePriceButtonsState() {
    const container = $('priceRowsContainer');
    const buttons = container.querySelectorAll('.delete-price-row-btn');
    const isSingle = buttons.length <= 1;
    buttons.forEach((btn) => {
      btn.disabled = isSingle;
    });
  }

  function renderPriceRows(prices = []) {
    const container = $('priceRowsContainer');
    container.innerHTML = '';

    if (!prices || prices.length === 0) {
      container.appendChild(createPriceRow('', ''));
    } else {
      prices.forEach((pr) => {
        container.appendChild(createPriceRow(pr.label || '', pr.amount));
      });
    }

    updateDeletePriceButtonsState();
  }

  function collectPricesFromForm() {
    const container = $('priceRowsContainer');
    const rows = container.querySelectorAll('.price-row-item');
    const prices = [];
    let hasError = false;

    rows.forEach((row) => {
      const labelInput = row.querySelector('.price-row-label-input');
      const amountInput = row.querySelector('.price-row-amount-input');
      const label = (labelInput?.value || '').trim();
      const amountVal = parseFloat(amountInput?.value);

      if (isNaN(amountVal) || amountVal < 0) {
        hasError = true;
      } else {
        prices.push({
          label: label,
          amount: amountVal,
        });
      }
    });

    const errorEl = $('priceErrorMsg');
    if (hasError || prices.length === 0) {
      if (errorEl) errorEl.hidden = false;
      return null;
    }

    if (errorEl) errorEl.hidden = true;
    return prices;
  }

  // --------------------------------------------------------------------------
  // 4. RENDU DE LA VUE 1 : VUE D'ENSEMBLE
  // --------------------------------------------------------------------------
  function renderOverviewStats() {
    const dishes = getAllDishes();
    const available = dishes.filter((d) => d.available !== false).length;
    const unavailable = dishes.length - available;
    const featured = dishes.filter((d) => d.best).length;

    $('statTotalDishes').textContent = dishes.length;
    $('statAvailableDishes').textContent = available;
    $('statUnavailableDishes').textContent = unavailable;
    $('statFeaturedDishes').textContent = featured;
    $('statTotalCategories').textContent = menu.length;

    $('dishesNavBadge').textContent = dishes.length;
    $('catsNavBadge').textContent = menu.length;
    $('featuredNavBadge').textContent = featured;
  }

  function renderRecentDishes() {
    const dishes = getAllDishes().slice(-6).reverse();
    const tbody = $('recentDishesTable');

    if (!tbody) return;

    tbody.innerHTML = dishes
      .map((d) => {
        const pricesHtml = d.prices && d.prices.length > 1
          ? d.prices.map((p) => `<span class="admin-price-badge"><span class="price-label">${esc(p.label || 'Taille')}</span> <span class="price-val">${fmt(p.amount)}</span></span>`).join('')
          : `<span class="admin-price-badge"><span class="price-val">${fmt(d.p)}</span></span>`;

        return `
          <tr>
            <td>
              <div class="dish-meta-cell">
                <div class="dish-thumb-box">
                  <img src="${esc(d.img || 'img/logo.webp')}" class="dish-thumb-img" alt="${esc(d.n)}" onerror="this.src='img/logo.webp'">
                </div>
                <div class="dish-copy">
                  <span class="dish-name-title">${esc(d.n)} ${d.best ? '⭐' : ''}</span>
                  <span class="dish-desc-text">${esc(d.d || 'Sans description')}</span>
                </div>
              </div>
            </td>
            <td><span class="category-pill">${esc(d.categoryIcon)} ${esc(d.categoryName)}</span></td>
            <td><div class="admin-price-cell">${pricesHtml}</div></td>
            <td>
              <button class="status-switch ${d.available !== false ? 'available' : 'unavailable'}" data-action="toggle-status" data-cat="${esc(d.categoryId)}" data-idx="${d.index}">
                ${d.available !== false ? '● Disponible' : '○ Masqué'}
              </button>
            </td>
            <td>
              <button class="btn btn-sm btn-ghost" data-action="edit-dish" data-cat="${esc(d.categoryId)}" data-idx="${d.index}">
                Modifier
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function renderCategoryBars() {
    const container = $('categoryBarsList');
    if (!container) return;

    const totalDishes = getAllDishes().length || 1;
    const sortedCats = [...menu].sort((a, b) => (b.i?.length || 0) - (a.i?.length || 0)).slice(0, 5);

    container.innerHTML = sortedCats
      .map((cat) => {
        const count = cat.i?.length || 0;
        const pct = Math.round((count / totalDishes) * 100);
        return `
          <div class="cat-bar-item">
            <div class="cat-bar-header">
              <span>${esc(cat.icon || '🍽️')} ${esc(cat.t)}</span>
              <span class="text-muted">${count} plats (${pct}%)</span>
            </div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  // --------------------------------------------------------------------------
  // 5. RENDU DE LA VUE 2 : PLATS & TARIFS
  // --------------------------------------------------------------------------
  function populateCategoryFilters() {
    const filterSelects = [$('dishCatFilter'), $('featuredCatFilter'), $('photoCatFilter'), $('modalDishCat')];
    const catOptions = menu.map((c) => `<option value="${esc(c.id)}">${esc(c.icon || '🍽️')} ${esc(c.t)}</option>`).join('');

    filterSelects.forEach((sel) => {
      if (!sel) return;
      if (sel.id === 'modalDishCat') {
        sel.innerHTML = catOptions;
      } else {
        sel.innerHTML = '<option value="all">Toutes les catégories</option>' + catOptions;
      }
    });
  }

  function renderDishesTable() {
    const tbody = $('dishesTableBody');
    const emptyState = $('emptyDishesState');
    if (!tbody) return;

    let rows = getAllDishes();

    // Search filter
    if (activeDishSearch) {
      const q = activeDishSearch.toLowerCase().trim();
      rows = rows.filter((d) =>
        (d.n + ' ' + (d.d || '') + ' ' + d.categoryName).toLowerCase().includes(q)
      );
    }

    // Category filter
    if (activeDishCat !== 'all') {
      rows = rows.filter((d) => d.categoryId === activeDishCat);
    }

    // Status filter
    if (activeDishStatus === 'available') {
      rows = rows.filter((d) => d.available !== false);
    } else if (activeDishStatus === 'unavailable') {
      rows = rows.filter((d) => d.available === false);
    }

    // Featured filter
    if (activeDishFeatured === 'featured') {
      rows = rows.filter((d) => d.best);
    }

    // Sort
    if (activeDishSort === 'name-asc') {
      rows.sort((a, b) => a.n.localeCompare(b.n, 'fr'));
    } else if (activeDishSort === 'price-asc') {
      rows.sort((a, b) => (a.prices[0]?.amount || 0) - (b.prices[0]?.amount || 0));
    } else if (activeDishSort === 'price-desc') {
      rows.sort((a, b) => (b.prices[0]?.amount || 0) - (a.prices[0]?.amount || 0));
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
  // 6. MODALE PLAT : AJOUT & MODIFICATION AVEC SUPPORT MULTI-PRIX COMPLET
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

    if (isEdit) {
      const cat = menu.find((c) => c.id === catId);
      const dish = cat?.i[index];
      if (!dish) return;

      const normalized = window.normalizeDish(dish, cat);
      $('modalDishName').value = normalized.n || '';
      $('modalDishCat').value = cat.id;
      $('modalDishDesc').value = normalized.d || '';
      $('modalDishImgPath').value = normalized.img || '';
      $('dishPreviewImg').src = normalized.img || 'img/logo.webp';
      $('modalDishAvailable').checked = normalized.available !== false;
      $('modalDishBest').checked = !!normalized.best;

      // Render all price options
      renderPriceRows(normalized.prices);
    } else {
      $('modalDishCat').value = catId || menu[0]?.id || '';
      $('dishPreviewImg').src = 'img/logo.webp';
      $('modalDishAvailable').checked = true;
      $('modalDishBest').checked = false;

      // Default single price row
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

    // Sanitize image path: force change from jpg, jpeg, png, jfif, bmp to .webp
    if (img && !img.startsWith('data:')) {
      img = img.replace(/\.(jpe?g|png|jfif|bmp|avif)$/i, '.webp');
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
        // Updated in same category
        origCat.i[origIndex] = { ...origCat.i[origIndex], ...newDishData };
      } else if (origCat) {
        // Moved to a different category
        origCat.i.splice(origIndex, 1);
        cat.i.push(newDishData);
      }
      showToast(`Plat « ${name} » mis à jour avec ${prices.length} option(s) de prix.`, 'success');
    } else {
      // New dish
      if (!cat.i) cat.i = [];
      cat.i.push(newDishData);
      showToast(`Plat « ${name} » ajouté au menu.`, 'success');
    }

    $('dishModal').close();
    saveMenu();
  }

  // --------------------------------------------------------------------------
  // 7. RENDU DE LA VUE 3 : CATÉGORIES (AVEC SÉCURITÉ DE SUPPRESSION)
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
        icon: icon,
        g: group,
        img: img,
        i: [],
      });
      showToast(`Catégorie « ${name} » créée.`, 'success');
    }

    $('categoryModal').close();
    saveMenu();
  }

  function requestDeleteCategory(catId) {
    const cat = menu.find((c) => c.id === catId);
    if (!cat) return;

    pendingDeleteCatId = catId;
    const dishCount = cat.i?.length || 0;

    $('deleteCatModalTitle').textContent = `Supprimer la catégorie « ${cat.t} » ?`;
    $('deleteCatWarningText').innerHTML = dishCount > 0
      ? `Cette catégorie contient <strong>${dishCount} plat(s)</strong>. Si vous confirmez, ces ${dishCount} plats seront également définitivement supprimés du menu digital.`
      : `Cette catégorie ne contient aucun plat. La suppression est sans danger pour le reste du menu.`;

    $('deleteCatModal').showModal();
  }

  function confirmCategoryDelete() {
    if (!pendingDeleteCatId) return;
    const cat = menu.find((c) => c.id === pendingDeleteCatId);
    if (cat) {
      menu = menu.filter((c) => c.id !== pendingDeleteCatId);
      showToast(`Catégorie « ${cat.t} » supprimée.`, 'success');
      saveMenu();
    }
    pendingDeleteCatId = null;
    $('deleteCatModal').close();
  }

  // --------------------------------------------------------------------------
  // 8. RENDU DE LA VUE 4 : NOS MEILLEURS PLATS (CARROUSEL)
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
  // 9. RENDU DE LA VUE 5 : MÉDIATHÈQUE / PHOTOS
  // --------------------------------------------------------------------------
  function renderPhotos() {
    const grid = $('mediaLibraryGrid');
    const badge = $('photoCountBadge');
    if (!grid) return;

    const dishes = getAllDishes();
    const searchVal = ($('photoSearchInput')?.value || '').toLowerCase().trim();
    const catVal = $('photoCatFilter')?.value || 'all';

    let list = dishes.filter((d) => d.img);
    if (searchVal) {
      list = list.filter((d) => d.n.toLowerCase().includes(searchVal) || (d.img || '').toLowerCase().includes(searchVal));
    }
    if (catVal !== 'all') {
      list = list.filter((d) => d.categoryId === catVal);
    }

    if (badge) badge.textContent = `${list.length} photos affichées`;

    grid.innerHTML = list
      .map((d) => `
        <article class="photo-card">
          <div class="photo-card-img-wrap">
            <img src="${esc(d.img)}" alt="${esc(d.n)}" loading="lazy" onerror="this.src='img/logo.webp'">
          </div>
          <div class="photo-card-body">
            <h4 class="photo-card-title">${esc(d.n)}</h4>
            <span class="photo-card-path">${esc(d.img)}</span>
            <div style="margin-top: 6px; display: flex; gap: 8px;">
              <button class="btn btn-sm btn-secondary" style="flex: 1;" data-action="edit-dish" data-cat="${esc(d.categoryId)}" data-idx="${d.index}">
                Changer la photo
              </button>
            </div>
          </div>
        </article>
      `)
      .join('');
  }

  // --------------------------------------------------------------------------
  // 10. RENDU DE LA VUE 6 : PARAMÈTRES DU RESTAURANT
  // --------------------------------------------------------------------------
  async function loadSettings() {
    let settings = null;
    try {
      const response = await fetch('/api/settings', { method: 'GET', cache: 'no-store' });
      if (response.ok) settings = await response.json();
    } catch (_) {}

    if (!settings || typeof settings !== 'object' || !Object.keys(settings).length) {
      try {
        settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      } catch (_) {
        settings = {};
      }
    } else {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    if ($('setRestoName')) $('setRestoName').value = settings.name || '';
    if ($('setRestoTagline')) $('setRestoTagline').value = settings.tagline || '';
    if ($('setRestoDesc')) $('setRestoDesc').value = settings.desc || '';
    if ($('setRestoPhone')) $('setRestoPhone').value = settings.phone || '';
    if ($('setRestoWhatsApp')) $('setRestoWhatsApp').value = settings.whatsapp || '';
    if ($('setRestoAddress')) $('setRestoAddress').value = settings.address || '';
    if ($('setRestoWifi')) $('setRestoWifi').value = settings.wifi || '';
    if ($('setRestoHours')) $('setRestoHours').value = settings.hours || 'Ouvert 7j/7 de 11h00 à 02h00';
    if ($('setRestoInstagram')) $('setRestoInstagram').value = settings.instagram || '';
    if ($('setRestoMaps')) $('setRestoMaps').value = settings.maps || '';
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
      hours: $('setRestoHours')?.value.trim() || 'Ouvert 7j/7 de 11h00 à 02h00',
      instagram: $('setRestoInstagram')?.value.trim() || '',
      maps: $('setRestoMaps')?.value.trim() || '',
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('storage'));

    // Synchronize settings with the backend; never claim cloud success on failure.
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      showToast('Coordonnées du restaurant synchronisées avec le serveur.', 'success');
    } catch (_) {
      showToast('Paramètres enregistrés sur cet appareil uniquement. Synchronisation Cloudflare indisponible.', 'warning');
    }
  }

  // --------------------------------------------------------------------------
  // 11. NAVIGATION PRINCIPALE (VIEWS SWITCHER)
  // --------------------------------------------------------------------------
  function showView(viewId) {
    currentView = viewId;

    document.querySelectorAll('.admin-view').forEach((el) => {
      el.classList.toggle('active', el.id === `view-${viewId}`);
    });

    document.querySelectorAll('.nav-link[data-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    const titles = {
      overview: "Vue d'ensemble",
      dishes: 'Plats & Tarifs',
      categories: 'Catégories',
      featured: 'Nos meilleurs plats',
      photos: 'Médiathèque & Photos',
      settings: 'Paramètres du restaurant',
    };

    const title = titles[viewId] || 'Administration';
    $('pageTitle').textContent = title;
    $('breadcrumbTitle').textContent = title;

    // Close mobile sidebar if open
    closeMobileSidebar();

    // Trigger views refresh
    if (viewId === 'overview') {
      renderOverviewStats();
      renderRecentDishes();
      renderCategoryBars();
    } else if (viewId === 'dishes') {
      renderDishesTable();
    } else if (viewId === 'categories') {
      renderCategories();
    } else if (viewId === 'featured') {
      renderFeaturedView();
    } else if (viewId === 'photos') {
      renderPhotos();
    } else if (viewId === 'settings') {
      loadSettings();
    }
  }

  function closeMobileSidebar() {
    $('sidebar')?.classList.remove('open');
    $('sidebarBackdrop')?.classList.remove('active');
  }

  function openMobileSidebar() {
    $('sidebar')?.classList.add('open');
    $('sidebarBackdrop')?.classList.add('active');
  }

  function refreshAll() {
    renderOverviewStats();
    populateCategoryFilters();
    renderRecentDishes();
    renderCategoryBars();
    renderDishesTable();
    renderCategories();
    renderFeaturedView();
    renderPhotos();
  }

  // --------------------------------------------------------------------------
  // 12. GESTION DES ÉVÉNEMENTS GLOBAUX
  // --------------------------------------------------------------------------
  function setupEventListeners() {
    // Navigation links
    document.querySelectorAll('.nav-link[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => showView(btn.dataset.view));
    });

    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => showView(btn.dataset.goto));
    });

    // Mobile sidebar toggle
    $('mobileMenuBtn')?.addEventListener('click', openMobileSidebar);
    $('sidebarCloseBtn')?.addEventListener('click', closeMobileSidebar);
    $('sidebarBackdrop')?.addEventListener('click', closeMobileSidebar);

    // Modal close buttons
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dialog = $(btn.dataset.closeModal);
        if (dialog) dialog.close();
      });
    });

    // Top action buttons
    $('topAddDishBtn')?.addEventListener('click', () => openDishModal());
    $('addDishBtn')?.addEventListener('click', () => openDishModal());
    $('quickAddDish')?.addEventListener('click', () => openDishModal());
    $('addCategoryBtn')?.addEventListener('click', () => openCategoryModal());

    // Export JSON Backup
    $('exportBtn')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(menu, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pizzeria-kamal-menu-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('Copie de sauvegarde du menu téléchargée.', 'success');
    });

    // Dish filter controls
    $('dishSearchInput')?.addEventListener('input', (e) => {
      activeDishSearch = e.target.value;
      const clearBtn = $('clearDishSearch');
      if (clearBtn) clearBtn.hidden = !activeDishSearch;
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
      renderDishesTable();
    });

    // Featured view controls
    $('featuredSearchInput')?.addEventListener('input', renderFeaturedView);
    $('featuredCatFilter')?.addEventListener('change', renderFeaturedView);

    // Photos view controls
    $('photoSearchInput')?.addEventListener('input', renderPhotos);
    $('photoCatFilter')?.addEventListener('change', renderPhotos);

    // Price option builder events
    $('addPriceOptionBtn')?.addEventListener('click', () => {
      const container = $('priceRowsContainer');
      const newRow = createPriceRow('', '');
      container.appendChild(newRow);
      updateDeletePriceButtonsState();
      newRow.querySelector('.price-row-label-input')?.focus();
    });

    // Quick chips for price labels
    document.querySelectorAll('.price-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = chip.dataset.chip;
        const container = $('priceRowsContainer');
        const emptyRow = Array.from(container.querySelectorAll('.price-row-item')).find(
          (row) => !row.querySelector('.price-row-label-input')?.value.trim()
        );

        if (emptyRow) {
          const input = emptyRow.querySelector('.price-row-label-input');
          if (input) input.value = val;
          emptyRow.querySelector('.price-row-amount-input')?.focus();
        } else {
          const newRow = createPriceRow(val, '');
          container.appendChild(newRow);
          updateDeletePriceButtonsState();
          newRow.querySelector('.price-row-amount-input')?.focus();
        }
      });
    });

    // Image preview on URL input
    $('modalDishImgPath')?.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      $('dishPreviewImg').src = val || 'img/logo.webp';
    });

    // Automatically convert any .jpg, .jpeg, .png, .jfif path to .webp when typed or pasted
    $('modalDishImgPath')?.addEventListener('change', (e) => {
      let val = e.target.value.trim();
      if (val && !val.startsWith('data:')) {
        const newVal = val.replace(/\.(jpe?g|png|jfif|bmp|avif)$/i, '.webp');
        if (newVal !== val) {
          e.target.value = newVal;
          $('dishPreviewImg').src = newVal;
          showToast(`Extension mise à jour en .webp : ${newVal}`, 'info');
        }
      }
    });

    // File input image upload with automatic conversion to WebP and compression
    $('modalDishFileInput')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 15 * 1024 * 1024) {
        showToast('Image trop volumineuse (Max 15 Mo).', 'warning');
        e.target.value = '';
        return;
      }

      try {
        showToast(`Conversion de « ${file.name} » en WebP et compression...`, 'info');
        const res = await compressAndConvertToWebp(file, 1100, 0.82);

        // Preview the compressed WebP image
        $('dishPreviewImg').src = res.webpDataUrl;

        // Set compressed WebP data URL into input (instant local compatibility)
        $('modalDishImgPath').value = res.webpDataUrl;
        $('modalDishImgPath').dataset.webpFilename = res.webpFileName;

        const origStr = formatBytes(res.originalSize);
        const compStr = formatBytes(res.compressedSize);
        showToast(`Photo convertie en WebP (${res.webpFileName}) : ${origStr} → ${compStr} (-${res.savings}%).`, 'success');
      } catch (err) {
        showToast(`Erreur traitement image: ${err.message}`, 'warning');
      }
    });

    // Global Photo Dropzone (R2 Ready)
    const dropzone = $('globalDropzone');
    const photoFileInput = $('globalPhotoInput');

    if (dropzone && photoFileInput) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files?.[0];
        if (file) handlePhotoUpload(file);
      });

      photoFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handlePhotoUpload(file);
      });
    }

    async function handlePhotoUpload(file) {
      if (file.size > 15 * 1024 * 1024) {
        showToast('Fichier trop volumineux. Limite maximale de 15 Mo.', 'warning');
        return;
      }

      try {
        showToast(`Conversion de « ${file.name} » en WebP et compression...`, 'info');
        const res = await compressAndConvertToWebp(file, 1100, 0.82);
        const origStr = formatBytes(res.originalSize);
        const compStr = formatBytes(res.compressedSize);

        // If backend connected, upload to R2
        try {
          const formData = new FormData();
          formData.append('file', res.webpFile || res.blob, res.webpFileName);
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
          if (uploadRes.ok) {
            showToast(`Photo ${res.webpFileName} compressée et téléversée sur Cloudflare R2 !`, 'success');
            renderPhotos();
            return;
          }
        } catch (_) {}

        showToast(`Photo convertie en WebP (${res.webpFileName}) : ${origStr} → ${compStr} (-${res.savings}%). Prête pour utilisation.`, 'success');
      } catch (err) {
        showToast(`Erreur conversion image: ${err.message}`, 'warning');
      }
    }

    // Forms submit handlers
    $('dishForm')?.addEventListener('submit', handleDishFormSubmit);
    $('categoryForm')?.addEventListener('submit', handleCategoryFormSubmit);
    $('settingsForm')?.addEventListener('submit', handleSettingsSubmit);
    $('confirmDeleteCatBtn')?.addEventListener('click', confirmCategoryDelete);

    // Global delegation for dynamic actions (edit, delete, toggle)
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const catId = target.dataset.cat;
      const idx = target.dataset.idx !== undefined ? parseInt(target.dataset.idx, 10) : null;
      const id = target.dataset.id;

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
      }
    });

    // Logout button handler
    $('logoutBtn')?.addEventListener('click', () => {
      if (confirm('Voulez-vous vous déconnecter de la session administrateur ?')) {
        // Clear local credentials or redirect to Cloudflare Access logout URL
        location.href = '/cdn-cgi/access/logout';
      }
    });
  }

  // --------------------------------------------------------------------------
  // 13. BOOTSTRAP INITIAL
  // --------------------------------------------------------------------------
  async function init() {
    await loadInitialMenu();
    await loadSettings();
    populateCategoryFilters();
    refreshAll();
    setupEventListeners();
    await checkBackendConnection();
    showView('overview');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
