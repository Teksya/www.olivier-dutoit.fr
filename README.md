# 🧑‍💻 Portfolio www.olivier-dutoit.fr (v5)

Bienvenue sur le dépôt de [www.olivier-dutoit.fr](https://www.olivier-dutoit.fr), mon portfolio : mes travaux, mon parcours en BTS SIO SISR, et l'état de mon homelab en direct.

> 🐒 La v5 reprend la v4 ([olivierd.fr-v4](https://github.com/Teksya/olivierd.fr-v4), dont tout l'historique est importé ici) et garde son design : sombre, cartes arrondies, accent bleu. Elle remplace le CDN Tailwind par un CSS compilé et regroupe tout le site sur une seule page, racontée en chapitres.

| Où ? | Quoi ? |
| --- | --- |
| [www.olivier-dutoit.fr](https://www.olivier-dutoit.fr) | Le site en ligne |
| [Ce dépôt](https://github.com/Teksya/www.olivier-dutoit.fr-v5) | Le code du site (branche `v5` pour la nouvelle version) |
| [olivierd.fr-v4](https://github.com/Teksya/olivierd.fr-v4) | La version précédente |
| `/admin` | L'administration : widgets « En direct » et projets |

### 📚 Concept du projet

Un portfolio qui ne se contente pas de lister des projets : il montre aussi ce qui tourne. Le chapitre « En direct » affiche ma musique Spotify, mon statut Discord, mon activité GitHub et l'état des services de mon homelab, relevé sur ma status page.

### 🚀 Fonctionnalités

- **Une seule page** (`/`) en chapitres numérotés. Le header sert d'index : il suit la lecture et met en évidence le chapitre en cours, en desktop comme en mobile.
  - **Projets** : filtres par technologie, détail dans une fenêtre, données dans `projects.json`.
  - **Parcours** : frise et vérification du diplôme par QR code.
  - **En direct** : Spotify (`/api/spotify`, flux `/api/spotify/stream`), Discord via [Lanyard](https://github.com/Phineas/lanyard), GitHub (`/api/github`) et homelab (`/api/uptime`, cache 60 s). Chapitre masqué si tous les widgets sont désactivés.
  - **Compétences**, rangées par domaine.
  - **Comment ce site est servi** : le trajet d'une requête (votre navigateur, Cloudflare, reverse proxy, container Express, réponse), avec les contrôles de chaque étape. Un chemin se trace au défilement, un paquet lumineux le parcourt et chaque étape franchie passe au vert (`public/js/request-flow.js`, `src/css/request-flow.css`). Les étapes et leurs contrôles sont en tête de `views/partials/chapters/ce-site.ejs` ; ceux marqués `verifie: false` sont génériques, à confirmer avec la configuration réelle.
  - **Contact** : formulaire protégé par Cloudflare Turnstile, envoi par SMTP (Nodemailer). Après l'envoi, retour sur `/?contact=<code>#contact` avec le message.
- **Anciennes adresses** : `/work`, `/about` et `/contact` redirigent (301) vers leur chapitre.
- **Performance** : le script des widgets et celui de Turnstile ne se chargent qu'à l'approche de leur chapitre (`data-lazy-script`, géré par `public/js/chapters.js`).
- **Chapitres** : la liste (titres, textes, ordre) est dans `getHomeChapters()` de `server.js`, chaque chapitre a son partial dans `views/partials/chapters/`.
- **Administration** (`/admin`) protégée par un code d'accès : activation des widgets, réglages de la status page, ajout et tri des projets.
- **Pages légales** : mentions légales, confidentialité, CGU, et la politique de confidentialité de l'application Budgie.
- **Accessibilité** : animations coupées avec `prefers-reduced-motion`, focus visible au clavier.

### 🗺️ Feuille de route v5

| Phase | Contenu | État |
| --- | --- | --- |
| 1. Socle | Tailwind v4 compilé, GSAP servi en local | ✅ |
| 2. Une seule page | Tout le site en chapitres, header en index, redirections des anciennes pages | ✅ |
| 3. Hero homelab | Scène pixel art en hero (moteur [cat-abw-iso3d-webanim](https://github.com/Teksya/cat-abw-iso3d-webanim)) : intégration, vraies données, interactions, Blue grandit, finitions | ✅ |
| 4. Ce site | Le trajet d'une requête, du visiteur au container Express | ✅ (contrôles Cloudflare et proxy à confirmer) |

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
| `npm run vendor:cat` | Copie le moteur de la scène pixel art et ses affiches dans `vendor/cat-scene/` |
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

## 🐈 Hero : la scène pixel art

Le haut de l'accueil montre mon bureau et ma baie en pixel art, avec Blue, ma chatonne, qui vit sa vie. La scène vient de mon moteur [cat-abw-iso3d-webanim](https://github.com/Teksya/cat-abw-iso3d-webanim) (préréglage `portfolio`), cloné à côté de ce dépôt.

- **Mettre à jour le moteur** : dans le dépôt du moteur, `npm run export:portfolio` (affiches jour et nuit, par thème, et leur version légère pour mobile), puis ici `npm run vendor:cat`. Les fichiers copiés dans `vendor/cat-scene/` sont commités et servis sous `/vendor/cat-scene/`, avec une empreinte dans l'URL (cache long). Autre emplacement du moteur : `CAT_ENGINE_DIR=/chemin npm run vendor:cat`.
- **Chargement** : l'affiche (jour de 8 h à 19 h, heure de Paris, sinon nuit ; version du thème saisonnier actif ; version légère sous 640 px) est préchargée et s'affiche tout de suite. Après le chargement de la page et la première interaction (souris, doigt, défilement, clavier) ou 8 s, [public/js/hero-homelab.js](public/js/hero-homelab.js) charge le moteur, mesure le temps de rendu, puis le canvas prend le relais : qualité `hd`, `standard` si la machine est juste, ou l'affiche seule si c'est trop lent. Rien ne tourne en `prefers-reduced-motion`.
- **Mobile** : cadrage vertical sur la baie et l'arbre à chat, sans les activités hors champ. Un tap caresse Blue, un appui long allume le laser.
- **Pause** : bouton en haut à droite, mémorisé dans le navigateur.
- **Accessibilité** : une fois lancé, le canvas est l'image décrite (`role="img"`, texte mis à jour selon ce que fait Blue et l'état du homelab) et l'affiche est masquée aux lecteurs d'écran. L'état du homelab est aussi en texte (rendu par le serveur, mis à jour toutes les 60 s). Sans JS : l'affiche, et l'état du homelab affiché sous le hero.

### 🖱️ Interactions

- **Zones cliquables** : un bouton transparent par appareil associé à un groupe Kuma, découpé à la forme de sa façade, et un sur Blue. Accessibles au clavier (Tab), avec une infobulle au survol ou au focus (« Stockage · en ligne · 42 ms », « Blue · 2 mois », âge calculé en direct depuis `data-cat-birth` du partial). Un clic sur un appareil ouvre un panneau : état et latence de chaque groupe, heure du relevé, lien vers la status page ; Échap le ferme.
- **Incident** : quand un appareil tombe, Blue va s'asseoir devant la baie et le fixe (une fois par appareil toutes les 10 minutes au plus, jamais pendant le laser).
- **La nuit**, la sieste sur la baie est plus fréquente.
- **Laser** : double-clic à la souris, appui long au doigt (l'indice s'affiche sous le bouton Pause).
- **Blue grandit** : ses proportions suivent son âge (`data-cat-birth` du partial, naissance estimée au 15 août 2026) jusqu'à l'âge adulte, à 12 mois.
- **Anniversaire d'adoption** (14 septembre, `data-cat-adoption`) : fanions, gâteau avec une bougie par année, chapeau de fête. Plage réglée dans `config/homelab-scene.json`, prioritaire sur Halloween et Noël.
- **Code Konami** : sur l'accueil, Blue fait la fête (zoomies puis cœurs) ; ailleurs, les confettis. `effects.js` émet un événement `konami` annulable, que le hero intercepte.

### 🟢 Les vrais états du homelab

Les voyants de la baie reflètent la status page Uptime Kuma, via `GET /api/homelab` (rafraîchi toutes les 60 s) :

| Champ | Contenu |
| --- | --- |
| `global` | `up`, `degraded`, `down` ou `unknown` (Kuma injoignable), calculé sur tous les groupes de la status page |
| `groups` | Un élément par groupe configuré : nom public, appareil, état, latence max en ms |
| `devices` | État par appareil de la baie (le pire des groupes qui lui sont associés) |
| `time` | Heure de Paris |
| `weather` | Code météo WMO d'Open-Meteo pour Saint-Étienne (cache 20 min, côté serveur) |
| `theme` | Thème saisonnier actif (`halloween`, `noel`, `anniversaire`) ou `null` |

Ni IP, ni port, ni hostname, ni URL de monitor : seulement des noms publics et des états.

La correspondance se règle dans [config/homelab-scene.json](config/homelab-scene.json) (relu au démarrage du serveur) :

```json
{
  "seuilLatenceMs": 500,
  "groupes": {
    "Nom du groupe dans Kuma": { "appareil": "nas", "nomPublic": "Stockage" }
  },
  "meteo": { "latitude": 45.4397, "longitude": 4.3872 },
  "themes": [{ "nom": "halloween", "du": "10-20", "au": "11-02" }]
}
```

- **Appareils** : `fw` (pare-feu), `switch`, `server` (serveur 2U), `nas`, `isp` (box internet), `mini` (mini PC), `ups` (onduleur).
- **États** : `up` (voyants animés), `degraded` (orange fixe : groupe en ligne mais latence au-dessus de `seuilLatenceMs`), `down` (rouge fixe), `unknown` (éteints). Un appareil sans groupe associé reste éteint : jamais de vert sans donnée.
- **Ajouter un service** : crée le monitor dans Kuma et place-le dans un groupe de la status page publique. Si ce groupe est déjà dans `groupes`, il compte tout de suite ; sinon ajoute le groupe avec son appareil et son nom public, puis redémarre le serveur.
- **Écran du bureau** : `OK n/m`, `DEGRADE`, `PANNE n/m` ou `INCONNU`.
- La validation est faite par `validateHomelabSceneConfig()` dans `server.js`, réutilisable par une future page d'admin avant d'écrire le fichier.

## 📖 Mode d'emploi

**Ajouter un service** : crée le monitor dans Uptime Kuma et range-le dans un groupe de la status page publique. Si le groupe est déjà associé à un appareil dans `config/homelab-scene.json`, il compte tout de suite (deux minutes au plus : cache serveur de 60 s, puis rafraîchissement de la page). Il apparaît dans l'infobulle et le panneau de l'appareil, et dans l'état du homelab en texte.

**Changer la correspondance** : dans `config/homelab-scene.json`, la clé de `groupes` est le nom exact du groupe dans Kuma, `appareil` est l'un de `fw`, `switch`, `server`, `nas`, `isp`, `mini`, `ups`, et `nomPublic` est ce que voient les visiteurs. Plusieurs groupes peuvent partager un appareil (le pire état l'emporte). Redémarre le serveur après la modification. Un appareil sans groupe reste éteint.

**Ajouter un thème** :
1. Dans le moteur, ajoute une section comme *Halloween*, *Noël* ou *Anniversaire* dans `src/cat-scene.js` : un drapeau (`var XX = opt.theme === 'nom'`), une partie fixe dessinée une fois, une partie animée appelée à chaque image, et si besoin un chapeau (`HAT`, couleurs dans `surfColor`).
2. Ajoute le nom à la liste du mode `posters` de `tools/export.js`, puis `npm run export:portfolio` et `npm run build:wallpaper`.
3. Ici : `npm run vendor:cat`, puis une plage dans `themes` de `config/homelab-scene.json` (`{ "nom": "...", "du": "MM-JJ", "au": "MM-JJ" }`, la première plage qui correspond l'emporte).

**Quand Blue grandit** : son âge est recalculé à chaque chargement de page à partir de sa date de naissance (15 août 2026). Jusqu'à 12 mois, son corps s'allonge (jusqu'à +25 %) et s'épaissit (+12 %), ses pattes et sa queue s'allongent (+30 %), et sa tête garde sa taille, donc paraît plus petite ; la croissance est rapide les premiers mois, puis ralentit. À 12 mois (mi-août 2027), elle a ses proportions d'adulte et ne change plus. Ses activités ne changent pas avec l'âge. Les affiches montrent le modèle de 2 mois : pour qu'elles suivent, relance de temps en temps dans le moteur `npm run export:portfolio -- --age=<mois>` (12 une fois adulte), puis ici `npm run vendor:cat`. Chaque 14 septembre, une bougie de plus sur le gâteau (5 au plus).

**Performances** (Lighthouse 12.6, accueil, en local derrière une compression gzip comme en production) :

| | Perf | Accessibilité | Bonnes pratiques | SEO | LCP | TBT |
| --- | --- | --- | --- | --- | --- | --- |
| v4 mobile | 80 | 90 | 100 | 100 | 4,1 s | 0 ms |
| v5 mobile | 87 | 96 | 100 | 100 | 3,5 s | 0 ms |
| v4 desktop | 99 | 90 | 100 | 100 | 0,8 s | 0 ms |
| v5 desktop | 98 | 96 | 100 | 100 | 1,1 s | 0 ms |

## 🗂️ Structure du projet

```text
.
├── server.js             Le serveur Express : pages, API, admin
├── scripts/vendor-cat.js Copie du moteur de la scène pixel art (npm run vendor:cat)
├── vendor/cat-scene/     Moteur et affiches du hero (commités)
├── config/homelab-scene.json  Groupes Kuma -> appareils de la baie, météo, thèmes
├── manage-projects.js    Gestion des projets en ligne de commande
├── projects.json         Les projets du chapitre Projets
├── src/css/app.css       Source Tailwind (tokens dans @theme, composants)
├── public/
│   ├── css/app.css       CSS compilé (commité)
│   ├── styles.css        Styles maison, importés dans app.css
│   ├── admin.css         Styles de l'administration
│   └── js/               Scripts (chapters.js, effects.js, about.js...)
└── views/
    ├── index.ejs         La page unique : hero puis chapitres
    ├── partials/         header (index des chapitres), footer, admin
    │   └── chapters/     Un partial par chapitre (projets, parcours, en-direct...)
    └── *.ejs             Pages légales, erreurs, admin
```

## 📜 Licence

Le code est sous licence [Apache 2.0](LICENSE).
