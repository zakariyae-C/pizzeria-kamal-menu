/**
 * CLOUDFLARE WORKER BACKEND API & STATIC ASSETS
 * Project: Pizzeria Kamal - Digital Menu & Admin SaaS
 *
 * Hosting & Security Architecture (100% Cloudflare Free Plan):
 * - Cloudflare Worker: Edge execution & request handling
 * - Cloudflare D1: SQLite relational database for menu, categories, prices & admin auth
 * - Workers Static Assets: Native zero-cost edge delivery for menu & dashboard
 * - Custom Session Authentication: PBKDF2 password hashing & HttpOnly secure cookies
 * - Brute-Force Protection: In-database rate limiting and lockouts
 * - CSRF & Origin Defense: Custom headers and origin verification
 * - 0 R2 dependencies, 0 Cloudflare Access dependencies
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // 1. API Routes
      if (url.pathname.startsWith("/api/")) {
        // Handle CORS Preflight
        if (request.method === "OPTIONS") {
          return handleCors(request, env);
        }
        const response = await handleApiRequest(request, env, ctx);
        return applySecurityHeaders(response, request, env);
      }

      // 2. Route rewrite: /admin or /admin/ -> /admin.html
      if (url.pathname === "/admin" || url.pathname === "/admin/") {
        const adminUrl = new URL("/admin.html", request.url);
        if (env.ASSETS) {
          return env.ASSETS.fetch(new Request(adminUrl, request));
        }
      }

      // 3. Static Assets (index.html, style.css, app.js, admin.html, img/, etc.)
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response("Not found", { status: 404 });
    } catch (fatalError) {
      console.error("Fatal Worker Exception:", fatalError);
      return jsonResponse(
        {
          error:
            "Erreur interne du serveur: " +
            (fatalError?.message || String(fatalError)),
        },
        500,
      );
    }
  },
};

// ============================================================================
// API ROUTING & DISPATCHER
// ============================================================================

async function handleApiRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // ------------------------------------------------------------------------
    // PUBLIC ROUTES (Digital menu customers & public visitors)
    // ------------------------------------------------------------------------
    if (path === "/api/health" && method === "GET") {
      return jsonResponse({
        status: "healthy",
        timestamp: new Date().toISOString(),
      });
    }

    if (path === "/api/menu" && method === "GET") {
      return await handleGetMenu(env);
    }

    if (path === "/api/settings" && method === "GET") {
      return await handleGetSettings(env);
    }

    // Auth status & login/logout endpoints
    if (path === "/api/auth/status" && method === "GET") {
      return await handleAuthStatus(request, env);
    }

    if (path === "/api/auth/login" && method === "POST") {
      return await handleLogin(request, env);
    }

    if (path === "/api/auth/setup" && method === "POST") {
      return await handleFirstAdminSetup(request, env);
    }

    if (path === "/api/auth/logout" && method === "POST") {
      return await handleLogout(request, env);
    }

    // ------------------------------------------------------------------------
    // PROTECTED ADMIN ROUTES (Require valid session cookie)
    // ------------------------------------------------------------------------
    const auth = await authenticateAdminSession(request, env);
    if (!auth.authorized) {
      return jsonResponse(
        { error: auth.error || "Accès refusé. Veuillez vous connecter." },
        401,
      );
    }

    // Verify CSRF for state-changing requests
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const csrfValid = validateCsrf(request, env);
      if (!csrfValid) {
        return jsonResponse(
          { error: "Échec de validation de sécurité CSRF." },
          403,
        );
      }
    }

    // Admin Identity
    if (path === "/api/auth/me" && method === "GET") {
      return jsonResponse({
        authenticated: true,
        email: auth.user.email,
        role: "admin",
      });
    }

    // Stats Overview
    if (path === "/api/stats" && method === "GET") {
      return await handleGetStats(env);
    }

    // Dishes Management
    if (path === "/api/dishes" && method === "POST") {
      const body = await request.json();
      return await handleCreateDish(body, env);
    }

    if (path.startsWith("/api/dishes/") && method === "PUT") {
      const id = path.split("/").pop();
      const body = await request.json();
      return await handleUpdateDish(id, body, env);
    }

    if (path.startsWith("/api/dishes/") && method === "DELETE") {
      const id = path.split("/").pop();
      return await handleDeleteDish(id, env);
    }

    if (
      path.startsWith("/api/dishes/") &&
      path.endsWith("/status") &&
      method === "PATCH"
    ) {
      const parts = path.split("/");
      const id = parts[parts.length - 2];
      const body = await request.json();
      return await handlePatchDishStatus(id, body, env);
    }

    // Categories Management
    if (path === "/api/categories" && method === "POST") {
      const body = await request.json();
      return await handleCreateCategory(body, env);
    }

    if (path.startsWith("/api/categories/") && method === "PUT") {
      const id = path.split("/").pop();
      const body = await request.json();
      return await handleUpdateCategory(id, body, env);
    }

    if (path.startsWith("/api/categories/") && method === "DELETE") {
      const id = path.split("/").pop();
      return await handleDeleteCategory(id, env);
    }

    if (path === "/api/categories/reorder" && method === "PUT") {
      const body = await request.json();
      return await handleReorderCategories(body, env);
    }

    // Settings Management
    if (path === "/api/settings" && method === "PUT") {
      const body = await request.json();
      return await handleUpdateSettings(body, env);
    }

    // Menu Batch Synchronization
    if (path === "/api/menu/sync" && method === "POST") {
      const body = await request.json();
      return await handleBatchSync(body, env);
    }

    return jsonResponse({ error: "Route API introuvable" }, 404);
  } catch (err) {
    console.error("Worker Execution Error:", err);
    return jsonResponse({ error: "Erreur interne du serveur." }, 500);
  }
}

// ============================================================================
// CRYPTOGRAPHY & AUTHENTICATION ENGINE (WEB CRYPTO API)
// ============================================================================

const SESSION_COOKIE_NAME = "kamal_admin_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PBKDF2_ITERATIONS = 100000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes

/**
 * Derives a PBKDF2-HMAC-SHA256 password hash.
 * Supported natively by Cloudflare Workers Web Crypto API.
 */
async function hashPassword(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const saltBytes = hexToUint8Array(saltHex);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: iterations,
      hash: "SHA-256",
    },
    passwordKey,
    256, // 32 bytes = 256 bits
  );
  return uint8ArrayToHex(new Uint8Array(derivedBits));
}

/**
 * Verifies a password against the stored salt and hash using timing-safe comparison.
 */
async function verifyPassword(
  password,
  saltHex,
  storedHashHex,
  iterations = PBKDF2_ITERATIONS,
) {
  const computedHashHex = await hashPassword(password, saltHex, iterations);
  return timingSafeEqual(computedHashHex, storedHashHex);
}

/**
 * Constant-time string equality check to prevent timing attacks.
 */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Generates a cryptographically secure 256-bit random session token (64 hex characters).
 */
function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return uint8ArrayToHex(bytes);
}

/**
 * Hashes a session token with SHA-256 before storing or querying in D1.
 * Even if the database is read, no raw valid session tokens are exposed.
 */
async function hashSessionToken(token) {
  const enc = new TextEncoder();
  const digestBuffer = await crypto.subtle.digest("SHA-256", enc.encode(token));
  return uint8ArrayToHex(new Uint8Array(digestBuffer));
}

function uint8ArrayToHex(arr) {
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToUint8Array(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function getCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function createSessionCookieHeader(token, maxAgeSeconds = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function createClearCookieHeader() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Authenticates the incoming request using the HttpOnly session cookie.
 */
async function authenticateAdminSession(request, env) {
  if (!env.DB) {
    return { authorized: false, error: "Base de données D1 non connectée." };
  }

  const rawToken = getCookie(
    request.headers.get("Cookie"),
    SESSION_COOKIE_NAME,
  );
  if (!rawToken || rawToken.length < 32) {
    return { authorized: false, error: "Authentification requise." };
  }

  try {
    const tokenHash = await hashSessionToken(rawToken);
    const now = Math.floor(Date.now() / 1000);

    const session = await env.DB.prepare(
      `SELECT s.id, s.user_id, s.expires_at, u.email
       FROM admin_sessions s
       JOIN admin_users u ON s.user_id = u.id
       WHERE s.id = ?`,
    )
      .bind(tokenHash)
      .first();

    if (!session) {
      return { authorized: false, error: "Session invalide ou révoquée." };
    }

    if (session.expires_at < now) {
      // Clean up expired session asynchronously
      await env.DB.prepare("DELETE FROM admin_sessions WHERE id = ?")
        .bind(tokenHash)
        .run();
      return {
        authorized: false,
        error: "Session expirée. Veuillez vous reconnecter.",
      };
    }

    return {
      authorized: true,
      user: {
        id: session.user_id,
        email: session.email,
      },
    };
  } catch (err) {
    console.error("Session authentication error:", err);
    return {
      authorized: false,
      error: "Erreur lors de la vérification de la session.",
    };
  }
}

// ============================================================================
// RATE LIMITING & BRUTE FORCE DEFENSE
// ============================================================================

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "127.0.0.1"
  );
}

async function checkRateLimit(key, env) {
  if (!env.DB) return { allowed: true };
  try {
    const now = Math.floor(Date.now() / 1000);
    const record = await env.DB.prepare(
      "SELECT attempt_count, first_attempt_at, locked_until FROM login_attempts WHERE key = ?",
    )
      .bind(key)
      .first();

    if (record) {
      if (record.locked_until > now) {
        const remainingMinutes = Math.ceil((record.locked_until - now) / 60);
        return {
          allowed: false,
          locked: true,
          remainingMinutes,
        };
      }
      // If lockout has passed and more than 15 minutes since first attempt, reset
      if (
        now - record.first_attempt_at > LOCKOUT_DURATION_SECONDS &&
        record.locked_until <= now
      ) {
        await env.DB.prepare("DELETE FROM login_attempts WHERE key = ?")
          .bind(key)
          .run();
        return { allowed: true };
      }
    }
    return { allowed: true };
  } catch (err) {
    console.error("Rate limit check error:", err);
    return { allowed: true };
  }
}

async function recordFailedAttempt(key, env) {
  if (!env.DB) return;
  try {
    const now = Math.floor(Date.now() / 1000);
    const record = await env.DB.prepare(
      "SELECT attempt_count FROM login_attempts WHERE key = ?",
    )
      .bind(key)
      .first();

    if (record) {
      const newCount = (record.attempt_count || 1) + 1;
      const lockedUntil =
        newCount >= MAX_LOGIN_ATTEMPTS ? now + LOCKOUT_DURATION_SECONDS : 0;
      await env.DB.prepare(
        "UPDATE login_attempts SET attempt_count = ?, locked_until = ? WHERE key = ?",
      )
        .bind(newCount, lockedUntil, key)
        .run();
    } else {
      await env.DB.prepare(
        "INSERT INTO login_attempts (key, attempt_count, first_attempt_at, locked_until) VALUES (?, 1, ?, 0)",
      )
        .bind(key, now)
        .run();
    }
  } catch (err) {
    console.error("Record failed attempt error:", err);
  }
}

async function clearLoginAttempts(key, env) {
  if (!env.DB) return;
  try {
    await env.DB.prepare("DELETE FROM login_attempts WHERE key = ?")
      .bind(key)
      .run();
  } catch (_) {}
}

// ============================================================================
// CSRF & ORIGIN PROTECTION
// ============================================================================

function validateCsrf(request, env) {
  const origin = request.headers.get("Origin");
  const secFetchSite = request.headers.get("Sec-Fetch-Site");
  const customHeader =
    request.headers.get("X-Requested-With") ||
    request.headers.get("X-Kamal-Admin");

  // If Sec-Fetch-Site indicates cross-site, reject
  if (secFetchSite === "cross-site") {
    return false;
  }

  // Same-origin verification
  if (origin) {
    const requestUrl = new URL(request.url);
    const allowedOrigin = String(env.ALLOWED_ORIGIN || "")
      .trim()
      .toLowerCase();
    const originLower = origin.toLowerCase();

    // Matches current request host OR configured allowed origin
    if (
      originLower === requestUrl.origin.toLowerCase() ||
      (allowedOrigin && originLower === allowedOrigin)
    ) {
      return true;
    }
    return false;
  }

  // In the absence of Origin header (e.g. some internal GET or non-CORS client),
  // custom header requirement blocks cross-site form submissions
  return !!customHeader;
}

// ============================================================================
// DATABASE SCHEMA AUTO-INITIALIZATION (SELF-HEALING)
// ============================================================================

async function ensureDatabaseSchema(env) {
  if (!env.DB) return;
  try {
    await env.DB.batch([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          iterations INTEGER NOT NULL DEFAULT 100000,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `),
      env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)`,
      ),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS admin_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          user_agent TEXT,
          ip TEXT
        )
      `),
      env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at)`,
      ),
      env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_sessions_user ON admin_sessions(user_id)`,
      ),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS login_attempts (
          key TEXT PRIMARY KEY,
          attempt_count INTEGER DEFAULT 1,
          first_attempt_at INTEGER NOT NULL,
          locked_until INTEGER DEFAULT 0
        )
      `),
      env.DB.prepare(
        `CREATE INDEX IF NOT EXISTS idx_login_attempts_locked ON login_attempts(locked_until)`,
      ),
    ]);
  } catch (err) {
    console.warn("Auto-schema verification notice:", err?.message || err);
  }
}

// ============================================================================
// AUTHENTICATION CONTROLLERS
// ============================================================================

async function handleAuthStatus(request, env) {
  if (!env.DB) {
    return jsonResponse({
      setupRequired: false,
      authenticated: false,
      error: "Base D1 non liée.",
    });
  }

  // Auto-verify and create auth tables if they don't exist yet
  await ensureDatabaseSchema(env);

  try {
    // Check if any admin exists in the database
    let userCount = 0;
    try {
      const userCountRes = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM admin_users",
      ).first();
      userCount = userCountRes ? userCountRes.count : 0;
    } catch (_) {
      userCount = 0;
    }

    const setupRequired = userCount === 0;

    // Check if current user is logged in
    const auth = await authenticateAdminSession(request, env);

    return jsonResponse({
      setupRequired,
      authenticated: auth.authorized,
      email: auth.authorized ? auth.user.email : null,
    });
  } catch (err) {
    console.error("Auth status error:", err);
    return jsonResponse({ setupRequired: false, authenticated: false });
  }
}

async function handleFirstAdminSetup(request, env) {
  if (!env.DB)
    return jsonResponse(
      { error: "Base de données D1 non liée au Worker." },
      503,
    );

  // Auto-verify tables exist
  await ensureDatabaseSchema(env);

  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({ error: "Corps de requête JSON invalide." }, 400);
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  const setupSecret = String(body.setupSecret || "").trim();

  if (!email || !email.includes("@") || email.length > 120) {
    return jsonResponse({ error: "Adresse email invalide." }, 400);
  }

  if (password.length < 8) {
    return jsonResponse(
      { error: "Le mot de passe doit contenir au moins 8 caractères." },
      400,
    );
  }

  // Security check: only allow bootstrap if no admin exists, OR if valid SETUP_SECRET matches
  let userCount = 0;
  try {
    const userCountRes = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM admin_users",
    ).first();
    userCount = userCountRes ? userCountRes.count : 0;
  } catch (err) {
    console.warn("Could not query user count:", err);
  }

  if (userCount > 0) {
    const configuredSecret = String(env.SETUP_SECRET || "").trim();
    if (!configuredSecret || setupSecret !== configuredSecret) {
      return jsonResponse(
        {
          error:
            "Un compte administrateur existe déjà. Pour ajouter un compte supplémentaire, fournissez la clé SETUP_SECRET.",
        },
        403,
      );
    }
  }

  // Generate PBKDF2 salt & hash
  let passwordHash = "";
  let saltHex = "";
  try {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    saltHex = uint8ArrayToHex(saltBytes);
    passwordHash = await hashPassword(password, saltHex, PBKDF2_ITERATIONS);
  } catch (cryptoErr) {
    console.error("Password hash generation error:", cryptoErr);
    return jsonResponse(
      { error: "Erreur lors du chiffrement du mot de passe." },
      500,
    );
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Math.floor(Date.now() / 1000);

  // Insert user into D1
  try {
    await env.DB.prepare(
      "INSERT INTO admin_users (id, email, password_hash, salt, iterations) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(userId, email, passwordHash, saltHex, PBKDF2_ITERATIONS)
      .run();
  } catch (dbErr) {
    console.error("Insert admin user error:", dbErr);
    const msg = String(dbErr?.message || dbErr);
    if (msg.includes("UNIQUE")) {
      return jsonResponse(
        { error: "Un administrateur avec cette adresse email existe déjà." },
        409,
      );
    }
    return jsonResponse({ error: "Erreur base de données D1 : " + msg }, 500);
  }

  // Create immediate login session
  let rawToken = "";
  try {
    rawToken = generateSessionToken();
    const tokenHash = await hashSessionToken(rawToken);
    const expiresAt = now + SESSION_TTL_SECONDS;

    await env.DB.prepare(
      "INSERT INTO admin_sessions (id, user_id, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        tokenHash,
        userId,
        expiresAt,
        request.headers.get("User-Agent") || "",
        getClientIp(request),
      )
      .run();
  } catch (sessErr) {
    console.warn("Session auto-create notice:", sessErr);
  }

  const response = jsonResponse({
    success: true,
    message: "Compte administrateur configuré avec succès.",
    email: email,
  });

  if (rawToken) {
    response.headers.set(
      "Set-Cookie",
      createSessionCookieHeader(rawToken, SESSION_TTL_SECONDS),
    );
  }
  return response;

  response.headers.set(
    "Set-Cookie",
    createSessionCookieHeader(rawToken, SESSION_TTL_SECONDS),
  );
  return response;
}

async function handleLogin(request, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return jsonResponse({ error: "Identifiants requis." }, 400);
  }

  const clientIp = getClientIp(request);
  const ipKey = `ip_${clientIp}`;
  const emailKey = `email_${email}`;

  // 1. Check rate limit
  const ipLimit = await checkRateLimit(ipKey, env);
  if (!ipLimit.allowed) {
    return jsonResponse(
      {
        error: `Trop de tentatives. Votre adresse IP est temporairement bloquée pour ${ipLimit.remainingMinutes} minute(s).`,
      },
      429,
    );
  }

  const emailLimit = await checkRateLimit(emailKey, env);
  if (!emailLimit.allowed) {
    return jsonResponse(
      {
        error: `Trop de tentatives sur ce compte. Veuillez réessayer dans ${emailLimit.remainingMinutes} minute(s).`,
      },
      429,
    );
  }

  // 2. Lookup user in D1
  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, salt, iterations FROM admin_users WHERE email = ?",
  )
    .bind(email)
    .first();

  if (!user) {
    await recordFailedAttempt(ipKey, env);
    await recordFailedAttempt(emailKey, env);
    return jsonResponse({ error: "Email ou mot de passe incorrect." }, 401);
  }

  // 3. Verify PBKDF2 password
  const valid = await verifyPassword(
    password,
    user.salt,
    user.password_hash,
    user.iterations || PBKDF2_ITERATIONS,
  );

  if (!valid) {
    await recordFailedAttempt(ipKey, env);
    await recordFailedAttempt(emailKey, env);
    return jsonResponse({ error: "Email ou mot de passe incorrect." }, 401);
  }

  // 4. Success: clear failed attempts
  await clearLoginAttempts(ipKey, env);
  await clearLoginAttempts(emailKey, env);

  // 5. Create secure session token
  const rawToken = generateSessionToken();
  const tokenHash = await hashSessionToken(rawToken);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;

  await env.DB.prepare(
    "INSERT INTO admin_sessions (id, user_id, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      tokenHash,
      user.id,
      expiresAt,
      request.headers.get("User-Agent") || "",
      clientIp,
    )
    .run();

  const response = jsonResponse({
    success: true,
    email: user.email,
    message: "Connexion réussie.",
  });

  response.headers.set(
    "Set-Cookie",
    createSessionCookieHeader(rawToken, SESSION_TTL_SECONDS),
  );
  return response;
}

async function handleLogout(request, env) {
  const rawToken = getCookie(
    request.headers.get("Cookie"),
    SESSION_COOKIE_NAME,
  );
  if (rawToken && env.DB) {
    try {
      const tokenHash = await hashSessionToken(rawToken);
      await env.DB.prepare("DELETE FROM admin_sessions WHERE id = ?")
        .bind(tokenHash)
        .run();
    } catch (_) {}
  }

  const response = jsonResponse({
    success: true,
    message: "Déconnexion effectuée.",
  });
  response.headers.set("Set-Cookie", createClearCookieHeader());
  return response;
}

// ============================================================================
// D1 DATABASE CONTROLLERS (MENU, DISHES, CATEGORIES, SETTINGS)
// ============================================================================

async function handleGetMenu(env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  // 1. Fetch Categories
  const { results: categories } = await env.DB.prepare(
    "SELECT id, group_id AS g, name AS t, icon, image_url AS img, display_order FROM categories ORDER BY display_order ASC",
  ).all();

  // 2. Fetch Dishes
  const { results: dishes } = await env.DB.prepare(
    "SELECT id, category_id, name AS n, description AS d, image_url AS img, is_available, is_featured AS best, display_order FROM dishes ORDER BY display_order ASC",
  ).all();

  // 3. Fetch Prices
  const { results: prices } = await env.DB.prepare(
    "SELECT dish_id, label, amount, display_order FROM dish_prices ORDER BY display_order ASC",
  ).all();

  // Map category default images for safe fallback
  const categoryImageMap = {};
  categories.forEach((cat) => {
    categoryImageMap[cat.id] = cat.img || "img/logo.webp";
  });

  // Group prices by dish_id
  const priceMap = {};
  prices.forEach((pr) => {
    if (!priceMap[pr.dish_id]) priceMap[pr.dish_id] = [];
    priceMap[pr.dish_id].push({
      label: pr.label,
      amount: pr.amount,
    });
  });

  // Attach dishes to categories
  const dishesByCategory = {};
  dishes.forEach((d) => {
    const dishPrices = priceMap[d.id] || [{ label: "", amount: 0 }];
    const fallbackCategoryImg =
      categoryImageMap[d.category_id] || "img/logo.webp";

    const dishObj = {
      id: d.id,
      n: d.n,
      d: d.d,
      img: d.img || fallbackCategoryImg, // Automatic fallback to category image if missing
      available: d.is_available === 1,
      best: d.best === 1,
      prices: dishPrices,
      p: dishPrices[0] ? dishPrices[0].amount : 0,
      ...(dishPrices[1] ? { x: dishPrices[1].amount } : {}),
    };

    if (!dishesByCategory[d.category_id]) dishesByCategory[d.category_id] = [];
    dishesByCategory[d.category_id].push(dishObj);
  });

  const menu = categories.map((cat) => ({
    id: cat.id,
    g: cat.g,
    t: cat.t,
    icon: cat.icon,
    img: cat.img,
    i: dishesByCategory[cat.id] || [],
  }));

  return jsonResponse(menu);
}

async function handleCreateDish(body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const { categoryId, name, description, image, prices, available, best } =
    body;
  if (!categoryId || !name || !prices || !prices.length) {
    return jsonResponse({ error: "Champs requis manquants." }, 400);
  }

  // Automatic category-based image assignment if image is omitted
  let finalImage = image;
  if (!finalImage) {
    const cat = await env.DB.prepare(
      "SELECT image_url FROM categories WHERE id = ?",
    )
      .bind(categoryId)
      .first();
    finalImage = cat && cat.image_url ? cat.image_url : "img/logo.webp";
  }

  const dishId = `dish_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      dishId,
      categoryId,
      name,
      description || "",
      finalImage || "",
      available !== false ? 1 : 0,
      best ? 1 : 0,
      Date.now(),
    ),
    ...prices.map((pr, idx) =>
      env.DB.prepare(
        "INSERT INTO dish_prices (id, dish_id, label, amount, display_order) VALUES (?, ?, ?, ?, ?)",
      ).bind(
        `price_${Date.now()}_${idx}`,
        dishId,
        pr.label || "",
        pr.amount,
        idx,
      ),
    ),
  ]);

  return jsonResponse({
    success: true,
    id: dishId,
    message: "Plat créé avec succès",
  });
}

async function handleUpdateDish(id, body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const { categoryId, name, description, image, prices, available, best } =
    body;

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE dishes SET category_id = ?, name = ?, description = ?, image_url = ?, is_available = ?, is_featured = ?, updated_at = datetime('now') WHERE id = ?",
    ).bind(
      categoryId,
      name,
      description || "",
      image || "",
      available !== false ? 1 : 0,
      best ? 1 : 0,
      id,
    ),
    // Replace prices
    env.DB.prepare("DELETE FROM dish_prices WHERE dish_id = ?").bind(id),
    ...prices.map((pr, idx) =>
      env.DB.prepare(
        "INSERT INTO dish_prices (id, dish_id, label, amount, display_order) VALUES (?, ?, ?, ?, ?)",
      ).bind(`price_${Date.now()}_${idx}`, id, pr.label || "", pr.amount, idx),
    ),
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

  if (updates.length === 0)
    return jsonResponse({ error: "Aucun champ fourni." }, 400);

  params.push(id);
  await env.DB.prepare(
    `UPDATE dishes SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(...params)
    .run();

  return jsonResponse({ success: true, message: "Statut mis à jour" });
}

async function handleCreateCategory(body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const { id, name, group, icon, image } = body;
  await env.DB.prepare(
    "INSERT INTO categories (id, group_id, name, icon, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, group || "repas", name, icon || "🍽️", image || "", Date.now())
    .run();

  return jsonResponse({ success: true, message: "Catégorie créée" });
}

async function handleUpdateCategory(id, body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const { name, group, icon, image } = body;
  await env.DB.prepare(
    "UPDATE categories SET name = ?, group_id = ?, icon = ?, image_url = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(name, group || "repas", icon || "🍽️", image || "", id)
    .run();

  return jsonResponse({ success: true, message: "Catégorie mise à jour" });
}

async function handleDeleteCategory(id, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);
  await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  return jsonResponse({ success: true, message: "Catégorie supprimée" });
}

async function handleReorderCategories(body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const { order } = body;
  if (!Array.isArray(order))
    return jsonResponse({ error: "Tableau requis." }, 400);

  const statements = order.map((catId, index) =>
    env.DB.prepare("UPDATE categories SET display_order = ? WHERE id = ?").bind(
      index,
      catId,
    ),
  );

  await env.DB.batch(statements);
  return jsonResponse({
    success: true,
    message: "Ordre des catégories mis à jour",
  });
}

async function handleGetSettings(env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);
  const { results } = await env.DB.prepare(
    "SELECT key, value FROM restaurant_settings",
  ).all();
  const settings = {};
  results.forEach((r) => {
    settings[r.key] = r.value;
  });
  return jsonResponse(settings);
}

async function handleUpdateSettings(body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const statements = Object.entries(body).map(([key, val]) =>
    env.DB.prepare(
      "INSERT OR REPLACE INTO restaurant_settings (key, value) VALUES (?, ?)",
    ).bind(key, String(val)),
  );

  await env.DB.batch(statements);
  return jsonResponse({ success: true, message: "Paramètres enregistrés" });
}

async function handleGetStats(env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);

  const [dishesRes, availRes, featRes, catsRes] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM dishes").first(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM dishes WHERE is_available = 1",
    ).first(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM dishes WHERE is_featured = 1",
    ).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM categories").first(),
  ]);

  return jsonResponse({
    totalDishes: dishesRes?.count || 0,
    availableDishes: availRes?.count || 0,
    featuredDishes: featRes?.count || 0,
    totalCategories: catsRes?.count || 0,
  });
}

async function handleBatchSync(body, env) {
  if (!env.DB) return jsonResponse({ error: "Base D1 non liée." }, 503);
  const menu = body?.menu;
  if (!Array.isArray(menu) || menu.length === 0 || menu.length > 100) {
    return jsonResponse(
      { error: "Le menu doit contenir entre 1 et 100 catégories." },
      400,
    );
  }

  // Pre-validate entire snapshot before making any changes
  const normalized = [];
  let dishCount = 0;
  for (let catIndex = 0; catIndex < menu.length; catIndex++) {
    const cat = menu[catIndex];
    if (
      !cat ||
      typeof cat.id !== "string" ||
      !cat.id.trim() ||
      typeof cat.t !== "string" ||
      !cat.t.trim() ||
      !Array.isArray(cat.i)
    ) {
      return jsonResponse(
        { error: `Catégorie invalide à la position ${catIndex + 1}.` },
        400,
      );
    }
    const categoryId = cat.id.trim();
    const catImage = String(cat.img || "").slice(0, 1000);
    const dishes = [];

    for (let dishIndex = 0; dishIndex < cat.i.length; dishIndex++) {
      const dish = cat.i[dishIndex];
      if (!dish || typeof dish.n !== "string" || !dish.n.trim()) {
        return jsonResponse(
          { error: `Plat invalide dans la catégorie ${cat.t}.` },
          400,
        );
      }
      const rawPrices =
        Array.isArray(dish.prices) && dish.prices.length
          ? dish.prices
          : [
              { label: "", amount: dish.p },
              ...(Number.isFinite(Number(dish.x))
                ? [{ label: "", amount: dish.x }]
                : []),
            ];

      if (!rawPrices.length || rawPrices.length > 20) {
        return jsonResponse(
          { error: `Options de prix invalides pour ${dish.n}.` },
          400,
        );
      }

      const prices = rawPrices.map((price, priceIndex) => ({
        label: String(price?.label || "")
          .trim()
          .slice(0, 80),
        amount: Number(price?.amount),
        displayOrder: priceIndex,
      }));

      if (
        prices.some(
          (price) =>
            !Number.isFinite(price.amount) ||
            price.amount < 0 ||
            price.amount > 1000000,
        )
      ) {
        return jsonResponse({ error: `Prix invalide pour ${dish.n}.` }, 400);
      }

      const fallbackId = `dish_${categoryId}_${dishIndex}`.replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );
      // Use existing dish image, or category image if missing
      const dishImg =
        String(dish.img || "").trim() || catImage || "img/logo.webp";

      dishes.push({
        id: String(dish.id || fallbackId).slice(0, 120),
        name: dish.n.trim().slice(0, 160),
        description: String(dish.d || "").slice(0, 2000),
        image: dishImg.slice(0, 1000),
        available: dish.available === false ? 0 : 1,
        featured: dish.best === true ? 1 : 0,
        displayOrder: dishIndex,
        prices,
      });
      dishCount++;
    }

    normalized.push({
      id: categoryId.slice(0, 120),
      group: String(cat.g || "repas").slice(0, 60),
      name: cat.t.trim().slice(0, 120),
      icon: String(cat.icon || "🍽️").slice(0, 40),
      image: catImage,
      displayOrder: catIndex,
      dishes,
    });
  }

  if (dishCount === 0 || dishCount > 2000) {
    return jsonResponse(
      { error: "Le menu doit contenir entre 1 et 2 000 plats." },
      400,
    );
  }

  const statements = [
    env.DB.prepare("DELETE FROM dish_prices"),
    env.DB.prepare("DELETE FROM dishes"),
    env.DB.prepare("DELETE FROM categories"),
  ];

  for (const cat of normalized) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO categories (id, group_id, name, icon, image_url, display_order) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(
        cat.id,
        cat.group,
        cat.name,
        cat.icon,
        cat.image,
        cat.displayOrder,
      ),
    );

    for (const dish of cat.dishes) {
      statements.push(
        env.DB.prepare(
          "INSERT INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).bind(
          dish.id,
          cat.id,
          dish.name,
          dish.description,
          dish.image,
          dish.available,
          dish.featured,
          dish.displayOrder,
        ),
      );

      dish.prices.forEach((price, index) =>
        statements.push(
          env.DB.prepare(
            "INSERT INTO dish_prices (id, dish_id, label, amount, display_order) VALUES (?, ?, ?, ?, ?)",
          ).bind(
            `price_${dish.id}_${index}`.slice(0, 150),
            dish.id,
            price.label,
            price.amount,
            price.displayOrder,
          ),
        ),
      );
    }
  }

  try {
    await env.DB.batch(statements);
    return jsonResponse({
      success: true,
      categories: normalized.length,
      dishes: dishCount,
      message: "Synchronisation D1 réussie",
    });
  } catch (error) {
    console.error("D1 menu synchronization failed:", error?.message || error);
    return jsonResponse({ error: "La synchronisation du menu a échoué." }, 500);
  }
}

// ============================================================================
// RESPONSE FORMATTING & SECURITY HEADERS
// ============================================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

function handleCors(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = String(env.ALLOWED_ORIGIN || "").trim();

  const headers = new Headers();
  if (origin && (origin === allowedOrigin || !allowedOrigin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Requested-With, X-Kamal-Admin",
    );
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(null, { status: 204, headers });
}

function applySecurityHeaders(response, request, env) {
  try {
    const origin = request.headers.get("Origin");
    const allowedOrigin = String(env.ALLOWED_ORIGIN || "").trim();

    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    if (origin && (origin === allowedOrigin || !allowedOrigin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Vary", "Origin");
    }
  } catch (err) {
    console.error("applySecurityHeaders error:", err);
  }
  return response;
}
