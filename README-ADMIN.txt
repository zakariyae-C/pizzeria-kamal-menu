PIZZERIA KAMAL — MENU DIGITAL & TABLEAU DE BORD SAAS

NOUVEAUTÉS & AMÉLIORATIONS MAJEURES :
1. Correction critique du multi-prix :
   - Support complet de plats avec 1 ou plusieurs options de prix (Solo, Normal, XL, 1 pers., 2 pers., etc.).
   - Visualisation de toutes les options de prix existantes lors de la modification.
   - Ajout, édition indépendante et suppression d'options de prix avec validation des montants.
   - Présentation claire des prix multi-tailles sur le menu public sous forme de badges élégants.

2. Carrousel « Nos meilleurs plats » :
   - Section dédiée sur la page d'accueil du menu public.
   - Carrousel moderne, tactile et fluide (swipe sur mobile, flèches de navigation sur desktop).
   - Grandes photos de qualité avec coins arrondis, affichage des prix multiples et badges de sélection.
   - Mise à jour en temps réel lors de la sélection/désélection dans l'administration.
   - Masquage automatique si aucun plat n'est sélectionné.

3. Charte graphique officielle Kamal :
   - Rouge primaire : #CD131A (actions prioritaires et navigation active)
   - Orange : #F09010 (badges, sélections et éléments interactifs)
   - Crème chaleureux : #FCF6E8 (fonds doux et bannières)
   - Brun foncé : #542414 (typographies, titres et structure)
   - Logo officiel Kamal intégré dans la barre latérale.

4. Préparation Cloudflare (pas encore déployée) :
   - Cloudflare Access + vérification JWT stricte dans le Worker (configuration requise avant production).
   - Cloudflare Worker : API avec routes publiques en lecture et routes d'écriture protégées.
   - Cloudflare D1 : base relationnelle avec 99 plats et 17 catégories initiales.
   - Cloudflare R2 : stockage des photos ajoutées par l'administrateur.
   - Le schéma SQL est non destructif et peut être réexécuté sans supprimer les tables ni les données existantes.
   - Consultez CLOUDFLARE_GUIDE.md. Le projet n'est pas encore déployé et nécessite les identifiants Cloudflare réels.

TEST LOCAL RAPIDE :
- Lancez un serveur local (ex. Live Server dans VS Code).
- Ouvrez index.html pour explorer le menu digital et son carrousel d'accueil.
- Ouvrez admin.html pour accéder au tableau de bord administrateur professionnel.
- En local, les modifications restent dans localStorage si aucun Worker authentifié n'est disponible. En production, le tableau de bord charge le menu depuis D1 et affiche clairement si la synchronisation cloud réussit ou échoue.
