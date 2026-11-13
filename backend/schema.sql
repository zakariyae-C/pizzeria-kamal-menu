-- ============================================================================
-- CLOUDFLARE D1 DATABASE SCHEMA & SAFE INITIAL SEEDING
-- Project: Pizzeria Kamal Digital Menu & SaaS Administration
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,         -- 'repas', 'boissons', 'desserts'
  name TEXT NOT NULL,
  icon TEXT DEFAULT '🍽️',
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(display_order);

-- 2. Dishes Table
CREATE TABLE IF NOT EXISTS dishes (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  is_available INTEGER DEFAULT 1, -- 1: disponible, 0: masque
  is_featured INTEGER DEFAULT 0,  -- 1: affiche dans le carrousel 'Nos meilleurs plats'
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dishes_category ON dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_dishes_featured ON dishes(is_featured);

-- 3. Dish Prices Table (Supports 1 or multiple price options per dish)
CREATE TABLE IF NOT EXISTS dish_prices (
  id TEXT PRIMARY KEY,
  dish_id TEXT NOT NULL,
  label TEXT DEFAULT '',          -- 'Solo', 'Normal', 'XL', '1 pers.', '2 pers.', 'Lait', etc.
  amount REAL NOT NULL,           -- Montant en Dirhams (DH)
  display_order INTEGER DEFAULT 0,
  FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prices_dish ON dish_prices(dish_id);

-- 4. Restaurant Settings Table
CREATE TABLE IF NOT EXISTS restaurant_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 5. Admin Users Table (Custom Authentication)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL DEFAULT 100000,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- 6. Admin Sessions Table (Stores SHA-256 hashed session tokens)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  user_agent TEXT,
  ip TEXT,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON admin_sessions(user_id);

-- 7. Login Attempts Table (Brute-force protection)
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  attempt_count INTEGER DEFAULT 1,
  first_attempt_at INTEGER NOT NULL,
  locked_until INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked ON login_attempts(locked_until);

-- ============================================================================
-- INITIAL SEED DATA (INSERT OR IGNORE makes reruns non-destructive)
-- ============================================================================

INSERT OR IGNORE INTO restaurant_settings (key, value) VALUES
  ('name', 'La Pizzeria Kamal'),
  ('tagline', 'ذوق مرة، ورجع ديما'),
  ('desc', 'Pizzas, calzones, pasticcio, tacos, sandwichs, salades, plats et jus.'),
  ('address', '6 Av. Mohammed V, Témara'),
  ('phone', '0664-031519'),
  ('whatsapp', '212664031519'),
  ('wifi', '123456'),
  ('hours', 'Ouvert 7j/7 de 11h00 à 02h00'),
  ('instagram', 'https://www.instagram.com/la_pizzeria_kamal/'),
  ('maps', 'https://maps.app.goo.gl/uqh7U6Wp2MosHEdJ8?g_st=ac');


-- Seeding Categories
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('pizzas', 'repas', 'Pizzas', '🍕', 'img/pizzas.webp', 0);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('calzones', 'repas', 'Calzones', '🥟', 'img/calzones.webp', 1);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('pasticcio', 'repas', 'Pasticcio', '🍝', 'img/pasticcio/pizzeria.webp', 2);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('tacos', 'repas', 'Tacos', '🌯', 'img/tacos.webp', 3);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('sandwichs', 'repas', 'Sandwichs', '🌭', 'img/sandwichs/mixte.webp', 4);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('sandwichs-speciaux', 'repas', 'Sandwichs Spéciaux', '🥪', 'img/sandwichs/fruitsMer.webp', 5);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('paninis', 'repas', 'Paninis', '🥪', 'img/paninis.webp', 6);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('burgers', 'repas', 'Burgers', '🍔', 'img/burgers.webp', 7);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('chawarma', 'repas', 'Chawarma', '🥙', 'img/chawarma.webp', 8);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('plats', 'repas', 'Plats', '🍗', 'img/plats.webp', 9);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('salades', 'repas', 'Salades', '🥗', 'img/salades.webp', 10);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('ration', 'repas', 'Rations', '🍟', 'img/ration.webp', 11);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('enfant', 'repas', 'Menu Enfant', '👶', 'img/enfant.webp', 12);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('supplements', 'repas', 'Suppléments', '➕', 'img/supplements/gratine.webp', 13);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('jus', 'boissons', 'Jus & Smoothies', '🍹', 'img/jus.webp', 14);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('boissons', 'boissons', 'Sodas & Eau', '🥤', 'img/boissons.webp', 15);
INSERT OR IGNORE INTO categories (id, group_id, name, icon, image_url, display_order) VALUES ('desserts', 'desserts', 'Desserts', '🍰', 'img/dessert.webp', 16);

-- Seeding Dishes & Prices
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0001', 'pizzas', 'Margherita', 'Sauce tomate, fromage, olive noire', 'img/pizzas/margherita.webp', 1, 1, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00001', 'dish_0001', '1 pers.', 30.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00002', 'dish_0001', '2 pers.', 55.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0002', 'pizzas', 'Vegetariana', 'Sauce tomate, fromage, légumes grillés', 'img/pizzas/vegetariana.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00003', 'dish_0002', '1 pers.', 32.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00004', 'dish_0002', '2 pers.', 57.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0003', 'pizzas', 'Au thon', 'Sauce tomate, thon, olive noire, oignon, poivron, fromage', 'img/pizzas/thon.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00005', 'dish_0003', '1 pers.', 40.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00006', 'dish_0003', '2 pers.', 68.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0004', 'pizzas', 'Viande hachée', 'Sauce tomate, viande hachée, olive noire, oignon, poivron, fromage', 'img/pizzas/viandeHachee.webp', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00007', 'dish_0004', '1 pers.', 40.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00008', 'dish_0004', '2 pers.', 68.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0005', 'pizzas', 'Poulet', 'Sauce tomate, poulet, olive noire, champignon, fromage', 'img/pizzas/poulet.webp', 1, 0, 4);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00009', 'dish_0005', '1 pers.', 40.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00010', 'dish_0005', '2 pers.', 68.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0006', 'pizzas', '4 Saisons', 'Sauce au choix, thon, fruits de mer, viande hachée, légumes grillés, fromage', 'img/pizzas/saisons.webp', 1, 0, 5);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00011', 'dish_0006', '1 pers.', 48.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00012', 'dish_0006', '2 pers.', 75.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0007', 'pizzas', 'Fruits de mer', 'Sauce au choix, fruits de mer, champignon, olive noire, fromage', 'img/pizzas/fruitsMer.webp', 1, 0, 6);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00013', 'dish_0007', '1 pers.', 48.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00014', 'dish_0007', '2 pers.', 75.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0008', 'pizzas', 'La Pizzeria', 'Sauce au choix, poulet, viande hachée, jumbo, légumes, fruits de mer, champignon, olive noire', 'img/pizzas/pizzeria.webp', 1, 1, 7);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00015', 'dish_0008', '1 pers.', 48.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00016', 'dish_0008', '2 pers.', 75.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0009', 'pizzas', 'Alfredo', 'Sauce blanche, poulet, champignon, jambon, fromage', 'img/pizzas/alfredo.webp', 1, 0, 8);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00017', 'dish_0009', '1 pers.', 45.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00018', 'dish_0009', '2 pers.', 70.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0010', 'pizzas', '4 Fromages', 'Sauce blanche, mozzarella, emmental, cheddar, fromage rouge, bleu', 'img/pizzas/fromages.webp', 1, 0, 9);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00019', 'dish_0010', '1 pers.', 45.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00020', 'dish_0010', '2 pers.', 67.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0011', 'pizzas', 'Pepperoni', 'Sauce tomate, mozzarella, pepperoni, olive noire, poivron, oignon', 'img/pizzas/pepperoni.webp', 1, 0, 10);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00021', 'dish_0011', '1 pers.', 45.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00022', 'dish_0011', '2 pers.', 65.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0012', 'calzones', 'Calzone fruits de mer', 'Champignon, olive', 'img/calzones/fruitsMer.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00023', 'dish_0012', '', 58.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0013', 'calzones', 'Calzone La Pizzeria', 'Champignon, olive, poulet, viande, jambon, thon, calamar, crevette', 'img/calzones/pizzeria.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00024', 'dish_0013', '', 53.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0014', 'calzones', 'Calzone mixte', 'Champignon, olive, poulet, thon, jambon, viande, calamar', 'img/calzones/mixte.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00025', 'dish_0014', '', 48.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0015', 'pasticcio', 'Pasticcio poulet', '', 'img/pasticcio/poulet.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00026', 'dish_0015', '', 45.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0016', 'pasticcio', 'Pasticcio viande hachée', '', 'img/pasticcio/viandeHachee.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00027', 'dish_0016', '', 45.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0017', 'pasticcio', 'Pasticcio fruits de mer', '', 'img/pasticcio/fruitsMer.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00028', 'dish_0017', '', 55.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0018', 'pasticcio', 'Pasticcio La Pizzeria', 'Base de frites ou penne', 'img/pasticcio/pizzeria.webp', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00029', 'dish_0018', '', 50.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0019', 'tacos', 'Poulet', '', 'img/tacos/poulet.webp', 1, 1, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00030', 'dish_0019', '', 40.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0020', 'tacos', 'Dinde', '', 'img/tacos/dinde.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00031', 'dish_0020', '', 40.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0021', 'tacos', 'Nuggets', '', 'img/tacos/nuggets.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00032', 'dish_0021', '', 42.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0022', 'tacos', 'Chawarma', '', 'img/tacos/chawarma.webp', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00033', 'dish_0022', '', 45.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0023', 'tacos', 'Merguez', '', 'img/tacos/merguez.webp', 1, 0, 4);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00034', 'dish_0023', '', 45.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0024', 'tacos', 'Viande hachée', '', 'img/tacos/viandeHachee.webp', 1, 0, 5);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00035', 'dish_0024', '', 45.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0025', 'tacos', 'Cordon bleu', '', 'img/tacos/cordonBleu.webp', 1, 0, 6);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00036', 'dish_0025', '', 48.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0026', 'tacos', 'Crispy Chicken', '', 'img/tacos/crispyChicken.webp', 1, 0, 7);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00037', 'dish_0026', '', 48.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0027', 'tacos', 'Mixte', '', 'img/tacos/mixte.webp', 1, 0, 8);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00038', 'dish_0027', '', 48.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0028', 'tacos', 'Charcuterie + viande hachée', '', 'img/tacos/charcuterieViandeHachee.webp', 1, 0, 9);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00039', 'dish_0028', '', 48.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0029', 'tacos', 'Royale mixte', '', 'img/tacos/royaleMixte.webp', 1, 0, 10);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00040', 'dish_0029', '', 54.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0030', 'sandwichs', 'Poulet', '', 'img/sandwichs/poulet.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00041', 'dish_0030', '', 25.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0031', 'sandwichs', 'Dinde', '', 'img/sandwichs/dinde.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00042', 'dish_0031', '', 25.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0032', 'sandwichs', 'Viande hachée', '', 'img/sandwichs/viandeHachee.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00043', 'dish_0032', '', 28.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0033', 'sandwichs', 'Saucisses', '', 'img/sandwichs/saucisses.webp', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00044', 'dish_0033', '', 28.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0034', 'sandwichs', 'Mixte', '', 'img/sandwichs/mixte.webp', 1, 0, 4);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00045', 'dish_0034', '', 30.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0035', 'sandwichs', 'Mixte royale', '', 'img/sandwichs/mixteRoyal.webp', 1, 0, 5);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00046', 'dish_0035', '', 38.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0036', 'sandwichs-speciaux', 'Sandwich poulet', '', 'img/sandwichs/poulet.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00047', 'dish_0036', '', 42.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0037', 'sandwichs-speciaux', 'Sandwich viande hachée', '', 'img/sandwichs/viandeHachee.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00048', 'dish_0037', '', 45.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0038', 'sandwichs-speciaux', 'Sandwich mixte', '', 'img/sandwichs/mixte.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00049', 'dish_0038', '', 48.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0039', 'sandwichs-speciaux', 'Sandwich fruits de mer', '', 'img/sandwichs/fruitsMer.webp', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00050', 'dish_0039', '', 55.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0040', 'paninis', 'Thon', '', '', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00051', 'dish_0040', '', 24.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0041', 'paninis', 'Saucisses', '', '', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00052', 'dish_0041', '', 30.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0042', 'paninis', 'Dinde', '', '', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00053', 'dish_0042', '', 30.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0043', 'paninis', 'Viande hachée', '', '', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00054', 'dish_0043', '', 30.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0044', 'paninis', 'Poulet', '', '', 1, 0, 4);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00055', 'dish_0044', '', 30.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0045', 'paninis', 'Mixte', '', '', 1, 0, 5);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00056', 'dish_0045', '', 32.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0046', 'paninis', 'Fruits de mer', '', '', 1, 0, 6);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00057', 'dish_0046', '', 43.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0047', 'burgers', 'Cheese Burger', '', '', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00058', 'dish_0047', '', 38.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0048', 'burgers', 'Chicken Cheese', '', '', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00059', 'dish_0048', '', 38.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0049', 'burgers', 'Egg Cheese Burger', '', '', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00060', 'dish_0049', '', 40.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0050', 'burgers', 'Double Hamburger', '', '', 1, 1, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00061', 'dish_0050', '', 55.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0051', 'burgers', 'Royale Chicken Cheese', '', '', 1, 0, 4);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00062', 'dish_0051', '', 55.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0052', 'chawarma', 'Simple (Rghif)', '', '', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00063', 'dish_0052', '', 30.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0053', 'chawarma', 'Simple + fromage', '', '', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00064', 'dish_0053', '', 32.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0054', 'chawarma', 'Sans garniture', '', '', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00065', 'dish_0054', '', 35.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0055', 'chawarma', 'Chawarma plat', '', '', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00066', 'dish_0055', '', 50.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0056', 'plats', 'Poulet', '', 'img/plats/poulet.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00067', 'dish_0056', '', 55.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0057', 'plats', 'Dinde', '', 'img/plats/dinde.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00068', 'dish_0057', '', 55.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0058', 'plats', 'Viande hachée', '', 'img/plats/viandeHachee.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00069', 'dish_0058', '', 57.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0059', 'plats', 'Saucisses', '', 'img/plats/saucisses.webp', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00070', 'dish_0059', '', 57.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0060', 'plats', 'Cordon bleu', '', 'img/plats/cordonBleu.webp', 1, 0, 4);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00071', 'dish_0060', '', 60.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0061', 'plats', 'Crispy', '', 'img/plats/crispy.webp', 1, 0, 5);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00072', 'dish_0061', '', 60.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0062', 'plats', 'Mixte', '', 'img/plats/mixte.webp', 1, 0, 6);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00073', 'dish_0062', '', 60.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0063', 'plats', 'Royale mixte', '', 'img/plats/royaleMixte.webp', 1, 0, 7);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00074', 'dish_0063', '', 67.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0064', 'plats', 'Émincé de poulet', '', 'img/plats/nuggets.webp', 1, 0, 8);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00075', 'dish_0064', '', 75.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0065', 'salades', 'Salade variée', 'Salade verte, carotte, betterave, pâtes, riz, tomate, pomme de terre, thon, maïs, œuf', 'img/salades/variee.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00076', 'dish_0065', '', 27.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0066', 'salades', 'Salade niçoise', 'Salade verte, carotte, betterave, pâtes, riz, tomate, pomme de terre, thon, maïs, œuf, fromage rouge', 'img/salades/nicoise.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00077', 'dish_0066', '', 32.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0067', 'salades', 'Salade dinde', 'Salade verte, carotte, betterave, pâtes, riz, tomate, pomme de terre, thon, maïs, œuf, Dinde', 'img/salades/dinde.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00078', 'dish_0067', '', 40.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0068', 'salades', 'Salade maison', 'Riz, pâtes, fromage rouge, jambon, thon, maïs, poulet', 'img/salades/maison.webp', 1, 1, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00079', 'dish_0068', '', 45.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0069', 'salades', 'Salade du chef', 'Salade composée avec dinde fumée, jambon et poulet', 'img/salades/chef.webp', 1, 0, 4);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00080', 'dish_0069', '', 55.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0070', 'ration', 'Cordon bleu', '', 'img/rations/cordonBleu.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00081', 'dish_0070', '', 40.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0071', 'ration', 'Crispy Chicken', '', 'img/rations/crispyChicken.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00082', 'dish_0071', '', 40.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0072', 'ration', 'Nuggets', '', 'img/rations/nuggets.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00083', 'dish_0072', '', 25.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0073', 'enfant', 'Menu enfant', 'Au choix : Cheese Burger, Nuggets ou Mini Tacos. Avec frites, jus et Egg Surprise.', '', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00084', 'dish_0073', '', 40.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0074', 'supplements', 'Charcuterie', '', 'img/supplements/charcuterie.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00085', 'dish_0074', '', 8.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0075', 'supplements', 'Fromage rouge', '', 'img/supplements/fromage.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00086', 'dish_0075', '', 10.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0076', 'supplements', 'Riz', '', 'img/supplements/riz.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00087', 'dish_0076', '', 12.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0077', 'supplements', 'Légumes', '', 'img/supplements/legumes.webp', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00088', 'dish_0077', '', 15.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0078', 'supplements', 'Nuggets (4 pièces)', '', 'img/supplements/nuggets.webp', 1, 0, 4);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00089', 'dish_0078', '', 15.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0079', 'supplements', 'Tacos gratiné', 'Supplément pour tacos', 'img/supplements/gratine.webp', 1, 0, 5);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00090', 'dish_0079', '', 15.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0080', 'supplements', 'Crispy Chicken', '', 'img/supplements/crispyChicken.webp', 1, 0, 6);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00091', 'dish_0080', '', 20.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0081', 'supplements', 'Viande hachée', '', 'img/supplements/viandeHachee.webp', 1, 0, 7);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00092', 'dish_0081', '', 20.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0082', 'supplements', 'Fruits de mer', '', 'img/supplements/fruitsMer.webp', 1, 0, 8);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00093', 'dish_0082', '', 30.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0083', 'jus', 'Jus de citron', '', 'img/jus/citron.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00094', 'dish_0083', '', 15.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0084', 'jus', 'Jus d''orange', '', 'img/jus/orange.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00095', 'dish_0084', '', 16.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0085', 'jus', 'Jus de pomme', '', 'img/jus/pomme.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00096', 'dish_0085', 'Lait', 15.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00097', 'dish_0085', 'Orange', 18.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0086', 'jus', 'Jus de banane', '', 'img/jus/banane.webp', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00098', 'dish_0086', 'Lait', 15.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00099', 'dish_0086', 'Orange', 20.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0087', 'jus', 'Jus d''avocat', '', 'img/jus/avocat.webp', 1, 0, 4);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00100', 'dish_0087', 'Lait', 20.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00101', 'dish_0087', 'Orange', 24.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0088', 'jus', 'Panaché au lait', '', 'img/jus/panacheLait.webp', 1, 1, 5);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00102', 'dish_0088', 'Lait', 18.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00103', 'dish_0088', 'Orange', 22.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0089', 'jus', 'Panaché orange', '', 'img/jus/panacheOrange.webp', 1, 0, 6);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00104', 'dish_0089', '', 22.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0090', 'jus', 'Avocat fruits secs', '', 'img/jus/avocat.webp', 1, 0, 7);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00105', 'dish_0090', 'Lait', 25.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00106', 'dish_0090', 'Orange', 28.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0091', 'jus', 'Salade de fruits', '', 'img/jus/saladeFruits.webp', 1, 0, 8);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00107', 'dish_0091', 'Lait', 17.0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00108', 'dish_0091', 'Orange', 25.0, 1);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0092', 'boissons', 'Soda (canette)', '', 'img/boissons/soda.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00109', 'dish_0092', '', 7.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0093', 'boissons', 'Soda Maxi', '', 'img/boissons/soda1.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00110', 'dish_0093', '', 9.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0094', 'boissons', 'Soda 1 L', '', 'img/boissons/soda1.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00111', 'dish_0094', '', 15.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0095', 'boissons', 'Eau minérale 0,5 L', '', 'img/boissons/eau05.webp', 1, 0, 3);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00112', 'dish_0095', '', 5.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0096', 'boissons', 'Eau minérale 1,5 L', '', 'img/boissons/eau1.webp', 1, 0, 4);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00113', 'dish_0096', '', 7.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0097', 'desserts', 'Tiramisu', 'KitKat, Oreo, Maltesers, Twix, Kinder, Snickers, Nutella, Milka', 'img/desserts/tiramisu.webp', 1, 0, 0);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00114', 'dish_0097', '', 20.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0098', 'desserts', 'Crème caramel', '', 'img/desserts/cremeCaramel.webp', 1, 0, 1);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00115', 'dish_0098', '', 15.0, 0);
INSERT OR IGNORE INTO dishes (id, category_id, name, description, image_url, is_available, is_featured, display_order) VALUES ('dish_0099', 'desserts', 'Panacotta', '', 'img/desserts/panacotta.webp', 1, 0, 2);
  INSERT OR IGNORE INTO dish_prices (id, dish_id, label, amount, display_order) VALUES ('price_00116', 'dish_0099', '', 17.0, 0);
