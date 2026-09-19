/**
 * service-worker.js — cache de l'app shell pour un fonctionnement correct
 * hors-ligne / en rechargement rapide. Les chemins sont relatifs afin de
 * fonctionner aussi bien à la racine d'un domaine que sous un sous-dossier
 * GitHub Pages (https://utilisateur.github.io/signaly/).
 */
const CACHE_NAME = "signaly-cache-v4";

const APP_SHELL = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "js/storage.js",
  "js/parser.js",
  "js/reminders.js",
  "js/calendar.js",
  "js/speech.js",
  "js/notifications.js",
  "assets/robot-fallback.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/favicon-32.png",
  "assets/icons/favicon-16.png",
  "assets/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // La vidéo utilise des requêtes "range" : on laisse le navigateur les gérer nativement.
  if (url.pathname.endsWith(".mp4")) return;

  // Ressources externes (ex. Google Fonts) : réseau direct, pas de cache.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") return caches.match("index.html");
        });
    })
  );
});
