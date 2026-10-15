# 🧑‍💻 Portfolio www.olivier-dutoit.fr (v5)

Bienvenue sur le dépôt de [www.olivier-dutoit.fr](https://www.olivier-dutoit.fr), mon portfolio : mes travaux, mon parcours en BTS SIO SISR, et l'état de mon homelab en direct.

> 🐒 La v5 reprend la v4 ([olivierd.fr-v4](https://github.com/Teksya/olivierd.fr-v4), dont tout l'historique est importé ici) et garde son design : sombre, cartes en grille bento, accent bleu. Elle remplace le CDN Tailwind par un CSS compilé et ajoute des sections animées qui montrent l'infrastructure derrière le site.

| Où ? | Quoi ? |
| --- | --- |
| [www.olivier-dutoit.fr](https://www.olivier-dutoit.fr) | Le site en ligne |
| [Ce dépôt](https://github.com/Teksya/www.olivier-dutoit.fr-v5) | Le code du site (branche `v5` pour la nouvelle version) |
| [olivierd.fr-v4](https://github.com/Teksya/olivierd.fr-v4) | La version précédente |
| `/admin` | L'administration : widgets « En direct » et projets |

### 📚 Concept du projet

Un portfolio qui ne se contente pas de lister des projets : il montre aussi ce qui tourne. La page À propos affiche en direct ma musique Spotify, mon statut Discord, mon activité GitHub et l'état des services de mon homelab, relevé sur ma status page.

### 🚀 Fonctionnalités

- **Accueil** en chapitres numérotés, avec un index qui suit la lecture en desktop :
  - **Infrastructure** : les services du homelab en vue isométrique 3D, état et latence en direct (`/api/infra`) ;
  - **Comment ce site est servi** : le trajet d'une requête (à venir) ;
  - **Projets mis en avant** : le projet featured puis les suivants de `projects.json` ;
  - **Compétences**, rangées par domaine.
- **Travaux** : projets filtrables par catégorie, détail dans une fenêtre, données dans `projects.json`.
- **À propos** : parcours, diplômes vérifiables par QR code, et la section « En direct » :
  - Spotify (`/api/spotify`, avec flux en direct sur `/api/spotify/stream`) ;
  - Discord via [Lanyard](https://github.com/Phineas/lanyard) ;
  - GitHub (`/api/github`) ;
  - homelab (`/api/uptime`), lu sur la status page.
- **Status page** : `/api/uptime` (par groupe) et `/api/infra` (par service) partagent une seule lecture de la status page, en cache 60 s.
- **Contact** : formulaire protégé par Cloudflare Turnstile, envoi par SMTP (Nodemailer).
- **Administration** (`/admin`) protégée par un code d'accès : activation des widgets, réglages de la status page, ajout et tri des projets.
- **Pages légales** : mentions légales, confidentialité, CGU, et la politique de confidentialité de l'application Budgie.
- **Accessibilité** : animations coupées avec `prefers-reduced-motion`, focus visible au clavier.

### 🗺️ Feuille de route v5

| Phase | Contenu | État |
| --- | --- | --- |
| 1. Socle | Tailwind v4 compilé, GSAP servi en local | ✅ |
| 2. Accueil | Chapitres, index sticky, cartes harmonisées sur toutes les pages | ✅ |
| 3. Infrastructure | Vue isométrique 3D des services du homelab | ✅ |
| 4. Ce site | Le trajet d'une requête, du visiteur au container Express | ⏳ |

## 🛠️ Lancer en local

Il te faut [Node.js](https://nodejs.org) en version LTS.

1. Installe les dépendances :

```bash
npm install
```

2. Copie `.env.example` en `.env`, puis renseigne au moins `ADMIN_ACCESS_CODE` et `ADMIN_SESSION_SECRET`. Turnstile, SMTP et Spotify sont facultatifs.

3. Lance le site :

```bash
npm start
```

4. Ouvre http://localhost:3000.

> 🎨 Tu modifies des classes Tailwind dans `views/` ou `public/js/` ? Lance `npm run dev:css` dans un second terminal : le CSS se recompile à chaque enregistrement. Avant de commiter, `npm run build:css` produit la version minifiée.

| Commande | Effet |
| --- | --- |
| `npm install` | Installe les dépendances (une fois, après le clone) |
| `npm start` | Lance le serveur sur le port `PORT` (3000 par défaut) |
| `npm run dev` | Lance le serveur avec rechargement automatique (nécessite `nodemon`) |
| `npm run build:css` | Compile `src/css/app.css` vers `public/css/app.css`, minifié |
| `npm run dev:css` | Même chose, en continu à chaque enregistrement |
| `npm run projects:list` | Liste les projets de `projects.json` |
| `npm run projects:add` | Ajoute un projet (questions dans le terminal) |
| `npm run projects:remove` | Supprime un projet |
| `npm run projects:toggle` | Met un projet en avant (featured) ou le retire |
| `npm run projects:reorder` | Change l'ordre des projets |

| Variable (`.env`) | Rôle |
| --- | --- |
| `ADMIN_ACCESS_CODE`, `ADMIN_SESSION_SECRET` | Accès à `/admin` (obligatoire pour l'admin) |
| `CLOUDFLARE_TURNSTILE_SITE_KEY`, `CLOUDFLARE_TURNSTILE_SECRET_KEY` | Anti-robot du formulaire de contact |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`, `TO_EMAIL` | Envoi des messages du formulaire |
| `SPOTIFY_ENABLED`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` | Widget Spotify |
| `KENER_API_KEY` | Clé facultative pour lire la status page |
| `PORT` | Port d'écoute |

> 🔐 Les réglages modifiés depuis `/admin` sont enregistrés dans `admin-config.json` et passent avant les valeurs du `.env`. Ce fichier contient des secrets : il n'est pas versionné. [admin-config.example.json](admin-config.example.json) montre sa forme, sans les secrets.

## 🎨 CSS et librairies front

- **Tailwind CSS v4**, compilé avec `@tailwindcss/cli`. La source est [src/css/app.css](src/css/app.css) : les couleurs, polices et largeurs du site sont dans le bloc `@theme`. [public/styles.css](public/styles.css) y est importé dans un layer `components`, pour que les classes Tailwind gardent la priorité.
- Le CSS compilé [public/css/app.css](public/css/app.css) est **commité** : le serveur n'a rien à construire.
- **GSAP** et **ScrollTrigger** sont installés par npm et servis en local sous `/vendor/gsap/` (seul le dossier `dist` est exposé). Ils ne sont chargés que par les pages qui en ont besoin :

```html
<script src="/vendor/gsap/gsap.min.js" defer></script>
<script src="/vendor/gsap/ScrollTrigger.min.js" defer></script>
```

- Le JavaScript du site est en vanilla, dans des IIFE, au style ES5 (`var`, `function`). Pas de framework front.

> 🟢 Le vert `#22c55e` veut dire « en ligne » partout sur le site. Les verts et rouges de Tailwind v3 sont repris tels quels dans `@theme`, la v4 les ayant changés.

## 🖥️ Chapitre Infrastructure

Chaque container de la scène est un monitor de la status page Uptime Kuma (adresse et page réglées dans `/admin`).

- **Ajouter un service** : ajoute le monitor dans Uptime Kuma, puis place-le dans un groupe de la status page publique. Il apparaît sur l'accueil en deux minutes au plus (cache serveur de 60 s, puis rafraîchissement de la page toutes les 60 s), sous le nom affiché par la status page. L'ordre suit celui des groupes et des monitors.
- **Ce qui sort du serveur** : `/api/infra` ne renvoie que `name`, `group`, `up` et `latency` (en ms, `null` si le monitor n'en mesure pas). Ni id, ni URL, ni hostname, ni message d'erreur.
- **État** : seul le statut 1 d'Uptime Kuma compte comme en ligne ; « pending » et « maintenance » s'affichent hors ligne, comme dans `/api/uptime`.
- **Sans JS, en mobile et pour les lecteurs d'écran** : la liste rendue par le serveur dans `views/partials/infra-iso.ejs`. La scène 3D (`public/js/infra-iso.js`, `src/css/infra-iso.css`) est décorative.

## 🗂️ Structure du projet

```text
.
├── server.js             Le serveur Express : pages, API, admin
├── manage-projects.js    Gestion des projets en ligne de commande
├── projects.json         Les projets affichés sur /work
├── src/css/
│   ├── app.css           Source Tailwind (tokens dans @theme, composants)
│   └── infra-iso.css     Scène isométrique du chapitre Infrastructure
├── public/
│   ├── css/app.css       CSS compilé (commité)
│   ├── styles.css        Styles maison, importés dans app.css
│   ├── admin.css         Styles de l'administration
│   └── js/               Scripts des pages (about.js, effects.js...)
└── views/
    ├── partials/         header, footer, barre latérale de l'admin
    └── *.ejs             Une vue par page
```

## 📜 Licence

Le code est sous licence [Apache 2.0](LICENSE).
