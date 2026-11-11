# Guide de Déploiement Cloudflare & Sécurité · Pizzeria Kamal

Ce document détaille l'architecture et les étapes exactes pour déployer le Menu Digital et le Tableau de bord d'Administration de la **Pizzeria Kamal** sur l'infrastructure Cloudflare (Zero Trust, Worker, D1, R2 et Pages).

---

## 1. Architecture de Production

```
                                  [ Visiteurs / Clients ]
                                             │
                                             ▼
                                  Cloudflare Pages (CDN)
                              (index.html, style.css, app.js)
                                             │
                        ┌────────────────────┴────────────────────┐
                        ▼                                         ▼
            [ GET /api/menu (Public) ]               [ /admin.html (Protégé) ]
                        │                                         │
                        │                                         ▼
                        │                            Cloudflare Access (Zero Trust)
                        │                         (Vérification Email & Jeton JWT)
                        │                                         │
                        └────────────────────┬────────────────────┘
                                             ▼
                                  Cloudflare Worker (API)
                                    (backend/worker.js)
                                             │
                        ┌────────────────────┴────────────────────┐
                        ▼                                         ▼
                Cloudflare D1                            Cloudflare R2
         (Base SQLite relationnelle)                 (Photos & Médias HD)
     - Catégories, Plats, Multi-prix             - WebP, JPG, PNG compressés
```

---

## 2. Prérequis Cloudflare (Offre Gratuite)

Tous les services utilisés sont compatibles avec le forfait gratuit de Cloudflare :
- **Cloudflare Pages** : Hébergement frontend illimité.
- **Cloudflare Workers** : 100 000 requêtes / jour.
- **Cloudflare D1** : 5 millions de lectures / jour, 100 000 écritures / jour.
- **Cloudflare R2** : 10 Go de stockage gratuit, 0 frais de bande passante sortante.
- **Cloudflare Access (Zero Trust)** : Gratuit jusqu'à 50 utilisateurs administrateurs.

---

## 3. Guide de Déploiement Étape par Étape

### Étape 1 : Créer la Base de Données Cloudflare D1

1. Installez ou utilisez Wrangler via le terminal :
   ```bash
   npx wrangler login
   ```
2. Créez la base de données D1 :
   ```bash
   npx wrangler d1 create kamal-menu-db
   ```
3. Copiez le `database_id` affiché dans le terminal et collez-le dans `backend/wrangler.toml` :
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "kamal-menu-db"
   database_id = "VOTRE_DATABASE_ID_ICI"
   ```
4. Exécutez le schéma et l'amorçage des 99 plats et tarifs :
   ```bash
   # En local pour tester :
   npx wrangler d1 execute kamal-menu-db --local --file=backend/schema.sql

   # En production sur Cloudflare :
   npx wrangler d1 execute kamal-menu-db --remote --file=backend/schema.sql
   ```

---

### Étape 2 : Créer le Bucket Cloudflare R2 pour les Photos

1. Créez le bucket d'images :
   ```bash
   npx wrangler r2 bucket create kamal-menu-images
   ```
2. Le bucket est automatiquement lié au Worker via la directive dans `wrangler.toml` :
   ```toml
   [[r2_buckets]]
   binding = "IMAGES_BUCKET"
   bucket_name = "kamal-menu-images"
   ```
3. *(Optionnel)* Dans le tableau de bord Cloudflare R2, activez un domaine public personnalisé (ex: `images.pizzeriakamal.com`) pour des URLs directes.

---

### Étape 3 : Configurer l'Authentification Cloudflare Access (CRITIQUE)

Pour interdire tout accès non autorisé à `admin.html` et aux routes API de modification :

1. Rendez-vous sur le **tableau de bord Cloudflare Zero Trust** (`dash.teams.cloudflare.com`).
2. Allez dans **Access** > **Applications** > **Add an application** > **Self-hosted**.
3. Renseignez les informations de l'application :
   - **Application name** : `Pizzeria Kamal Admin`
   - **Application domain** : `admin.pizzeriakamal.com` (ou votre domaine/chemin).
4. Définissez la politique d'accès (**Access Policy**) :
   - **Policy name** : `Administrateurs Autorisés`
   - **Action** : `Allow`
   - **Rule** : `Include` > `Emails` > Saisissez les emails autorisés (ex: `admin@pizzeriakamal.com`).
5. Dans l'onglet **Overview** de l'application créée, repérez le tag **Application Audience (AUD)**.
6. Copiez ce tag dans `backend/wrangler.toml` :
   ```toml
   [vars]
   CF_ACCESS_TEAM_NAME = "votre-equipe-cloudflare"
   POLICY_AUD = "votre-tag-aud-ici"
   ALLOWED_ADMIN_EMAILS = "VOTRE_EMAIL_ADMIN"
   ALLOWED_ORIGIN = "https://VOTRE-DOMAINE.FR"
   ```
   Supprimez toute valeur d'exemple et remplacez-la par les vraies valeurs. `DEV_MODE` n'existe plus : aucun bypass d'authentification n'est disponible.

> **Important :** Le Worker échoue volontairement en mode fermé si le nom d'équipe, l'audience ou la liste des administrateurs ne sont pas configurés. Il vérifie la signature RS256, l'émetteur, l'audience, l'expiration et l'adresse e-mail autorisée. La sécurité doit encore être validée sur le vrai domaine après configuration d'Access. Protégez la page `/admin.html*` avec Access et gardez le Worker API sur le même domaine afin que le cookie `CF_Authorization` soit transmis au Worker. Les routes de modification restent vérifiées par le Worker même si quelqu'un appelle l'API directement.

---

### Étape 4 : Déployer le Backend Cloudflare Worker

Depuis le dossier `backend` :
```bash
cd backend
npx wrangler deploy
```

Le Worker est déployé, mais ne connectez pas encore le frontend à une URL `workers.dev` séparée. Pour cette version, configurez une route Worker sur le même domaine que le site, par exemple `votre-domaine.fr/api/*`, et utilisez `ALLOWED_ORIGIN = "https://votre-domaine.fr"`. Cela permet au navigateur d'envoyer le cookie Cloudflare Access au Worker. Le domaine Pages et la route Worker doivent être configurés avant le test final.

---

### Étape 5 : Déployer le Frontend sur Cloudflare Pages

1. Déployez le dossier racine contenant `index.html`, `admin.html`, `app.js`, `admin.js`, `style.css`, `admin.css`, `menu-data.js` et le dossier `img/` :
   ```bash
   npx wrangler pages deploy . --project-name=pizzeria-kamal-menu
   ```
2. Associez le domaine personnalisé au projet Pages.
3. Créez une route Worker `votre-domaine.fr/api/*` vers `pizzeria-kamal-api`.
4. Configurez l'application Cloudflare Access pour protéger `votre-domaine.fr/admin.html*` (et les autres chemins d'administration si vous en ajoutez). Le Worker vérifie lui-même le cookie Access sur toutes les routes de modification.
5. Ne protégez pas `/api/menu`, `/api/settings` en lecture ni `/api/images/*` avec une règle Access globale : ces ressources doivent rester accessibles aux clients du menu. Les routes d'écriture restent protégées par le Worker.

---

## 4. Test en Local (Sans Déploiement Requis)

Le projet a été spécialement conçu pour fonctionner de manière transparente en local :

1. **Test Standard (Navigateur Local) :**
   - Ouvrez le dossier dans VS Code et lancez l'extension **Live Server** (ou via un serveur HTTP local comme `python -m http.server 8000`).
   - Ouvrez `index.html` : découvrez le menu public, les filtres et le nouveau **Carrousel « Nos meilleurs plats »**.
   - Ouvrez `admin.html` :
     - Accédez au tableau de bord avec les couleurs officielles de Kamal (#CD131A, #F09010, #FCF6E8, #542414).
     - Modifiez une pizza : constatez que **toutes les options de prix** (1 pers., 2 pers., etc.) s'affichent correctement.
     - Ajoutez une nouvelle taille de pizza (ex. « Grande Faim / 3 pers. » à 75 DH) et enregistrez.
     - Rechargez `index.html` : le plat affiche instantanément toutes ses options de prix !
     - Basculez un plat dans « Nos meilleurs plats » : il apparaît ou disparaît automatiquement du carrousel de l'accueil.
     - Utilisez le bouton **« Exporter JSON »** pour sauvegarder le catalogue à tout moment.

2. **Test du Worker avec Wrangler (Backend Local) :**
   ```bash
   cd backend
   npx wrangler dev
   ```
   Le Worker démarre en local avec émulation SQLite D1 et variables d'environnement.

---

## 5. Liste des Variables d'Environnement

| Variable | Description | Exemple |
|---|---|---|
| `DB` | Liaison Cloudflare D1 | Binding configuré dans `wrangler.toml` |
| `IMAGES_BUCKET` | Liaison Bucket Cloudflare R2 | Binding configuré dans `wrangler.toml` |
| `CF_ACCESS_TEAM_NAME` | Nom d'équipe Cloudflare Zero Trust | `pizzeria-kamal` |
| `POLICY_AUD` | Tag AUD de l'application Access | `6b89...c14a` |
| `ALLOWED_ADMIN_EMAILS` | Liste des emails administrateurs | `admin@pizzeriakamal.com,gerant@pizzeriakamal.com` |
| `ALLOWED_ORIGIN` | Origine exacte du frontend autorisée par CORS | `https://votre-domaine.fr` |
| `R2_PUBLIC_DOMAIN` | *(Optionnel)* URL publique du bucket R2 | `https://images.pizzeriakamal.com` |


## 6. Sécurité et sauvegarde des données

- `backend/schema.sql` est désormais idempotent : les tables et index utilisent `IF NOT EXISTS`, les données initiales utilisent `INSERT OR IGNORE`, et aucun `DROP TABLE` n'est exécuté.
- Le endpoint `/api/menu/sync` remplace le snapshot complet du menu dans D1. Il valide le contenu avant l'écriture et utilise un batch D1. N'envoyez ce snapshot qu'à partir du tableau de bord administrateur autorisé.
- Faites une sauvegarde D1 avant toute migration ou import initial en production.
- Le dashboard conserve aussi une copie locale de secours dans `localStorage`; en production, il charge d'abord le menu et les paramètres depuis D1. Si la synchronisation échoue, l'interface affiche un avertissement et ne prétend pas que le cloud a été mis à jour.
- Les photos importées sont stockées dans R2. Si aucun domaine public R2 n'est configuré, elles sont servies par le Worker via `/api/images/...`.
- CORS n'est pas un mécanisme d'authentification : la protection réelle des opérations d'écriture est la validation JWT et la liste d'administrateurs dans le Worker.
- Avant toute mise en production, testez une connexion autorisée, une connexion non autorisée, un appel API direct sans jeton, l'ajout/modification/suppression d'un plat, et un upload R2.
