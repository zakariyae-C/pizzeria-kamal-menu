/* ==========================================================================
   KEBAB KAMAL - APPLICATION LOGIC & MENU ENGINE (DISPLAY ONLY)
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. DONNÉES DU RESTAURANT & DU MENU
   -------------------------------------------------------------------------- */
let INFO = {
  name: "La Pizzeria Kamal",
  tagline: "ذوق مرة، ورجع ديما",
  desc: "Pizzas, calzones, pasticcio, tacos, sandwichs, salades, plats et jus.",
  address: "6 Av. Mohammed V, Témara",
  phone: "0664-031519",
  whatsapp: "212664031519",
  wifi: "123456",
  hours: "Ouvert 7j/7 de 11h00 à 02h00",
  instagram: "https://www.instagram.com/la_pizzeria_kamal/",
  maps: "https://maps.app.goo.gl/uqh7U6Wp2MosHEdJ8?g_st=ac",
};

// Charge les paramètres personnalisés depuis le localStorage
function loadRestaurantSettings() {
  try {
    const saved = localStorage.getItem("kamal-restaurant-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        INFO = { ...INFO, ...parsed };
      }
    }
  } catch (err) {
    console.warn("Impossible de charger les paramètres du restaurant:", err);
  }
}
loadRestaurantSettings();

// Synchronisation en temps réel entre onglets (Dashboard <-> Menu Public)
window.addEventListener("storage", (e) => {
  if (e.key === "kamal-restaurant-settings") {
    loadRestaurantSettings();
    renderInfo();
  }
  if (e.key === "kamal-menu-prototype") {
    try {
      const savedMenu = localStorage.getItem("kamal-menu-prototype");
      if (savedMenu) {
        MENU = window.normalizeMenuData(JSON.parse(savedMenu));
        renderBestDishes();
        renderCategoriesGrid();
        if (location.hash && location.hash !== "#home") {
          renderCategoryDetail(location.hash.replace("#", ""));
        }
      }
    } catch (_) {}
  }
});

const GROUPS = [
  { id: "all", t: "⭐ Tout le menu" },
  { id: "repas", t: "🍽️ Repas" },
  { id: "boissons", t: "🥤 Boissons & Jus" },
  { id: "desserts", t: "🍰 Desserts" },
];

/* --------------------------------------------------------------------------
   INFOS & HORAIRES (modale) : n'affiche que ce qui existe dans INFO
   -------------------------------------------------------------------------- */
const ICON = {
  pin: '<svg viewBox="0 0 24 24"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  wa: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  insta:
    '<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  fb: '<svg viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
  wifi: '<svg viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
};

const rawMenu = window.DEFAULT_MENU || [];
let MENU = window.normalizeMenuData ? window.normalizeMenuData(rawMenu) : structuredClone(rawMenu);
try {
  const savedMenu = localStorage.getItem("kamal-menu-prototype");
  if (savedMenu) {
    const parsed = JSON.parse(savedMenu);
    MENU = window.normalizeMenuData ? window.normalizeMenuData(parsed) : parsed;
  }
} catch (error) {
  console.warn("Menu local data could not be loaded", error);
}

// Fetch remote menu & settings from Cloudflare Worker API if available
async function syncRemoteMenu() {
  try {
    const [menuRes, settingsRes] = await Promise.all([
      fetch("/api/menu", { cache: "no-cache" }).catch(() => null),
      fetch("/api/settings", { cache: "no-cache" }).catch(() => null),
    ]);

    if (menuRes && menuRes.ok) {
      const data = await menuRes.json();
      if (Array.isArray(data) && data.length > 0) {
        MENU = window.normalizeMenuData ? window.normalizeMenuData(data) : data;
        renderBestDishes();
        renderCategoriesGrid();
        if (location.hash && location.hash !== "#home") {
          renderCategoryDetail(location.hash.replace("#", ""));
        }
      }
    }

    if (settingsRes && settingsRes.ok) {
      const settingsData = await settingsRes.json();
      if (settingsData && typeof settingsData === "object") {
        INFO = { ...INFO, ...settingsData };
        renderInfo();
      }
    }
  } catch (_) {
    // Keep local / default menu
  }
}


// Accepte "@pseudo", "pseudo" ou un lien complet
const social = (v, base) =>
  /^https?:\/\//i.test(v) ? v : base + v.replace(/^@/, "");
const link = (href, text, cls = "text-link") =>
  `<a href="${href}" target="_blank" rel="noopener" class="${cls}">${text}</a>`;
const infoRow = (icon, title, body) =>
  `<div class="info-row"><div class="info-icon-box">${icon}</div>` +
  `<div class="info-meta"><strong>${title}</strong>${body}</div></div>`;

/* --------------------------------------------------------------------------
   RENDU DES INFOS DU RESTAURANT (depuis l'objet INFO synchronisé)
   -------------------------------------------------------------------------- */
function renderInfo() {
  // 1. Titre de la page et nom principal
  document.title = `${INFO.name || "La Pizzeria Kamal"} – Menu Digital`;
  if ($("brandName")) $("brandName").textContent = INFO.name || "La Pizzeria Kamal";

  // 2. Slogan (masqué s'il est vide)
  const tag = $("brandTagline");
  if (tag) {
    tag.textContent = INFO.tagline || "";
    tag.hidden = !INFO.tagline;
  }

  // 3. Description, adresse et Wifi
  if ($("brandDesc")) $("brandDesc").textContent = INFO.desc || "";
  if ($("brandAddress")) $("brandAddress").textContent = INFO.address || "";
  if ($("brandAddressPill")) $("brandAddressPill").hidden = !INFO.address;
  if ($("brandWifi")) $("brandWifi").textContent = INFO.wifi || "";
  if ($("brandWifiPill")) $("brandWifiPill").hidden = !INFO.wifi;

  // 4. Horaires du bandeau supérieur
  if ($("topNavHours")) {
    $("topNavHours").textContent = INFO.hours || "Ouvert 7j/7 · 11h00 – 02h00";
  }

  // 5. Boutons d'action rapide (Appel, WhatsApp, Instagram)
  const L = [];
  if (INFO.phone) {
    L.push(
      `<a id="callBtn" class="action-btn" href="tel:${INFO.phone.replace(/\D/g, "")}">${ICON.phone} <span id="callText">${INFO.phone}</span></a>`,
    );
  }
  if (INFO.whatsapp) {
    L.push(
      `<a id="whatsAppBtn" class="action-btn" href="https://wa.me/${INFO.whatsapp.replace(/\D/g, "")}" target="_blank" rel="noopener">${ICON.wa}</a>`,
    );
  }
  if (INFO.instagram) {
    L.push(
      `<a id="instaBtn" class="action-btn" href="${INFO.instagram}" target="_blank" rel="noopener">${ICON.insta}</a>`,
    );
  }
  if ($("infoList")) $("infoList").innerHTML = L.join("");

  // 6. Footer dynamique
  if ($("footerRestoName")) $("footerRestoName").textContent = INFO.name || "Pizzeria Kamal";
  if ($("footerRestoTagline")) {
    $("footerRestoTagline").textContent = INFO.tagline || "";
    $("footerRestoTagline").hidden = !INFO.tagline;
  }
  if ($("footerRestoAddress")) $("footerRestoAddress").textContent = `📍 ${INFO.address || "Témara"}`;
  if ($("footerRestoContact")) {
    const wa = INFO.whatsapp ? ` · WhatsApp : ${INFO.whatsapp}` : "";
    $("footerRestoContact").textContent = `📞 ${INFO.phone || ""}${wa}`;
  }
  if ($("footerRestoHours")) $("footerRestoHours").textContent = `🕒 ${INFO.hours || "Ouvert 7j/7 de 11h00 à 02h00"}`;
  if ($("footerCopyName")) $("footerCopyName").textContent = INFO.name || "Pizzeria Kamal";

  // 7. Modale 1 : Infos & Horaires
  if ($("modalInfoAddress")) $("modalInfoAddress").textContent = INFO.address || "Témara";
  if ($("modalInfoMapsLink") && INFO.maps) {
    $("modalInfoMapsLink").href = INFO.maps;
  }
  if ($("modalInfoHours")) {
    $("modalInfoHours").innerHTML = `Lundi au Dimanche : <strong>${esc(INFO.hours || "11h00 – 02h00")}</strong>`;
  }
  if ($("modalInfoPhone")) $("modalInfoPhone").textContent = INFO.phone || "";
  if ($("modalInfoPhoneLink") && INFO.phone) {
    $("modalInfoPhoneLink").href = `tel:${INFO.phone.replace(/\D/g, "")}`;
  }
}

/* --------------------------------------------------------------------------
   2. UTILITAIRES
   -------------------------------------------------------------------------- */
const $ = (id) => document.getElementById(id);
const fmt = (v) =>
  typeof v === "number" ? v.toFixed(2).replace(".", ",") + " DH" : v;
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

function getDishPrices(dish, cat) {
  if (Array.isArray(dish?.prices) && dish.prices.length > 0) {
    return dish.prices.map((pr) => ({
      label: (pr.label || "").trim(),
      amount: Number(pr.amount || 0),
    }));
  }
  if (dish?.x !== undefined) {
    const l1 = (cat?.cols && cat.cols[0]) || "1 pers.";
    const l2 = (cat?.cols && cat.cols[1]) || "2 pers.";
    return [
      { label: l1, amount: Number(dish.p || 0) },
      { label: l2, amount: Number(dish.x || 0) },
    ];
  }
  return [
    { label: "", amount: Number(dish?.p || 0) },
  ];
}

function formatPricesForLightbox(prices) {
  if (!prices || prices.length === 0) return "";
  if (prices.length === 1) {
    return fmt(prices[0].amount) + (prices[0].label ? ` (${prices[0].label})` : "");
  }
  return prices.map((pr) => `${pr.label ? pr.label + " : " : ""}${fmt(pr.amount)}`).join(" · ");
}

function renderPricesHtml(prices) {
  if (!prices || prices.length === 0) return "";
  if (prices.length === 1) {
    const pr = prices[0];
    return `
      <div class="dish-single-price">
        <span class="price-number">${fmt(pr.amount)}</span>
        ${pr.label ? `<span class="single-price-label">${esc(pr.label)}</span>` : ""}
      </div>
    `;
  }
  return `
    <div class="dish-multi-prices">
      ${prices.map((pr) => `
        <span class="size-badge">
          <span class="size-name">${esc(pr.label || "Taille")}</span>
          <span class="size-val">${fmt(pr.amount)}</span>
        </span>
      `).join("")}
    </div>
  `;
}

/* --------------------------------------------------------------------------
   3. ÉTAT DE L'APPLICATION
   -------------------------------------------------------------------------- */
let activeGroup = "all";
let currentSearch = "";

/* --------------------------------------------------------------------------
   4. RENDU DE LA VUE 1 : ACCUEIL DES CATÉGORIES
   -------------------------------------------------------------------------- */

// Rendu des filtres de groupes (Tout / Repas / Boissons)
function renderGroupChips() {
  const container = $("groupChips");
  container.innerHTML = GROUPS.map(
    (g) => `
    <button class="group-pill ${g.id === activeGroup ? "active" : ""}" data-group="${g.id}">
      ${g.t}
    </button>
  `,
  ).join("");
}

/* --------------------------------------------------------------------------
   CARROUSEL "NOS MEILLEURS PLATS" (Fluide, Tactile & Interactif)
   -------------------------------------------------------------------------- */
let carouselScrollListener = null;

function setupCarouselEngine(totalCards) {
  const track = $("bestCarouselTrack");
  const prevBtn = $("bestPrevBtn");
  const nextBtn = $("bestNextBtn");
  const dotsContainer = $("bestCarouselDots");

  if (!track) return;

  // Render indicator dots
  if (dotsContainer) {
    dotsContainer.innerHTML = Array.from({ length: totalCards }, (_, i) => `
      <button class="carousel-dot ${i === 0 ? "active" : ""}" data-slide="${i}" aria-label="Plat ${i + 1}"></button>
    `).join("");

    dotsContainer.onclick = (e) => {
      const dot = e.target.closest(".carousel-dot");
      if (!dot) return;
      const idx = Number(dot.dataset.slide);
      const card = track.children[idx];
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      }
    };
  }

  // Update button visibility and active dot on scroll
  const updateControls = () => {
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    const scrollLeft = track.scrollLeft;

    if (prevBtn) prevBtn.disabled = scrollLeft <= 12;
    if (nextBtn) nextBtn.disabled = scrollLeft >= maxScroll - 12;

    if (dotsContainer && track.children.length > 0) {
      const firstCardWidth = track.children[0].offsetWidth || 300;
      const activeIndex = Math.min(
        totalCards - 1,
        Math.max(0, Math.round(scrollLeft / (firstCardWidth + 16)))
      );
      Array.from(dotsContainer.children).forEach((dot, idx) => {
        dot.classList.toggle("active", idx === activeIndex);
      });
    }
  };

  // Nav buttons
  if (prevBtn) {
    prevBtn.onclick = () => {
      const cardWidth = track.children[0]?.offsetWidth || 320;
      track.scrollBy({ left: -(cardWidth + 18), behavior: "smooth" });
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      const cardWidth = track.children[0]?.offsetWidth || 320;
      track.scrollBy({ left: cardWidth + 18, behavior: "smooth" });
    };
  }

  // Remove previous scroll listener if exists
  if (carouselScrollListener) {
    track.removeEventListener("scroll", carouselScrollListener);
  }
  carouselScrollListener = () => {
    requestAnimationFrame(updateControls);
  };
  track.addEventListener("scroll", carouselScrollListener, { passive: true });

  // Initial call
  setTimeout(updateControls, 100);
}

function renderBestDishes() {
  const section = $("bestSection");
  if (!section) return;

  if (currentSearch) {
    section.hidden = true;
    return;
  }

  // Find unique featured dishes that are available
  const selected = [];
  const seen = new Set();
  MENU.forEach((cat) => {
    (cat.i || []).forEach((dish) => {
      if (dish.best && dish.available !== false) {
        const key = `${cat.id}::${dish.n}`;
        if (!seen.has(key)) {
          seen.add(key);
          selected.push({ dish, cat });
        }
      }
    });
  });

  if (selected.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  const track = $("bestCarouselTrack");
  if (!track) return;

  track.innerHTML = selected.map(({ dish, cat }, idx) => {
    const prices = getDishPrices(dish, cat);
    const itemImg = dish.img || cat.img;
    const priceText = formatPricesForLightbox(prices);

    return `
      <article class="best-carousel-card" data-index="${idx}">
        <div class="best-card-image-wrap" data-action="lightbox" data-img="${itemImg}" data-title="${esc(dish.n)}" data-desc="${esc(dish.d || cat.t)}" data-price="${esc(priceText)}">
          <img class="best-card-img" src="${itemImg}" alt="${esc(dish.n)}" loading="lazy" onerror="this.src='${cat.img}'">
          <div class="best-card-badge">⭐ À découvrir</div>
          <div class="best-card-cat-pill">${cat.icon || "🍽️"} ${esc(cat.t)}</div>
          <div class="best-card-zoom-icon" title="Agrandir la photo">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </div>
        </div>
        <div class="best-card-content">
          <h3 class="best-card-title">${esc(dish.n)}</h3>
          ${dish.d ? `<p class="best-card-desc">${esc(dish.d)}</p>` : `<p class="best-card-desc empty">Préparation artisanale selon la recette maison.</p>`}
          <div class="best-card-pricing-row">
            ${renderPricesHtml(prices)}
          </div>
        </div>
      </article>
    `;
  }).join("");

  setupCarouselEngine(selected.length);
}

// Rendu des cartes de catégories sur l'accueil
function renderCategoriesGrid() {
  const container = $("categoriesGrid");
  const filteredCats = MENU.filter(
    (c) => (activeGroup === "all" || c.g === activeGroup) && c.i.some(d => d.available !== false),
  );

  $("categoriesCount").textContent = `${filteredCats.length} catégories`;

  container.innerHTML = filteredCats
    .map(
      (cat) => `
    <a href="#${cat.id}" class="cat-big-card" style="background-image:url(${cat.img})" data-cat="${cat.id}">
      <div class="cat-big-card-content">
        <div class="cat-big-card-info">
          <h3 class="cat-big-title">${cat.icon} ${cat.t}</h3>
          <span class="cat-big-count">${cat.i.filter(d => d.available !== false).length} plats au choix</span>
        </div>
        <div class="cat-big-action" aria-label="Voir les plats">
          <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
      </div>
    </a>
  `,
    )
    .join("");
}

// Rendu d'une carte de plat (Affichage avec support multi-prix)
function renderDishCard(it, cat) {
  const prices = getDishPrices(it, cat);
  const itemImg = it.img || cat.img;
  const priceLightbox = formatPricesForLightbox(prices);

  return `
    <div class="dish-card" data-cat="${cat.id}" data-name="${esc(it.n)}">
      <div class="dish-img-wrap" data-action="lightbox" data-img="${itemImg}" data-title="${esc(it.n)}" data-desc="${esc(it.d || cat.t)}" data-price="${esc(priceLightbox)}">
        <img class="dish-img" src="${itemImg}" alt="${esc(it.n)}" loading="lazy" onerror="this.src='${cat.img}'">
        <div class="dish-zoom-icon" title="Agrandir la photo">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </div>
      </div>
      <div class="dish-info">
        <div class="dish-header">
          <div class="dish-title-line"><h4 class="dish-name">${esc(it.n)}</h4>${it.best ? '<span class="dish-best-badge">⭐ Best</span>' : ''}</div>
          ${it.d ? `<p class="dish-desc">${esc(it.d)}</p>` : ""}
        </div>
        <div class="dish-pricing-row">
          ${renderPricesHtml(prices)}
        </div>
      </div>
    </div>
  `;
}

// Rendu de la recherche en temps réel (sur la vue d'accueil)
function renderSearchResults() {
  const q = norm(currentSearch);
  const searchSec = $("searchResultsSection");
  const catsGrid = $("categoriesGrid");
  const metaHeader = $("homeSectionHeader");

  if (!q) {
    renderBestDishes();
    searchSec.hidden = true;
    catsGrid.hidden = false;
    metaHeader.hidden = false;
    $("clearSearchBtn").hidden = true;
    return;
  }

  $("clearSearchBtn").hidden = false;
  searchSec.hidden = false;
  catsGrid.hidden = true;
  metaHeader.hidden = true;

  const hits = [];
  MENU.forEach((cat) => {
    cat.i.forEach((it) => {
      const matchText = norm(it.n + " " + (it.d || "") + " " + cat.t);
      if (matchText.includes(q) && it.available !== false) {
        hits.push({ item: it, cat: cat });
      }
    });
  });

  if (hits.length === 0) {
    searchSec.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">Aucun plat trouvé</h3>
        <p>Essayez avec un autre mot comme "tacos", "burger", "kefta", "panini" ou "jus".</p>
        <button class="btn-reset-search" id="resetSearchBtn">Effacer la recherche</button>
      </div>
    `;
    $("resetSearchBtn")?.addEventListener("click", () => {
      $("searchInput").value = "";
      currentSearch = "";
      renderSearchResults();
    });
    return;
  }

  searchSec.innerHTML = `
    <div class="search-results-header">
      Résultats pour "<strong>${currentSearch}</strong>" (${hits.length} plats trouvés) :
    </div>
    <div class="items-list">
      ${hits.map(({ item, cat }) => renderDishCard(item, cat)).join("")}
    </div>
  `;
}

/* --------------------------------------------------------------------------
   5. RENDU DE LA VUE 2 : DÉTAIL D'UNE CATÉGORIE
   -------------------------------------------------------------------------- */
function renderCategoryDetail(catId) {
  const cat = MENU.find((m) => m.id === catId);
  if (!cat) {
    // Si la catégorie n'existe pas, retour à l'accueil
    location.hash = "#home";
    return;
  }

  // Barre supérieure
  $("detailBarTitle").textContent = `${cat.icon} ${cat.t}`;

  // Sous-barre horizontale des catégories
  const subBar = $("subCategoryTabs");
  subBar.innerHTML = MENU.map(
    (c) => `
    <a href="#${c.id}" class="sub-cat-pill ${c.id === cat.id ? "active" : ""}">
      <span>${c.icon}</span>
      <span>${c.t}</span>
    </a>
  `,
  ).join("");

  // Bannière Hero
  const banner = $("detailHeroBanner");
  banner.style.backgroundImage = `url(${cat.img})`;
  // $("detailHeroBadge").textContent = cat.badge || "Spécialité";
  $("detailHeroTitle").textContent = `${cat.icon} ${cat.t}`;
  $("detailHeroCount").textContent =
    `${cat.i.filter(d => d.available !== false).length} plats au choix préparés à la commande`;

  // Liste des plats
  const itemsContainer = $("detailItemsList");
  const visibleDishes = cat.i.filter(dish => dish.available !== false);
  itemsContainer.innerHTML = visibleDishes.length
    ? visibleDishes.map((dish) => renderDishCard(dish, cat)).join("")
    : '<div class="empty-state"><h3>Aucun plat disponible</h3><p>Cette catégorie sera bientôt de retour.</p></div>';

  // Scroll en haut
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* --------------------------------------------------------------------------
   6. ROUTEUR SIMPLE PAR HASH (#home vs #tacos, #burgers, etc.)
   -------------------------------------------------------------------------- */
function route() {
  const rawHash = (location.hash || "").replace("#", "").trim();
  const isHome = !rawHash || rawHash === "home";

  const homeView = $("homeView");
  const detailView = $("detailView");

  if (isHome) {
    homeView.hidden = false;
    detailView.hidden = true;
    $("searchInput").value = "";
    currentSearch = "";
    renderSearchResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    homeView.hidden = true;
    detailView.hidden = false;
    renderCategoryDetail(rawHash);
  }
}

/* --------------------------------------------------------------------------
   7. MODAL LIGHTBOX & INFOS
   -------------------------------------------------------------------------- */
function openLightbox(imgUrl, title, desc, price) {
  $("lightboxImg").src = imgUrl;
  $("lightboxTitle").textContent = title;
  $("lightboxDesc").textContent = desc;
  $("lightboxPrice").textContent = price;
  $("lightboxModal").hidden = false;
}

function closeLightbox() {
  $("lightboxModal").hidden = true;
}

/* --------------------------------------------------------------------------
   8. ÉCOUTEURS D'ÉVÉNEMENTS
   -------------------------------------------------------------------------- */
function initEventListeners() {
  // Navigation hash (changement d'écran au clic sur une catégorie ou retour)
  window.addEventListener("hashchange", route);

  // Bouton retour
  $("backToHomeBtn").addEventListener("click", (e) => {
    e.preventDefault();
    location.hash = "#home";
  });

  // Sélecteur de groupes (Repas / Boissons / Tout)
  $("groupChips").addEventListener("click", (e) => {
    const pill = e.target.closest("[data-group]");
    if (!pill) return;
    activeGroup = pill.dataset.group;
    renderGroupChips();
    renderCategoriesGrid();
  });

  // Recherche en direct
  $("searchInput").addEventListener("input", (e) => {
    currentSearch = e.target.value;
    renderSearchResults();
  });

  $("clearSearchBtn").addEventListener("click", () => {
    $("searchInput").value = "";
    currentSearch = "";
    renderSearchResults();
  });

  // Thème Sombre / Clair

  $("themeToggle").addEventListener("click", () => {
    const curr = document.documentElement.getAttribute("data-theme");
    const next = curr === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("menu-theme", next);
  });

  // Modal Infos & Horaires
  const openInfo = () => ($("infoModal").hidden = false);
  const closeInfo = () => ($("infoModal").hidden = true);

  $("infoBtn").addEventListener("click", openInfo);
  $("detailInfoBtn").addEventListener("click", openInfo);
  $("closeInfoBtn").addEventListener("click", closeInfo);
  $("infoModal").addEventListener("click", (e) => {
    if (e.target === $("infoModal")) closeInfo();
  });

  // Modal Lightbox
  $("closeLightboxBtn").addEventListener("click", closeLightbox);
  $("lightboxModal").addEventListener("click", (e) => {
    if (e.target === $("lightboxModal")) closeLightbox();
  });

  // Clic sur l'image d'un plat pour zoomer
  document.addEventListener("click", (e) => {
    const lightboxTrigger = e.target.closest('[data-action="lightbox"]');
    if (lightboxTrigger) {
      const { img, title, desc, price } = lightboxTrigger.dataset;
      openLightbox(img, title, desc, price);
    }
  });
}

/* --------------------------------------------------------------------------
   9. INITIALISATION
   -------------------------------------------------------------------------- */
function init() {
  $("currentYear").textContent = new Date().getFullYear();

  renderInfo();
  renderBestDishes();
  renderGroupChips();
  renderCategoriesGrid();
  initEventListeners();
  route();
  syncRemoteMenu();
}

document.addEventListener("DOMContentLoaded", init);
