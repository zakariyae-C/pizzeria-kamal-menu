/**
 * CLOUDFLARE WORKER BACKEND API
 * Project: Pizzeria Kamal Digital Menu & SaaS Administration
 * 
 * Stack:
 * - Cloudflare Worker: Edge execution & cryptographic JWT verification
 * - Cloudflare Access: Identity & Access Management (Zero Trust)
 * - Cloudflare D1: SQLite relational database for menu, categories & prices
 * - Cloudflare R2: High-performance object storage for dish photos
 */

export default {
  async fetch(request, env, ctx) {
    const response = await handleRequest(request, env, ctx);
    return applyCors(response, request, env);
  }
};

async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return handleCors();
    }

    // 2. Global Rate Limiter & Security Headers
    try {
      // 3. Routing
      const path = url.pathname;

      // Public Routes (Accessible by digital menu customers)
      if (path === "/api/health" && request.method === "GET") {
        return jsonResponse({ status: "healthy", timestamp: new Date().toISOString() });
      }

      if (path === "/api/menu" && request.method === "GET") {
        return await handleGetMenu(env);
      }

      if (path === "/api/settings" && request.method === "GET") {
        return await handleGetSettings(env);
      }

      if (path.startsWith("/api/images/") && request.method === "GET") {
        return await handleGetImage(decodeURIComponent(path.slice("/api/images/".length)), env);
      }

      // Admin & Protected Routes (Require Cloudflare Access Verification)
      if (path.startsWith("/api/")) {
        const auth = await authenticateAdmin(request, env);
        if (!auth.authorized) {
          return jsonResponse({ error: auth.error || "Accès refusé : administrateur non autorisé." }, 401);
        }

        // Authenticated routes
        if (path === "/api/auth/me" && request.method === "GET") {
          return jsonResponse({ authenticated: true, email: auth.email, role: "admin" });
        }

        if (path === "/api/stats" && request.method === "GET") {
          return await handleGetStats(env);
        }

        if (path === "/api/dishes" && request.method === "POST") {
          const body = await request.json();
          return await handleCreateDish(body, env);
        }

        if (path.startsWith("/api/dishes/") && request.method === "PUT") {
          const id = path.split("/").pop();
          const body = await request.json();
          return await handleUpdateDish(id, body, env);
        }

        if (path.startsWith("/api/dishes/") && request.method === "DELETE") {
          const id = path.split("/").pop();
          return await handleDeleteDish(id, env);
        }

        if (path.startsWith("/api/dishes/") && path.endsWith("/status") && request.method === "PATCH") {
          const parts = path.split("/");
          const id = parts[parts.length - 2];
          const body = await request.json();
          return await handlePatchDishStatus(id, body, env);
        }

        if (path === "/api/categories" && request.method === "POST") {
          const body = await request.json();
          return await handleCreateCategory(body, env);
        }

        if (path.startsWith("/api/categories/") && request.method === "PUT") {
          const id = path.split("/").pop();
          const body = await request.json();
          return await handleUpdateCategory(id, body, env);
        }

        if (path.startsWith("/api/categories/") && request.method === "DELETE") {
          const id = path.split("/").pop();
          return await handleDeleteCategory(id, env);
        }

        if (path === "/api/categories/reorder" && request.method === "PUT") {
          const body = await request.json();
          return await handleReorderCategories(body, env);
        }

        if (path === "/api/settings" && request.method === "PUT") {
          const body = await request.json();
          return await handleUpdateSettings(body, env);
        }

        if (path === "/api/upload" && request.method === "POST") {
          return await handlePhotoUpload(request, env);
        }

        if (path === "/api/menu/sync" && request.method === "POST") {
          const body = await request.json();
          return await handleBatchSync(body, env);
        }
      }

      return jsonResponse({ error: "Route introuvable" }, 404);
    } catch (err) {
      console.error("Worker Execution Error:", err);
      return jsonResponse({ error: "Erreur interne du serveur." }, 500);
    }
  }

// ============================================================================
// CLOUDFLARE ACCESS JWT AUTHENTICATION VERIFIER
// ============================================================================
let cachedCerts = null;
let certsExpiry = 0;

async function authenticateAdmin(request, env) {
  const teamName = String(env.CF_ACCESS_TEAM_NAME || "").trim();
  const expectedAud = String(env.POLICY_AUD || "").trim();
  const allowedEmails = String(env.ALLOWED_ADMIN_EMAILS || "")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);

  // Fail closed when any required production security setting is missing.
  if (!teamName || !expectedAud || allowedEmails.length === 0) {
    console.error("Access configuration incomplete: team, audience and administrator allowlist are required.");
    return { authorized: false, error: "Configuration d'authentification incomplète." };
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion") ||
    getCookie(request.headers.get("Cookie"), "CF_Authorization");
  if (!token) return { authorized: false, error: "Authentification Cloudflare Access requise." };

  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(part => !part)) {
      return { authorized: false, error: "Format de jeton invalide." };
    }
    const decode = value => {
      const binary = atob(base64UrlToBase64(value));
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    };
    const header = decode(parts[0]);
    const payload = decode(parts[1]);

    if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
      return { authorized: false, error: "Algorithme ou clé JWT non autorisé." };
    }
    if (payload.iss !== `https://${teamName}.cloudflareaccess.com`) {
      return { authorized: false, error: "Émetteur du jeton invalide." };
    }
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(expectedAud)) {
      return { authorized: false, error: "Audience du jeton invalide." };
    }
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(payload.exp) || payload.exp <= now) {
      return { authorized: false, error: "Jeton expiré ou sans date d'expiration valide." };
    }
    if (payload.nbf !== undefined && (!Number.isFinite(payload.nbf) || payload.nbf > now)) {
      return { authorized: false, error: "Jeton pas encore valide." };
    }

    const validSignature = await verifyJwtSignature(token, header.kid, teamName);
    if (!validSignature) return { authorized: false, error: "Signature cryptographique invalide." };

    const userEmail = String(payload.email || "").trim().toLowerCase();
    if (!userEmail || !allowedEmails.includes(userEmail)) {
      return { authorized: false, error: "Adresse e-mail non autorisée." };
    }
    return { authorized: true, email: userEmail, payload };
  } catch (err) {
    console.warn("Access JWT validation failed:", err?.message || err);
    return { authorized: false, error: "Jeton d'authentification invalide." };
  }
}

async function verifyJwtSignature(token, kid, teamName) {
  try {
    const now = Date.now();
    if (!cachedCerts || now > certsExpiry) {
      const certsUrl = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/certs`;
      const res = await fetch(certsUrl);
      if (!res.ok) return false;
      const data = await res.json();
      cachedCerts = data.keys || [];
      certsExpiry = now + 3600 * 1000; // Cache 1 hour
    }

    const jwk = cachedCerts.find(k => k.kid === kid);
    if (!jwk) return false;

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const [headerB64, payloadB64, signatureB64] = token.split(".");
    const enc = new TextEncoder();
    const data = enc.encode(`${headerB64}.${payloadB64}`);
    const signature = Uint8Array.from(atob(base64UrlToBase64(signatureB64)), c => c.charCodeAt(0));

    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
  } catch (_) {
    return false;
  }
}

function base64UrlToBase64(str) {
  let output = str.replace(/-/g, "+").replace(/_/g, "/");
  switch (output.length % 4) {
    case 0: break;
    case 2: output += "=="; break;
    case 3: output += "="; break;
    default: throw new Error("Illegal base64url string!");
  }
  return output;
}

function getCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ============================================================================
// D1 DATABASE CONTROLLERS
// ============================================================================

async function handleGetMenu(env) {
  if (!env.DB) {
    // If DB binding is not attached (e.g. static dev), return fallback
    return jsonResponse({ error: "Base D1 non liée." }, 503);
  }

  // 1. Fetch Categories
  const { results: categories } = await env.DB.prepare(
    "SELECT id, group_id AS g, name AS t, icon, image_url AS img, display_order FROM categories ORDER BY display_order ASC"
  ).all();

  // 2. Fetch Dishes
  const { results: dishes } = await env.DB.prepare(
    "SELECT id, category_id, name AS n, description AS d, image_url AS img, is_available, is_featured AS best, display_order FROM dishes ORDER BY display_order ASC"
  ).all();

  // 3. Fetch Prices
  const { results: prices } = await env.DB.prepare(
    "SELECT dish_id, label, amount, display_order FROM dish_prices ORDER BY display_order ASC"
  ).all();

  // Group prices by dish_id
  const priceMap = {};
  prices.forEach(pr => {
    if (!priceMap[pr.dish_id]) priceMap[pr.dish_id] = [];
    priceMap[pr.dish_id].push({
      label: pr.label,
      amount: pr.amount
    });
  });

  // Attach dishes and prices to categories
  const dishesByCategory = {};
  dishes.forEach(d => {
    const dishPrices = priceMap[d.id] || [{ label: "", amount: 0 }];
    const dishObj = {
      id: d.id,
      n: d.n,
      d: d.d,
      img: d.img,
      available: d.is_available === 1,
      best: d.best === 1,
      prices: dishPrices,
      p: dishPrices[0] ? dishPrices[0].amount : 0,
      ...(dishPrices[1] ? { x: dishPrices[1].amount } : {})
    };

    if (!dishesByCategory[d.category_id]) dishesByCategory[d.category_id] = [];
    dishesByCategory[d.category_id].push(dishObj);
  });

  const menu = categories.map(cat => ({
    id: cat.id,
    g: cat.g,
    t: cat.t,
    icon: cat.icon,
    img: cat.img,
    i: dishesByCategory[cat.id] || []
  }));

  return jsonResponse(menu);
}

async function handleCreateDish(body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const { categoryId, name, description, image, prices, available, best } = body;
  if (!categoryId || !name || !prices || !prices.length) {
    return jsonResponse({ error: "Champs requis manquants." }, 400);
  }

  const dishId = `dish_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      dishId,
      categoryId,
      name,
      description || "",
      image || "",
      available !== false ? 1 : 0,
      best ? 1 : 0,
      Date.now()
    ),
    ...prices.map((pr, idx) =>
      env.DB.prepare(
        "INSERT INTO dish_prices (id, dish_id, label, amount, display_order) VALUES (?, ?, ?, ?, ?)"
      ).bind(`price_${Date.now()}_${idx}`, dishId, pr.label || "", pr.amount, idx)
    )
  ]);

  return jsonResponse({ success: true, id: dishId, message: "Plat créé avec succès" });
}

async function handleUpdateDish(id, body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const { categoryId, name, description, image, prices, available, best } = body;

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE dishes SET category_id = ?, name = ?, description = ?, image_url = ?, is_available = ?, is_featured = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(
      categoryId,
      name,
      description || "",
      image || "",
      available !== false ? 1 : 0,
      best ? 1 : 0,
      id
    ),
    // Delete old prices and reinsert updated options
    env.DB.prepare("DELETE FROM dish_prices WHERE dish_id = ?").bind(id),
    ...prices.map((pr, idx) =>
      env.DB.prepare(
        "INSERT INTO dish_prices (id, dish_id, label, amount, display_order) VALUES (?, ?, ?, ?, ?)"
      ).bind(`price_${Date.now()}_${idx}`, id, pr.label || "", pr.amount, idx)
    )
  ]);

  return jsonResponse({ success: true, message: "Plat et tarifs mis à jour" });
}

async function handleDeleteDish(id, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);
  await env.DB.prepare("DELETE FROM dishes WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true, message: "Plat supprimé" });
}

async function handlePatchDishStatus(id, body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const updates = [];
  const params = [];

  if (body.available !== undefined) {
    updates.push("is_available = ?");
    params.push(body.available ? 1 : 0);
  }
  if (body.best !== undefined) {
    updates.push("is_featured = ?");
    params.push(body.best ? 1 : 0);
  }

  if (updates.length === 0) return jsonResponse({ error: "Aucun champ fourni." }, 400);

  params.push(id);
  await env.DB.prepare(`UPDATE dishes SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...params)
    .run();

  return jsonResponse({ success: true, message: "Statut mis à jour" });
}

async function handleCreateCategory(body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const { id, name, group, icon, image } = body;
  await env.DB.prepare(
    "INSERT INTO categories (id, group_id, name, icon, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, group || "repas", name, icon || "🍽️", image || "", Date.now()).run();

  return jsonResponse({ success: true, message: "Catégorie créée" });
}

async function handleUpdateCategory(id, body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const { name, group, icon, image } = body;
  await env.DB.prepare(
    "UPDATE categories SET name = ?, group_id = ?, icon = ?, image_url = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(name, group || "repas", icon || "🍽️", image || "", id).run();

  return jsonResponse({ success: true, message: "Catégorie mise à jour" });
}

async function handleDeleteCategory(id, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);
  await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true, message: "Catégorie supprimée" });
}

async function handleReorderCategories(body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const { order } = body; // Array of IDs in desired order
  if (!Array.isArray(order)) return jsonResponse({ error: "Tableau requis." }, 400);

  const statements = order.map((catId, index) =>
    env.DB.prepare("UPDATE categories SET display_order = ? WHERE id = ?").bind(index, catId)
  );

  await env.DB.batch(statements);
  return jsonResponse({ success: true, message: "Ordre mis à jour" });
}

async function handleGetSettings(env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);
  const { results } = await env.DB.prepare("SELECT key, value FROM restaurant_settings").all();
  const settings = {};
  results.forEach(r => { settings[r.key] = r.value; });
  return jsonResponse(settings);
}

async function handleUpdateSettings(body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const statements = Object.entries(body).map(([key, val]) =>
    env.DB.prepare("INSERT OR REPLACE INTO restaurant_settings (key, value) VALUES (?, ?)").bind(key, String(val))
  );

  await env.DB.batch(statements);
  return jsonResponse({ success: true, message: "Paramètres enregistrés" });
}

async function handleGetStats(env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const [dishesRes, availRes, featRes, catsRes] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM dishes").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM dishes WHERE is_available = 1").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM dishes WHERE is_featured = 1").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM categories").first(),
  ]);

  return jsonResponse({
    totalDishes: dishesRes.count,
    availableDishes: availRes.count,
    featuredDishes: featRes.count,
    totalCategories: catsRes.count,
  });
}

// ============================================================================
// CLOUDFLARE R2 PHOTO UPLOAD CONTROLLER
// ============================================================================

async function handlePhotoUpload(request, env) {
  if (!env.IMAGES_BUCKET) {
    return jsonResponse({ error: "Bucket R2 non configuré." }, 503);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonResponse({ error: "Content-Type doit être multipart/form-data." }, 400);
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return jsonResponse({ error: "Fichier manquant." }, 400);
  }

  // Validate size (max 5 MB)
  if (file.size > 5 * 1024 * 1024) {
    return jsonResponse({ error: "L'image dépasse la limite de 5 Mo." }, 400);
  }

  // Validate MIME type
  // The dashboard converts uploads to WebP in the browser before sending.
  // Accept only WebP here so the stored content type always matches the bytes.
  if (file.type !== "image/webp") {
    return jsonResponse({ error: "Le fichier doit être converti en WebP avant le téléversement." }, 400);
  }

  // Force extension to .webp
  const cleanBase = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  const key = `dishes/${Date.now()}-${cleanBase || "dish"}.webp`;

  await env.IMAGES_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  const publicUrl = env.R2_PUBLIC_DOMAIN
    ? `${String(env.R2_PUBLIC_DOMAIN).replace(/\/$/, "")}/${key}`
    : `/api/images/${encodeURIComponent(key)}`;

  return jsonResponse({
    success: true,
    key: key,
    url: publicUrl,
    message: "Photo téléversée sur Cloudflare R2 avec succès"
  });
}

async function handleGetImage(key, env) {
  if (!env.IMAGES_BUCKET) return jsonResponse({ error: "Bucket R2 non configuré." }, 503);
  if (!key || !key.startsWith("dishes/") || key.split("/").some(part => !part || part === "..") || key.includes("\\")) {
    return jsonResponse({ error: "Clé d'image invalide." }, 400);
  }
  const object = await env.IMAGES_BUCKET.get(key);
  if (!object) return new Response("Image introuvable", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers });
}

async function handleBatchSync(body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);
  const menu = body?.menu;
  if (!Array.isArray(menu) || menu.length === 0 || menu.length > 100) {
    return jsonResponse({ error: "Le menu doit contenir entre 1 et 100 catégories." }, 400);
  }

  // Validate the complete snapshot BEFORE issuing any database changes.
  const normalized = [];
  let dishCount = 0;
  for (let catIndex = 0; catIndex < menu.length; catIndex++) {
    const cat = menu[catIndex];
    if (!cat || typeof cat.id !== "string" || !cat.id.trim() || typeof cat.t !== "string" || !cat.t.trim() || !Array.isArray(cat.i)) {
      return jsonResponse({ error: `Catégorie invalide à la position ${catIndex + 1}.` }, 400);
    }
    const categoryId = cat.id.trim();
    const dishes = [];
    for (let dishIndex = 0; dishIndex < cat.i.length; dishIndex++) {
      const dish = cat.i[dishIndex];
      if (!dish || typeof dish.n !== "string" || !dish.n.trim()) {
        return jsonResponse({ error: `Plat invalide dans la catégorie ${cat.t}.` }, 400);
      }
      const rawPrices = Array.isArray(dish.prices) && dish.prices.length
        ? dish.prices
        : [{ label: "", amount: dish.p }, ...(Number.isFinite(Number(dish.x)) ? [{ label: "", amount: dish.x }] : [])];
      if (!rawPrices.length || rawPrices.length > 20) {
        return jsonResponse({ error: `Options de prix invalides pour ${dish.n}.` }, 400);
      }
      const prices = rawPrices.map((price, priceIndex) => ({
        label: String(price?.label || "").trim().slice(0, 80),
        amount: Number(price?.amount),
        displayOrder: priceIndex
      }));
      if (prices.some(price => !Number.isFinite(price.amount) || price.amount < 0 || price.amount > 1000000)) {
        return jsonResponse({ error: `Prix invalide pour ${dish.n}.` }, 400);
      }
      const fallbackId = `dish_${categoryId}_${dishIndex}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      dishes.push({
        id: String(dish.id || fallbackId).slice(0, 120),
        name: dish.n.trim().slice(0, 160),
        description: String(dish.d || "").slice(0, 2000),
        image: String(dish.img || "").slice(0, 1000),
        available: dish.available === false ? 0 : 1,
        featured: dish.best === true ? 1 : 0,
        displayOrder: dishIndex,
        prices
      });
      dishCount++;
    }
    normalized.push({
      id: categoryId.slice(0, 120),
      group: String(cat.g || "repas").slice(0, 60),
      name: cat.t.trim().slice(0, 120),
      icon: String(cat.icon || "🍽️").slice(0, 40),
      image: String(cat.img || "").slice(0, 1000),
      displayOrder: catIndex,
      dishes
    });
  }
  if (dishCount === 0 || dishCount > 2000) {
    return jsonResponse({ error: "Le menu doit contenir entre 1 et 2 000 plats." }, 400);
  }

  // This endpoint replaces the complete menu snapshot. D1 batch executes
  // the statements atomically; validation above prevents partial/empty imports.
  const statements = [
    env.DB.prepare("DELETE FROM dish_prices"),
    env.DB.prepare("DELETE FROM dishes"),
    env.DB.prepare("DELETE FROM categories")
  ];
  for (const cat of normalized) {
    statements.push(env.DB.prepare(
      "INSERT INTO categories (id, group_id, name, icon, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(cat.id, cat.group, cat.name, cat.icon, cat.image, cat.displayOrder));
    for (const dish of cat.dishes) {
      statements.push(env.DB.prepare(
        "INSERT INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(dish.id, cat.id, dish.name, dish.description, dish.image, dish.available, dish.featured, dish.displayOrder));
      dish.prices.forEach((price, index) => statements.push(env.DB.prepare(
        "INSERT INTO dish_prices (id, dish_id, label, amount, display_order) VALUES (?, ?, ?, ?, ?)"
      ).bind(`price_${dish.id}_${index}`.slice(0, 150), dish.id, price.label, price.amount, price.displayOrder)));
    }
  }
  try {
    await env.DB.batch(statements);
    return jsonResponse({ success: true, categories: normalized.length, dishes: dishCount, message: "Synchronisation D1 réussie" });
  } catch (error) {
    console.error("D1 menu synchronization failed:", error?.message || error);
    return jsonResponse({ error: "La synchronisation a échoué. Le menu en base n'a pas été confirmé comme mis à jour." }, 500);
  }
}

// ============================================================================
// HELPERS & RESPONSE FORMATTERS
// ============================================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
  });
}

function handleCors() {
  return new Response(null, { status: 204 });
}

function applyCors(response, request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = String(env.ALLOWED_ORIGIN || "").trim();
  if (origin && origin !== allowedOrigin) {
    return new Response(JSON.stringify({ error: "Origine non autorisée." }), {
      status: 403,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const headers = new Headers(response.headers);
  if (origin && allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Vary", "Origin");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cf-Access-Jwt-Assertion");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
