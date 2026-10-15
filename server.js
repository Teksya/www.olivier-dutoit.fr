const express = require('express');
const path = require('path');
const https = require('https');
const querystring = require('querystring');
const nodemailer = require('nodemailer');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const projectsPath = path.join(__dirname, 'projects.json');
const adminConfigPath = path.join(__dirname, 'admin-config.json');
function loadProjects() {
	delete require.cache[require.resolve(projectsPath)];
	return require(projectsPath);
}

function saveProjects(projects) {
	fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2) + '\n', 'utf8');
}

function parseBoolean(value) {
	if (typeof value === 'boolean') return value;
	const normalized = String(value || '').trim().toLowerCase();
	return normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes';
}

function loadAdminConfig() {
	const legacySlug = String(process.env.UPTIME_SLUG || '').trim();
	const defaults = {
		SPOTIFY_ENABLED: process.env.SPOTIFY_ENABLED === 'true',
		SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
		SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
		SPOTIFY_REFRESH_TOKEN: process.env.SPOTIFY_REFRESH_TOKEN || '',
		DISCORD_ENABLED: process.env.DISCORD_ENABLED !== 'false',
		DISCORD_USER_ID: process.env.DISCORD_USER_ID || '293855276665405440',
		DISCORD_USERNAME: process.env.DISCORD_USERNAME || 'Teksya',
		DISCORD_AVATAR_URL: process.env.DISCORD_AVATAR_URL || 'https://cdn.discordapp.com/avatars/293855276665405440/c0b1517c692b47673ddcfc35214514f3.webp?size=80',
		GITHUB_ENABLED: process.env.GITHUB_ENABLED !== 'false',
		GITHUB_USERNAME: process.env.GITHUB_USERNAME || 'Teksya',
		GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
		HOMELAB_ENABLED: process.env.HOMELAB_ENABLED !== 'false',
		HOMELAB_NAME: process.env.HOMELAB_NAME || 'Homelab',
		SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI || 'https://www.olivier-dutoit.fr/callback',
		KENER_BASE: process.env.KENER_BASE || process.env.UPTIME_BASE || 'status.olivier-dutoit.fr',
		KENER_PAGE_PATH: process.env.KENER_PAGE_PATH || (legacySlug && legacySlug !== 'global' ? legacySlug : '')
	};

	if (!fs.existsSync(adminConfigPath)) return defaults;

	try {
		const parsed = JSON.parse(fs.readFileSync(adminConfigPath, 'utf8'));
		const has = (k) => Object.prototype.hasOwnProperty.call(parsed, k);
		const kenerBase = has('KENER_BASE') ? parsed.KENER_BASE : (has('UPTIME_BASE') ? parsed.UPTIME_BASE : defaults.KENER_BASE);
		const kenerPagePathRaw = has('KENER_PAGE_PATH') ? parsed.KENER_PAGE_PATH : (has('UPTIME_SLUG') ? parsed.UPTIME_SLUG : defaults.KENER_PAGE_PATH);
		return {
			...defaults,
			...parsed,
			KENER_BASE: String(kenerBase || '').trim(),
			KENER_PAGE_PATH: normalizeKenerPagePath(kenerPagePathRaw),
			SPOTIFY_ENABLED: has('SPOTIFY_ENABLED') ? parseBoolean(parsed.SPOTIFY_ENABLED) : defaults.SPOTIFY_ENABLED,
			DISCORD_ENABLED: has('DISCORD_ENABLED') ? parseBoolean(parsed.DISCORD_ENABLED) : defaults.DISCORD_ENABLED,
			GITHUB_ENABLED: has('GITHUB_ENABLED') ? parseBoolean(parsed.GITHUB_ENABLED) : defaults.GITHUB_ENABLED,
			HOMELAB_ENABLED: has('HOMELAB_ENABLED') ? parseBoolean(parsed.HOMELAB_ENABLED) : defaults.HOMELAB_ENABLED
		};
	} catch (e) {
		console.error('Admin config parse error:', e.message);
		return defaults;
	}
}

function saveAdminConfig(config) {
	const sanitized = {
		SPOTIFY_ENABLED: parseBoolean(config.SPOTIFY_ENABLED),
		SPOTIFY_CLIENT_ID: String(config.SPOTIFY_CLIENT_ID || '').trim(),
		SPOTIFY_CLIENT_SECRET: String(config.SPOTIFY_CLIENT_SECRET || '').trim(),
		SPOTIFY_REFRESH_TOKEN: String(config.SPOTIFY_REFRESH_TOKEN || '').trim(),
		DISCORD_ENABLED: parseBoolean(config.DISCORD_ENABLED),
		DISCORD_USER_ID: String(config.DISCORD_USER_ID || '').trim(),
		DISCORD_USERNAME: String(config.DISCORD_USERNAME || '').trim(),
		DISCORD_AVATAR_URL: String(config.DISCORD_AVATAR_URL || '').trim(),
		GITHUB_ENABLED: parseBoolean(config.GITHUB_ENABLED),
		GITHUB_USERNAME: String(config.GITHUB_USERNAME || '').trim(),
		GITHUB_TOKEN: String(config.GITHUB_TOKEN || '').trim(),
		HOMELAB_ENABLED: parseBoolean(config.HOMELAB_ENABLED),
		HOMELAB_NAME: String(config.HOMELAB_NAME || '').trim(),
		SPOTIFY_REDIRECT_URI: String(config.SPOTIFY_REDIRECT_URI || '').trim(),
		KENER_BASE: String(config.KENER_BASE || '').trim(),
		KENER_PAGE_PATH: normalizeKenerPagePath(config.KENER_PAGE_PATH)
	};

	fs.writeFileSync(adminConfigPath, JSON.stringify(sanitized, null, 2) + '\n', 'utf8');
	return sanitized;
}

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Libs front servies en local (pas de CDN), uniquement le dossier dist
app.use('/vendor/gsap', express.static(path.join(__dirname, 'node_modules', 'gsap', 'dist'), { maxAge: '7d' }));
// Scène pixel art du hero : copie du moteur cat-abw-iso3d-webanim (npm run vendor:cat).
// Cache long : l'URL porte une empreinte des fichiers, qui change à chaque mise à jour.
const catSceneDir = path.join(__dirname, 'vendor', 'cat-scene');
app.use('/vendor/cat-scene', express.static(catSceneDir, { maxAge: '30d' }));
app.locals.catSceneVersion = (() => {
	const hash = crypto.createHash('md5');
	try {
		['cat-scene.js', 'portfolio-jour.png', 'portfolio-nuit.png'].forEach((f) => hash.update(fs.readFileSync(path.join(catSceneDir, f))));
		return hash.digest('hex').slice(0, 8);
	} catch (e) {
		return '0';
	}
})();
app.use(express.static(path.join(__dirname, 'public')));

// parse form bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const turnstileSiteKey = process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || '';
const turnstileSecretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || '';

const adminAccessCode = String(process.env.ADMIN_ACCESS_CODE || '').trim();
const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || 'change-this-admin-session-secret';
const adminSessionCookie = 'admin_session';
const adminSessionDurationMs = 8 * 60 * 60 * 1000;

if (!/^\d{6}$/.test(adminAccessCode)) {
	console.warn('ADMIN_ACCESS_CODE is missing or invalid. Use a 6-digit code in .env to enable admin login.');
}

function parseCookies(header) {
	const cookies = {};
	if (!header) return cookies;

	header.split(';').forEach((entry) => {
		const idx = entry.indexOf('=');
		if (idx <= 0) return;
		const key = entry.slice(0, idx).trim();
		const value = entry.slice(idx + 1).trim();
		cookies[key] = decodeURIComponent(value);
	});

	return cookies;
}

function createAdminSessionValue() {
	const issuedAt = Date.now();
	const nonce = crypto.randomBytes(16).toString('hex');
	const payload = `${issuedAt}.${nonce}`;
	const sig = crypto.createHmac('sha256', adminSessionSecret).update(payload).digest('hex');
	return `${payload}.${sig}`;
}

function verifyAdminSessionValue(value) {
	if (!value) return false;
	const parts = value.split('.');
	if (parts.length !== 3) return false;

	const [issuedAtRaw, nonce, sig] = parts;
	if (!/^\d+$/.test(issuedAtRaw) || !nonce || !sig) return false;

	const payload = `${issuedAtRaw}.${nonce}`;
	const expected = crypto.createHmac('sha256', adminSessionSecret).update(payload).digest('hex');
	const sigBuf = Buffer.from(sig);
	const expBuf = Buffer.from(expected);
	if (sigBuf.length !== expBuf.length) return false;
	if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

	const issuedAt = Number(issuedAtRaw);
	return Number.isFinite(issuedAt) && Date.now() - issuedAt <= adminSessionDurationMs;
}

function setAdminSessionCookie(res, value, maxAgeMs) {
	const attrs = [
		`${adminSessionCookie}=${encodeURIComponent(value)}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		`Max-Age=${Math.floor(maxAgeMs / 1000)}`
	];

	attrs.splice(1, 0, 'Domain=.olivier-dutoit.fr');

	if (process.env.NODE_ENV === 'production') attrs.push('Secure');

	res.setHeader('Set-Cookie', attrs.join('; '));
}

function requireAdmin(req, res, next) {
	const cookies = parseCookies(req.headers.cookie || '');
	if (verifyAdminSessionValue(cookies[adminSessionCookie])) return next();
	return res.redirect('/admin/login');
}

// ── Spotify ───────────────────────────────────────────
let spotifyConfig = loadAdminConfig();

function getAboutConfig() {
    return {
		spotifyEnabled: parseBoolean(spotifyConfig.SPOTIFY_ENABLED),
		discordEnabled: parseBoolean(spotifyConfig.DISCORD_ENABLED),
		discordUserId: String(spotifyConfig.DISCORD_USER_ID || '').trim(),
		discordUsername: String(spotifyConfig.DISCORD_USERNAME || '').trim() || 'Discord',
		discordAvatarUrl: String(spotifyConfig.DISCORD_AVATAR_URL || '').trim(),
		githubEnabled: parseBoolean(spotifyConfig.GITHUB_ENABLED),
		githubUsername: String(spotifyConfig.GITHUB_USERNAME || '').trim() || 'github',
		homelabEnabled: parseBoolean(spotifyConfig.HOMELAB_ENABLED),
		homelabName: String(spotifyConfig.HOMELAB_NAME || '').trim() || 'Homelab'
	};
}

let spotifyAccessToken = null;
let spotifyTokenExpires = 0;
let spotifyTokenKey = '';
let spotifyTokenPromise = null;

function getSpotifyRedirectUri() {
	return String(spotifyConfig.SPOTIFY_REDIRECT_URI || '').trim() || 'https://www.olivier-dutoit.fr/callback';
}

function spotifyPost(path, body, config) {
	return new Promise((resolve, reject) => {
		const postData = querystring.stringify(body);
		const auth = Buffer.from(`${config.SPOTIFY_CLIENT_ID}:${config.SPOTIFY_CLIENT_SECRET}`).toString('base64');
		const opts = {
			hostname: 'accounts.spotify.com',
			path,
			method: 'POST',
			headers: {
				'Authorization': `Basic ${auth}`,
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(postData)
			}
		};

		const req = https.request(opts, (res) => {
			let d = '';
			res.on('data', (c) => d += c);
			res.on('end', () => {
				let data;
				try {
					data = JSON.parse(d || '{}');
				} catch (e) {
					return reject(e);
				}

				if (res.statusCode >= 400) {
					const err = new Error(data.error_description || data.error || `Spotify HTTP ${res.statusCode}`);
					err.statusCode = res.statusCode;
					return reject(err);
				}

				resolve(data);
			});
		});

		req.on('error', reject);
		req.write(postData);
		req.end();
	});
}

function spotifyGet(path, token) {
	return new Promise((resolve, reject) => {
		const opts = {
			hostname: 'api.spotify.com',
			path,
			method: 'GET',
			headers: { 'Authorization': `Bearer ${token}` }
		};

		const req = https.request(opts, (res) => {
			let d = '';
			res.on('data', (c) => d += c);
			res.on('end', () => {
				if (res.statusCode === 204 || !d) return resolve(null);
				let data;
				try {
					data = JSON.parse(d);
				} catch (e) {
					return reject(e);
				}

				if (res.statusCode >= 400) {
					const err = new Error((data.error && data.error.message) || data.error || `Spotify HTTP ${res.statusCode}`);
					err.statusCode = res.statusCode;
					return reject(err);
				}

				resolve(data);
			});
		});

		req.on('error', reject);
		req.end();
	});
}

// ── Infrastructure (Kener) ───────────────────────────
function normalizeKenerBasePath(pathname) {
	const value = String(pathname || '').trim();
	if (!value || value === '/') return '';
	return '/' + value.replace(/^\/+|\/+$/g, '');
}

function normalizeKenerPagePath(pathname) {
	const value = String(pathname || '').trim();
	if (!value || value === '/' || value.toLowerCase() === 'global') return '';
	return value.replace(/^\/+|\/+$/g, '');
}

function getUptimeKumaConfig() {
	const rawBase = String(spotifyConfig.KENER_BASE || spotifyConfig.UPTIME_BASE || '').trim();
	const slug = String(spotifyConfig.KENER_PAGE_PATH || '').trim() || 'global';
	const apiKey = String(process.env.KENER_API_KEY || '').trim();

	if (!rawBase) return { hostname: '', slug, apiKey };

	const candidate = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
	try {
		const parsed = new URL(candidate);
		return { hostname: parsed.hostname, port: parsed.port ? Number(parsed.port) : null, slug, apiKey };
	} catch (e) {
		return { hostname: '', slug, apiKey };
	}
}

function uptimeKumaGet(config, endpointPath) {
	return new Promise((resolve, reject) => {
		const opts = {
			hostname: config.hostname,
			path: endpointPath,
			method: 'GET',
			headers: { 'User-Agent': 'olivier-dutoit.fr' }
		};
		if (config.port) opts.port = config.port;
		if (config.apiKey) opts.headers['Authorization'] = `Bearer ${config.apiKey}`;

		const req = https.request(opts, (r) => {
			let d = '';
			r.on('data', (c) => d += c);
			r.on('end', () => {
				if (r.statusCode >= 400) return reject(new Error(`HTTP ${r.statusCode}`));
				try { resolve(JSON.parse(d || '{}')); } catch (e) { reject(e); }
			});
		});
		// Une status page qui ne répond pas ne doit pas bloquer l'accueil
		req.setTimeout(5000, () => req.destroy(new Error('timeout')));
		req.on('error', reject);
		req.end();
	});
}

// Lit la status page une fois et en tire les deux vues : par groupe (/api/uptime)
// et par service. Liste blanche stricte : ni id, ni URL, ni message de monitor.
async function loadUptimeKumaSnapshot(config) {
	const [statusPage, heartbeatPage] = await Promise.all([
		uptimeKumaGet(config, `/api/status-page/${encodeURIComponent(config.slug)}`),
		uptimeKumaGet(config, `/api/status-page/heartbeat/${encodeURIComponent(config.slug)}`)
	]);

	const publicGroups = Array.isArray(statusPage.publicGroupList) ? statusPage.publicGroupList : [];
	const heartbeats = heartbeatPage.heartbeatList || {};
	const groups = [];
	const services = [];

	publicGroups
		.slice()
		.sort((a, b) => (a.weight || 0) - (b.weight || 0))
		.forEach((group) => {
			const groupName = String(group.name || '').trim();
			if (!groupName) return;
			const monitors = Array.isArray(group.monitorList) ? group.monitorList : [];

			const statuses = monitors.map((m) => {
				const beats = heartbeats[String(m.id)] || [];
				const last = beats.length ? beats[beats.length - 1] : null;
				// Comme avant : sans heartbeat on considère le service en ligne, sinon seul le statut 1 compte
				const up = !last || last.status === 1;
				const name = String(m.name || '').trim();
				if (name) {
					services.push({
						name,
						group: groupName,
						up,
						latency: last && Number.isFinite(last.ping) ? Math.round(last.ping) : null
					});
				}
				return up;
			});

			groups.push({ group: groupName, up: statuses.every(Boolean) });
		});

	return { groups, services };
}

let homelabCache = null;
let homelabCacheAt = 0;
let homelabPending = null;

function resetHomelabCache() {
	homelabCache = null;
	homelabCacheAt = 0;
}

// Snapshot partagé (cache 60 s, une seule requête en vol). null si désactivé ou indisponible.
function getHomelabSnapshot() {
	if (homelabCache && Date.now() - homelabCacheAt < 60000) return Promise.resolve(homelabCache);
	if (!parseBoolean(spotifyConfig.HOMELAB_ENABLED)) return Promise.resolve(null);
	const config = getUptimeKumaConfig();
	if (!config.hostname) return Promise.resolve(null);
	if (homelabPending) return homelabPending;

	homelabPending = loadUptimeKumaSnapshot(config)
		.then((snapshot) => {
			if (!snapshot.groups.length) return null;
			homelabCache = snapshot;
			homelabCacheAt = Date.now();
			return snapshot;
		})
		.catch((e) => {
			console.error('Uptime Kuma API error:', e.message);
			return null;
		})
		.finally(() => { homelabPending = null; });
	return homelabPending;
}

app.get('/api/uptime', async (req, res) => {
	const snapshot = await getHomelabSnapshot();
	if (!snapshot) return res.json({ ok: false });
	res.json({ ok: true, overall: snapshot.groups.every((g) => g.up), groups: snapshot.groups });
});

/* ── Scène du hero : état réel du homelab ─────────────────────────────
   config/homelab-scene.json associe chaque groupe Kuma à un appareil de la baie et à un nom public.
   Lecture et validation regroupées ici, pour qu'une future page d'admin puisse réutiliser
   validateHomelabSceneConfig() avant d'écrire le fichier. */
const homelabScenePath = path.join(__dirname, 'config', 'homelab-scene.json');
const SCENE_DEVICES = ['fw', 'switch', 'server', 'nas', 'isp', 'mini', 'ups'];
const STATUS_RANK = { up: 0, unknown: 1, degraded: 2, down: 3 };   // le pire état l'emporte

function validateHomelabSceneConfig(raw) {
	const cfg = raw && typeof raw === 'object' ? raw : {};
	const groupes = {};
	Object.keys(cfg.groupes || {}).forEach((kuma) => {
		const g = cfg.groupes[kuma] || {};
		if (!SCENE_DEVICES.includes(g.appareil)) {
			console.warn(`homelab-scene : appareil inconnu pour le groupe "${kuma}" (${g.appareil}), ignoré`);
			return;
		}
		groupes[kuma] = { appareil: g.appareil, nomPublic: String(g.nomPublic || g.appareil).trim() };
	});
	const meteo = cfg.meteo || {};
	return {
		seuilLatenceMs: Number(cfg.seuilLatenceMs) > 0 ? Number(cfg.seuilLatenceMs) : 500,
		groupes,
		meteo: Number.isFinite(meteo.latitude) && Number.isFinite(meteo.longitude) ? { latitude: meteo.latitude, longitude: meteo.longitude } : null,
		themes: (Array.isArray(cfg.themes) ? cfg.themes : []).filter((t) => t && /^\d\d-\d\d$/.test(t.du) && /^\d\d-\d\d$/.test(t.au) && t.nom)
	};
}

function loadHomelabSceneConfig() {
	try {
		return validateHomelabSceneConfig(JSON.parse(fs.readFileSync(homelabScenePath, 'utf8')));
	} catch (e) {
		console.error('homelab-scene : configuration illisible :', e.message);
		return validateHomelabSceneConfig({});
	}
}

let homelabScene = loadHomelabSceneConfig();

// Date et heure de Paris (le homelab est à Saint-Étienne)
function parisNow() {
	const parts = {};
	new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
		.formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value; });
	return { monthDay: `${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute), hhmm: `${parts.hour}:${parts.minute}` };
}

// Thème saisonnier actif (plages MM-JJ, une plage peut passer le nouvel an)
function activeTheme(monthDay) {
	const t = homelabScene.themes.find((th) => (th.du <= th.au ? monthDay >= th.du && monthDay <= th.au : monthDay >= th.du || monthDay <= th.au));
	return t ? t.nom : null;
}

// Météo actuelle (code WMO) via Open-Meteo, côté serveur, cache 20 min ; en cas d'échec on garde la dernière valeur
let weatherCache = { code: null, at: 0 };
function getWeatherCode() {
	const m = homelabScene.meteo;
	if (!m) return Promise.resolve(null);
	if (Date.now() - weatherCache.at < 20 * 60000) return Promise.resolve(weatherCache.code);
	return new Promise((resolve) => {
		const req = https.get({
			hostname: 'api.open-meteo.com',
			path: `/v1/forecast?latitude=${m.latitude}&longitude=${m.longitude}&current=weather_code`,
			headers: { 'User-Agent': 'olivier-dutoit.fr' }
		}, (r) => {
			let d = '';
			r.on('data', (c) => d += c);
			r.on('end', () => {
				try {
					const code = JSON.parse(d).current.weather_code;
					if (Number.isFinite(code)) weatherCache = { code, at: Date.now() };
				} catch (e) {
					console.error('Open-Meteo :', e.message);
				}
				resolve(weatherCache.code);
			});
		});
		req.setTimeout(5000, () => req.destroy(new Error('timeout')));
		req.on('error', (e) => { console.error('Open-Meteo :', e.message); resolve(weatherCache.code); });
	});
}

// État par groupe configuré, par appareil et global. Kuma injoignable : tout est "unknown".
function buildHomelabState(snapshot) {
	const worst = (a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a);
	const seuil = homelabScene.seuilLatenceMs;
	const groupStatus = (name) => {
		if (!snapshot) return { status: 'unknown', latency: null };
		const g = snapshot.groups.find((x) => x.group === name);
		if (!g) return { status: 'unknown', latency: null };
		const lat = snapshot.services.filter((s) => s.group === name && s.latency !== null).map((s) => s.latency);
		const latency = lat.length ? Math.max(...lat) : null;
		return { status: !g.up ? 'down' : latency !== null && latency > seuil ? 'degraded' : 'up', latency };
	};

	const devices = {};
	const groups = Object.keys(homelabScene.groupes).map((kuma) => {
		const map = homelabScene.groupes[kuma], st = groupStatus(kuma);
		devices[map.appareil] = devices[map.appareil] ? worst(devices[map.appareil], st.status) : st.status;
		return { name: map.nomPublic, device: map.appareil, status: st.status, latency: st.latency };
	});

	let global = 'unknown';
	if (snapshot) global = snapshot.groups.map((g) => groupStatus(g.group).status).reduce(worst, 'up');
	return { global, groups, devices };
}

// Pas d'IP, de port, de hostname ni d'URL : seulement des noms publics et des états
app.get('/api/homelab', async (req, res) => {
	const [snapshot, weather] = await Promise.all([getHomelabSnapshot(), getWeatherCode()]);
	const now = parisNow();
	const state = buildHomelabState(snapshot);
	res.set('Cache-Control', 'no-store');
	res.json({
		ok: true,
		global: state.global,
		groups: state.groups,
		devices: state.devices,
		time: { zone: 'Europe/Paris', hhmm: now.hhmm, hour: now.hour + now.minute / 60 },
		weather,
		theme: activeTheme(now.monthDay)
	});
});


async function getSpotifyToken() {
	const tokenKey = `${spotifyConfig.SPOTIFY_CLIENT_ID}:${spotifyConfig.SPOTIFY_REFRESH_TOKEN}`;
	if (tokenKey !== spotifyTokenKey) {
		spotifyAccessToken = null;
		spotifyTokenExpires = 0;
		spotifyTokenKey = tokenKey;
		spotifyTokenPromise = null;
	}

	if (spotifyAccessToken && Date.now() < spotifyTokenExpires) return spotifyAccessToken;
	if (spotifyTokenPromise) return spotifyTokenPromise;

	spotifyTokenPromise = spotifyPost('/api/token', {
		grant_type: 'refresh_token',
		refresh_token: spotifyConfig.SPOTIFY_REFRESH_TOKEN
	}, spotifyConfig).then((data) => {
		if (!data.access_token) throw new Error('Spotify access token missing');
		const expiresIn = Number(data.expires_in || 3600);
		spotifyAccessToken = data.access_token;
		spotifyTokenExpires = Date.now() + Math.max(expiresIn - 60, 60) * 1000;
		return spotifyAccessToken;
	}).finally(() => {
		spotifyTokenPromise = null;
	});

	return spotifyTokenPromise;
}

// ── Spotify OAuth (setup temporaire) ──────────────────
app.get('/spotify-auth', requireAdmin, (req, res) => {
	if (!spotifyConfig.SPOTIFY_ENABLED || !spotifyConfig.SPOTIFY_CLIENT_ID || !spotifyConfig.SPOTIFY_CLIENT_SECRET) {
		return res.status(400).send('Spotify non configuré.');
	}

	const scope = 'user-read-currently-playing user-read-playback-state user-read-recently-played';
	const url = 'https://accounts.spotify.com/authorize?' + querystring.stringify({
		client_id: spotifyConfig.SPOTIFY_CLIENT_ID,
		response_type: 'code',
		redirect_uri: getSpotifyRedirectUri(),
		scope
	});
	res.redirect(url);
});

app.get('/callback', requireAdmin, async (req, res) => {
	if (!spotifyConfig.SPOTIFY_CLIENT_ID || !spotifyConfig.SPOTIFY_CLIENT_SECRET) {
		return res.status(400).send('Spotify non configuré.');
	}

	const code = req.query.code;
	if (!code) return res.send('Erreur : pas de code.');
	try {
		const data = await spotifyPost('/api/token', {
			grant_type: 'authorization_code',
			code,
			redirect_uri: getSpotifyRedirectUri()
		}, spotifyConfig);
		res.send(`<pre style="font:1rem monospace;padding:2rem;background:#111;color:#4ade80">
refresh_token obtenu :

${data.refresh_token}

Valeur détectée :
SPOTIFY_REFRESH_TOKEN=${data.refresh_token}

Tu peux aussi la coller depuis l'admin.
</pre>`);
	} catch(e) {
		res.send('Erreur : ' + e.message);
	}
});

// ── Spotify helpers ───────────────────────────────────
function emptySpotifyState(available) {
	return {
		available: Boolean(available),
		playing: false,
		fetched_at: Date.now()
	};
}

function formatSpotifyState(data) {
	if (!data || !data.item || !data.is_playing) return emptySpotifyState(true);

	const item = data.item;
	const album = item.album || item.show || {};
	const images = Array.isArray(album.images) ? album.images : [];
	const artists = Array.isArray(item.artists)
		? item.artists.map((artist) => artist.name).filter(Boolean)
		: [item.show && item.show.publisher].filter(Boolean);

	return {
		available: true,
		playing: true,
		id: item.id || item.uri || item.external_urls?.spotify || '',
		title: item.name || '',
		artist: artists.join(', '),
		album: album.name || '',
		image: images[1]?.url || images[0]?.url || '',
		url: item.external_urls?.spotify || '',
		progress_ms: Number(data.progress_ms || 0),
		duration_ms: Number(item.duration_ms || 0),
		fetched_at: Date.now()
	};
}

async function getSpotifyCurrentlyPlaying() {
	let token = await getSpotifyToken();
	try {
		return await spotifyGet('/v1/me/player/currently-playing?additional_types=track,episode', token);
	} catch (e) {
		if (e.statusCode !== 401) throw e;
		spotifyAccessToken = null;
		spotifyTokenExpires = 0;
		spotifyTokenPromise = null;
		token = await getSpotifyToken();
		return spotifyGet('/v1/me/player/currently-playing?additional_types=track,episode', token);
	}
}

async function fetchSpotifyState() {
	if (!parseBoolean(spotifyConfig.SPOTIFY_ENABLED)) return emptySpotifyState(false);
	if (!spotifyConfig.SPOTIFY_CLIENT_ID || !spotifyConfig.SPOTIFY_CLIENT_SECRET || !spotifyConfig.SPOTIFY_REFRESH_TOKEN) {
		return emptySpotifyState(false);
	}

	try {
		return formatSpotifyState(await getSpotifyCurrentlyPlaying());
	} catch(e) {
		console.error('Spotify poll error:', e.message);
		return emptySpotifyState(false);
	}
}

// ── SSE: Spotify live stream ──────────────────────────
const sseClients = new Set();
let lastSpotifyStateKey = '';
let lastPushAt = 0;
let spotifyStatePromise = null;

const SPOTIFY_POLL_INTERVAL_MS = 1500;
const SPOTIFY_RESYNC_INTERVAL_MS = 5000;

function getSpotifyStateKey(state) {
	if (!state) return '';
	return [
		state.available ? '1' : '0',
		state.playing ? '1' : '0',
		state.id || '',
		state.title || '',
		state.artist || ''
	].join('|');
}

function pushToClients(payload) {
	if (sseClients.size === 0) return;
	const msg = `data: ${JSON.stringify(payload)}\n\n`;
	sseClients.forEach((client) => {
		try {
			client.write(msg);
		} catch (e) {
			sseClients.delete(client);
		}
	});
}

function readSpotifyState() {
	if (!spotifyStatePromise) {
		spotifyStatePromise = fetchSpotifyState().finally(() => {
			spotifyStatePromise = null;
		});
	}
	return spotifyStatePromise;
}

async function refreshSpotifyState(options = {}) {
	const state = await readSpotifyState();
	const now = Date.now();
	const stateKey = getSpotifyStateKey(state);
	const changed = stateKey !== lastSpotifyStateKey;
	const resyncDue = state.playing && now - lastPushAt >= SPOTIFY_RESYNC_INTERVAL_MS;

	lastSpotifyStateKey = stateKey;

	if (!options.silent && (options.force || changed || resyncDue)) {
		lastPushAt = now;
		pushToClients(state);
	}

	return state;
}

setInterval(async () => {
	if (sseClients.size === 0) return; // pas de clients, pas d'appel API
	try {
		await refreshSpotifyState();
	} catch (e) {
		console.error('Spotify stream error:', e.message);
	}
}, SPOTIFY_POLL_INTERVAL_MS);

app.get('/api/spotify/stream', async (req, res) => {
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');
	res.flushHeaders();

	res.write('retry: 2500\n\n');
	let closed = false;

	req.on('close', () => {
		closed = true;
		sseClients.delete(res);
	});

	// envoie l'état courant immédiatement à la connexion
	try {
		const state = await refreshSpotifyState();
		if (closed) return;
		res.write(`data: ${JSON.stringify(state)}\n\n`);
		sseClients.add(res);
	} catch (e) {
		if (closed) return;
		res.write(`data: ${JSON.stringify(emptySpotifyState(false))}\n\n`);
		sseClients.add(res);
	}
});

// ── API Spotify Now Playing (REST fallback) ────────────
app.get('/api/spotify', async (req, res) => {
	res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
	res.setHeader('Pragma', 'no-cache');
	res.setHeader('Expires', '0');
	res.json(await refreshSpotifyState());
});

// ── API GitHub dernière activité ──────────────────────
let ghCache = null;
let ghCacheAt = 0;

function githubGet(path) {
	return new Promise((resolve, reject) => {
		const opts = {
			hostname: 'api.github.com',
			path,
			method: 'GET',
			headers: { 'User-Agent': 'olivier-dutoit.fr', 'Accept': 'application/vnd.github+json' }
		};
		const githubToken = String(spotifyConfig.GITHUB_TOKEN || process.env.GITHUB_TOKEN || '').trim();
		if (githubToken) opts.headers['Authorization'] = 'Bearer ' + githubToken;
		const req = https.request(opts, (res) => {
			let d = '';
			res.on('data', c => d += c);
			res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
		});
		req.on('error', reject);
		req.end();
	});
}

function formatGhEvent(ev) {
	const repo = ev.repo?.name?.replace('Teksya/', '') || ev.repo?.name || '';
	switch (ev.type) {
		case 'PushEvent': {
			const n = ev.payload?.commits?.length || 1;
			return { action: `${n} commit${n > 1 ? 's' : ''} pushés`, repo, url: `https://github.com/${ev.repo?.name}` };
		}
		case 'CreateEvent':
			return { action: `${ev.payload?.ref_type} créé`, repo, url: `https://github.com/${ev.repo?.name}` };
		case 'DeleteEvent':
			return { action: `${ev.payload?.ref_type} supprimé`, repo, url: `https://github.com/${ev.repo?.name}` };
		case 'PullRequestEvent':
			return { action: `PR #${ev.payload?.number} ${ev.payload?.action}`, repo, url: ev.payload?.pull_request?.html_url || `https://github.com/${ev.repo?.name}` };
		case 'IssuesEvent':
			return { action: `Issue #${ev.payload?.issue?.number} ${ev.payload?.action}`, repo, url: ev.payload?.issue?.html_url || `https://github.com/${ev.repo?.name}` };
		case 'WatchEvent':
			return { action: 'Star ajouté', repo, url: `https://github.com/${ev.repo?.name}` };
		case 'ForkEvent':
			return { action: 'Fork', repo, url: `https://github.com/${ev.repo?.name}` };
		default:
			return { action: ev.type.replace('Event', ''), repo, url: `https://github.com/${ev.repo?.name}` };
	}
}

app.get('/api/github', async (req, res) => {
	try {
		if (!parseBoolean(spotifyConfig.GITHUB_ENABLED)) return res.json({ ok: false });
		const githubUsername = String(spotifyConfig.GITHUB_USERNAME || '').trim();
		if (!githubUsername) return res.json({ ok: false });
		if (ghCache && Date.now() - ghCacheAt < 120000) return res.json(ghCache);
		const events = await githubGet(`/users/${encodeURIComponent(githubUsername)}/events/public?per_page=1`);
		if (!Array.isArray(events) || !events[0]) return res.json({ ok: false });
		const ev = events[0];
		const fmt = formatGhEvent(ev);
		ghCache = { ok: true, ...fmt, date: ev.created_at };
		ghCacheAt = Date.now();
		res.json(ghCache);
	} catch(e) {
		console.error('GitHub API error:', e.message);
		res.json({ ok: false });
	}
});

const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const fromEmail = process.env.FROM_EMAIL || 'no-reply@olivier-dutoit.fr';
const toEmail = process.env.TO_EMAIL || 'olivierdutoit@etik.com';

let transporter = null;
if (smtpHost && smtpUser) {
	transporter = nodemailer.createTransport({
		host: smtpHost,
		port: smtpPort,
		secure: smtpPort === 465, // true for 465, false for other ports
		auth: {
			user: smtpUser,
			pass: smtpPass
		}
	});
}

// Accueil one-page : chapitres numérotés après filtrage, partagés avec le header (res.locals.navChapters).
// Chaque id correspond à un partial views/partials/chapters/<id>.ejs.
function getHomeChapters() {
	const about = getAboutConfig();
	const live = about.spotifyEnabled || about.discordEnabled || about.githubEnabled || about.homelabEnabled;
	return [
		{ id: 'projets', label: 'Projets', title: 'Projets',
			text: 'Projets académiques et personnels, entre infrastructure, administration système et développement. Filtre par technologie, clique pour le détail.' },
		{ id: 'parcours', label: 'Parcours', title: 'Parcours',
			text: 'Du Bac Pro CIEL au BTS SIO SISR en alternance. Le diplôme du Bac Pro se vérifie par QR code.' },
		live && { id: 'en-direct', label: 'En direct', title: 'En direct',
			text: 'Ce que j\'écoute, mon statut Discord, mon dernier push et l\'état de mon homelab. Mis à jour en continu.' },
		{ id: 'competences', label: 'Compétences', title: 'Compétences',
			text: 'Ce que j\'utilise en cours comme en alternance, rangé par domaine.' },
		{ id: 'ce-site', label: 'Ce site', title: 'Comment ce site est servi',
			text: 'Le chemin d\'une requête, de votre navigateur jusqu\'au container qui répond. À chaque étape, les contrôles qui la protègent.' },
		{ id: 'contact', label: 'Contact', title: 'Me contacter',
			text: 'Vous avez un projet ou une opportunité ? Je suis disponible.' }
	]
		.filter(Boolean)
		.map((c, i) => Object.assign({ num: String(i + 1).padStart(2, '0') }, c));
}

app.use((req, res, next) => {
	res.locals.navChapters = getHomeChapters();
	next();
});

// Retour du formulaire de contact (POST puis redirection vers /?contact=<code>#contact)
const CONTACT_MESSAGES = {
	'sent': { type: 'success', text: 'Message envoyé avec succès.' },
	'no-smtp': { type: 'success', text: 'Validation Turnstile réussie (email non envoyé, SMTP non configuré).' },
	'no-token': { type: 'error', text: 'Validation Turnstile manquante.' },
	'turnstile-failed': { type: 'error', text: 'Échec de la vérification Turnstile.' },
	'turnstile-error': { type: 'error', text: 'Erreur serveur lors de la vérification Turnstile.' },
	'send-failed': { type: 'error', text: 'Impossible d\'envoyer l\'email.' }
};

// Affiche jour ou nuit du hero selon l'heure de Paris
function isDaytime(hour) { return hour >= 8 && hour < 19; }

app.get('/', (req, res) => res.render('index', {
	heroPoster: isDaytime(parisNow().hour) ? 'portfolio-jour.png' : 'portfolio-nuit.png',
	title: 'Olivier D - Accueil',
	description: 'Étudiant en BTS SIO SISR en alternance, passionné par les réseaux, l\'administration système et le développement web. Projets, parcours et contact.',
	url: 'https://www.olivier-dutoit.fr',
	ogImage: 'https://www.olivier-dutoit.fr/og-image.png',
	projects: loadProjects(),
	aboutConfig: getAboutConfig(),
	turnstileSiteKey,
	contactStatus: Object.prototype.hasOwnProperty.call(CONTACT_MESSAGES, req.query.contact) ? CONTACT_MESSAGES[req.query.contact] : null
}));

// Anciennes pages, devenues des chapitres de l'accueil
app.get('/work', (req, res) => res.redirect(301, '/#projets'));
app.get('/about', (req, res) => res.redirect(301, '/#parcours'));
app.get('/contact', (req, res) => res.redirect(301, '/#contact'));

app.get('/mentions-legales', (req, res) => res.render('mentions-legales', {
	title: 'Olivier D - Mentions légales',
	description: 'Mentions légales et conditions d\'utilisation du site olivier-dutoit.fr.',
	url: 'https://www.olivier-dutoit.fr/mentions-legales',
	ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
}));

app.get('/conditions-generales', (req, res) => res.render('conditions-generales', {
	title: 'Olivier D - Conditions générales',
	description: 'Conditions générales d\'utilisation du site olivier-dutoit.fr et précision sur la boutique store.olivier-dutoit.fr.',
	url: 'https://www.olivier-dutoit.fr/conditions-generales',
	ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
}));

app.get('/confidentialite', (req, res) => res.render('confidentialite', {
	title: 'Olivier D - Confidentialité',
	description: 'Politique de confidentialité du site olivier-dutoit.fr.',
	url: 'https://www.olivier-dutoit.fr/confidentialite',
	ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
}));

// URL déclarée sur la fiche Google Play de l'application Budgie.
app.get('/budgie-privacy', (req, res) => res.render('budgie-privacy', {
	title: 'Budgie - Politique de confidentialité',
	description: 'Politique de confidentialité de l\'application Android Budgie : aucune donnée collectée, tout reste sur l\'appareil.',
	url: 'https://www.olivier-dutoit.fr/budgie-privacy',
	ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
}));

function verifyTurnstile(token, remoteip) {
	return new Promise((resolve, reject) => {
		const postData = querystring.stringify({
			secret: turnstileSecretKey,
			response: token,
			remoteip: remoteip
		});

		const options = {
			hostname: 'challenges.cloudflare.com',
			path: '/turnstile/v0/siteverify',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(postData)
			}
		};

		const req = https.request(options, (res) => {
			let data = '';
			res.on('data', (chunk) => (data += chunk));
			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					resolve(json);
				} catch (err) {
					reject(err);
				}
			});
		});

		req.on('error', (err) => reject(err));
		req.write(postData);
		req.end();
	});
}

function escapeHtml(value) {
	return String(value || '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// POST puis redirection (303) vers le chapitre Contact de l'accueil, avec un code de retour
app.post('/contact', async (req, res) => {
	const name = req.body.name;
	const email = req.body.email;
	const subject = String(req.body.subject || '').trim();
	const message = req.body.message;
	const token = req.body['cf-turnstile-response'];
	const back = (code) => res.redirect(303, `/?contact=${code}#contact`);

	if (!token) return back('no-token');

	try {
		const result = await verifyTurnstile(token, req.ip);
		if (!result || !result.success) return back('turnstile-failed');

		if (!transporter) {
			console.warn('SMTP transporter not configured; skipping email send.');
			return back('no-smtp');
		}

		try {
			await transporter.sendMail({
				from: fromEmail,
				to: toEmail,
				subject: `Nouveau message de contact - ${name} <${email}>`,
				text: `Nom: ${name}\nEmail: ${email}\nSujet: ${subject}\n\nMessage:\n${message}`,
				html: `<p><strong>Nom:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Sujet:</strong> ${escapeHtml(subject)}</p><p><strong>Message:</strong></p><p>${escapeHtml(message)}</p>`
			});
			return back('sent');
		} catch (mailErr) {
			console.error('Mail send error:', mailErr);
			return back('send-failed');
		}
	} catch (err) {
		console.error('Turnstile verification error:', err);
		return back('turnstile-error');
	}
});

// ── Admin ─────────────────────────────────────────────
app.get('/admin/login', (req, res) => {
	res.render('admin-login', {
		title: 'Admin Login',
		error: null,
		description: 'Connexion administrateur.',
		url: 'https://www.olivier-dutoit.fr/admin/login',
		ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
	});
});

app.post('/admin/login', (req, res) => {
	const code = String(req.body.code || '').trim();

	if (!/^\d{6}$/.test(code)) {
		return res.status(400).render('admin-login', {
			title: 'Admin Login',
			error: 'Le code doit contenir exactement 6 chiffres.',
			description: 'Connexion administrateur.',
			url: 'https://www.olivier-dutoit.fr/admin/login',
			ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
		});
	}

	if (!/^\d{6}$/.test(adminAccessCode)) {
		return res.status(500).render('admin-login', {
			title: 'Admin Login',
			error: 'ADMIN_ACCESS_CODE n\'est pas configuré correctement sur le serveur.',
			description: 'Connexion administrateur.',
			url: 'https://www.olivier-dutoit.fr/admin/login',
			ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
		});
	}

	if (code !== adminAccessCode) {
		return res.status(401).render('admin-login', {
			title: 'Admin Login',
			error: 'Code invalide.',
			description: 'Connexion administrateur.',
			url: 'https://www.olivier-dutoit.fr/admin/login',
			ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
		});
	}

	setAdminSessionCookie(res, createAdminSessionValue(), adminSessionDurationMs);
	return res.redirect('/admin');
});

app.get('/admin/logout', (req, res) => {
	setAdminSessionCookie(res, '', 0);
	return res.redirect('/admin/login');
});

function renderAdminView(req, res, view, options = {}) {
	const hasOwn = (key) => Object.prototype.hasOwnProperty.call(options, key);
	const success = hasOwn('success') ? options.success : (req.query.success || null);
	const error = hasOwn('error') ? options.error : (req.query.error || null);

	return res.status(options.status || 200).render(view, {
		title: options.title || 'Administration',
		error,
		success,
		spotifyConfig,
		aboutConfig: getAboutConfig(),
		projects: options.projects || loadProjects(),
		activePage: options.activePage || 'dashboard',
		description: options.description || 'Administration du portfolio.',
		url: `https://www.olivier-dutoit.fr${req.path}`,
		ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
	});
}

app.get('/admin', requireAdmin, (req, res) => {
	return renderAdminView(req, res, 'admin', {
		title: 'Administration - Dashboard',
		activePage: 'dashboard'
	});
});

app.get('/admin/about', requireAdmin, (req, res) => {
	return renderAdminView(req, res, 'admin-spotify', {
		title: 'Administration - À propos',
		activePage: 'about'
	});
});

app.get('/admin/spotify', requireAdmin, (req, res) => res.redirect('/admin/about'));

app.get('/admin/projects', requireAdmin, (req, res) => {
	return renderAdminView(req, res, 'admin-projects', {
		title: 'Administration - Projets',
		activePage: 'projects'
	});
});

app.get('/admin/projects/new', requireAdmin, (req, res) => {
	return renderAdminView(req, res, 'admin-project-new', {
		title: 'Administration - Nouveau projet',
		activePage: 'project-new'
	});
});

function handleAdminAboutSave(req, res) {
	try {
		ghCache = null;
		ghCacheAt = 0;
		resetHomelabCache();

		spotifyConfig = saveAdminConfig({
			SPOTIFY_ENABLED: parseBoolean(req.body.SPOTIFY_ENABLED),
			SPOTIFY_CLIENT_ID: req.body.SPOTIFY_CLIENT_ID,
			SPOTIFY_CLIENT_SECRET: req.body.SPOTIFY_CLIENT_SECRET,
			SPOTIFY_REFRESH_TOKEN: req.body.SPOTIFY_REFRESH_TOKEN,
			DISCORD_ENABLED: parseBoolean(req.body.DISCORD_ENABLED),
			DISCORD_USER_ID: req.body.DISCORD_USER_ID,
			DISCORD_USERNAME: req.body.DISCORD_USERNAME,
			DISCORD_AVATAR_URL: req.body.DISCORD_AVATAR_URL,
			GITHUB_ENABLED: parseBoolean(req.body.GITHUB_ENABLED),
			GITHUB_USERNAME: req.body.GITHUB_USERNAME,
			GITHUB_TOKEN: req.body.GITHUB_TOKEN,
			HOMELAB_ENABLED: parseBoolean(req.body.HOMELAB_ENABLED),
			HOMELAB_NAME: req.body.HOMELAB_NAME,
			SPOTIFY_REDIRECT_URI: req.body.SPOTIFY_REDIRECT_URI,
			KENER_BASE: req.body.KENER_BASE,
			KENER_PAGE_PATH: req.body.KENER_PAGE_PATH
		});

		spotifyAccessToken = null;
		spotifyTokenExpires = 0;
		spotifyTokenKey = '';
		spotifyTokenPromise = null;
		spotifyStatePromise = null;
		lastSpotifyStateKey = '';
		lastPushAt = 0;

		return res.redirect('/admin/about?success=' + encodeURIComponent('Configuration À propos enregistrée.'));
	} catch (e) {
		console.error('Admin Spotify update error:', e.message);
		return renderAdminView(req, res, 'admin-spotify', {
			status: 500,
			activePage: 'about',
			title: 'Administration - À propos',
			error: 'Impossible d\'enregistrer la configuration À propos.',
			success: null
		});
	}
}

app.post('/admin/about', requireAdmin, handleAdminAboutSave);
app.post('/admin/spotify', requireAdmin, handleAdminAboutSave);

function splitCsv(input) {
	return String(input || '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

function normalizeProjectPayload(body, baseProject = {}) {
	return {
		...baseProject,
		title: String(body.title || '').trim(),
		description: String(body.description || '').trim(),
		image: String(body.image || '').trim(),
		tags: splitCsv(body.tags),
		chips: splitCsv(body.chips),
		featured: parseBoolean(body.featured)
	};
}

function ensureSingleFeatured(projects, featuredId) {
	return projects.map((project) => ({
		...project,
		featured: Number(project.id) === Number(featuredId)
	}));
}

function parseProjectOrder(input) {
	return String(input || '')
		.split(',')
		.map((value) => Number(value.trim()))
		.filter((value) => Number.isFinite(value));
}

function reorderProjectsByIds(projects, orderedIds) {
	const normalizedIds = orderedIds.map((value) => Number(value));
	const uniqueIds = Array.from(new Set(normalizedIds));

	if (uniqueIds.length !== projects.length) {
		throw new Error('Ordre invalide.');
	}

	const projectById = new Map(projects.map((project) => [Number(project.id), project]));
	if (!uniqueIds.every((id) => projectById.has(id))) {
		throw new Error('Ordre invalide.');
	}

	return uniqueIds.map((id) => projectById.get(id));
}

app.post('/admin/projects/create', requireAdmin, (req, res) => {
	try {
		const projects = loadProjects();
		const maxId = projects.reduce((acc, p) => Math.max(acc, Number(p.id) || 0), 0);
		const created = normalizeProjectPayload(req.body, {
			id: maxId + 1,
			featured: false
		});

		if (!created.title || !created.description) {
			throw new Error('Titre et description obligatoires.');
		}

		let updatedProjects = [...projects, created];
		if (created.featured) {
			updatedProjects = ensureSingleFeatured(updatedProjects, created.id);
		}

		saveProjects(updatedProjects);
		return res.redirect('/admin/projects?success=' + encodeURIComponent('Projet ajouté avec succès.'));
	} catch (e) {
		console.error('Admin project create error:', e.message);
		return renderAdminView(req, res, 'admin-project-new', {
			status: 400,
			activePage: 'project-new',
			title: 'Administration - Nouveau projet',
			error: e.message || 'Impossible d\'ajouter le projet.',
			success: null
		});
	}
});

app.post('/admin/projects/reorder', requireAdmin, (req, res) => {
	try {
		const projects = loadProjects();
		const orderedIds = parseProjectOrder(req.body.order);
		const reorderedProjects = reorderProjectsByIds(projects, orderedIds);

		saveProjects(reorderedProjects);
		return res.redirect('/admin/projects?success=' + encodeURIComponent('Ordre des projets enregistré.'));
	} catch (e) {
		console.error('Admin project reorder error:', e.message);
		return renderAdminView(req, res, 'admin-projects', {
			status: 400,
			activePage: 'projects',
			title: 'Administration - Projets',
			error: e.message || 'Impossible de réordonner les projets.',
			success: null
		});
	}
});

app.post('/admin/projects/:id/update', requireAdmin, (req, res) => {
	try {
		const projectId = Number(req.params.id);
		const projects = loadProjects();
		const index = projects.findIndex((p) => Number(p.id) === projectId);
		if (index === -1) throw new Error('Projet introuvable.');

		const updated = normalizeProjectPayload(req.body, { ...projects[index], id: projects[index].id });
		if (!updated.title || !updated.description) throw new Error('Titre et description obligatoires.');

		projects[index] = updated;
		let finalProjects = projects;
		if (updated.featured) {
			finalProjects = ensureSingleFeatured(projects, updated.id);
		}

		saveProjects(finalProjects);
		return res.redirect('/admin/projects?success=' + encodeURIComponent('Projet mis à jour.'));
	} catch (e) {
		console.error('Admin project update error:', e.message);
		return renderAdminView(req, res, 'admin-projects', {
			status: 400,
			activePage: 'projects',
			title: 'Administration - Projets',
			error: e.message || 'Impossible de modifier le projet.',
			success: null
		});
	}
});

app.post('/admin/projects/:id/delete', requireAdmin, (req, res) => {
	try {
		const projectId = Number(req.params.id);
		const projects = loadProjects();
		const nextProjects = projects.filter((p) => Number(p.id) !== projectId);

		if (nextProjects.length === projects.length) throw new Error('Projet introuvable.');

		saveProjects(nextProjects);
		return res.redirect('/admin/projects?success=' + encodeURIComponent('Projet supprimé.'));
	} catch (e) {
		console.error('Admin project delete error:', e.message);
		return renderAdminView(req, res, 'admin-projects', {
			status: 400,
			activePage: 'projects',
			title: 'Administration - Projets',
			error: e.message || 'Impossible de supprimer le projet.',
			success: null
		});
	}
});

// ── Gestion des erreurs 404 ────────────────────────────
app.use((req, res) => {
	res.status(404).render('error404', { 
		title: 'Olivier D - Page non trouvée',
		description: 'La page que vous cherchez n\'existe pas.',
		url: `https://www.olivier-dutoit.fr${req.originalUrl}`,
		ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
	});
});

// ── Gestion des erreurs 500 ────────────────────────────
app.use((err, req, res, next) => {
	console.error(err);
	res.status(500).render('error500', { 
		title: 'Olivier D - Erreur serveur',
		description: 'Une erreur serveur est survenue.',
		url: 'https://www.olivier-dutoit.fr',
		ogImage: 'https://www.olivier-dutoit.fr/og-image.png'
	});
});

app.listen(port, () => console.log(`Server listening on http://localhost:${port} \nStarted successfully`));
