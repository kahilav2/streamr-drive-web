// VERSION: 25apr26.0
const CACHE_NAME = 'streamr-drive-web-pwa-cache-25apr26.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/main.js',
  '/event-emitter.js',
  '/message-controller.js',
  '/styles.css',
  '/manifest.json',
  '/service-worker.js',
  '/assets/all.min.css',
  '/assets/plaintexteditor/easymde.min.js',
  '/assets/plaintexteditor/easymde.min.css',
  '/assets/plaintexteditor/all.min.css',
  '/assets/web3.min.js',
  '/assets/qrcode.min.js',
  '/assets/jsQR.js',
  '/assets/streamr-chunker.bundle.js',
  '/assets/streamr-sdk.web.js',
  '/assets/vue.global.js',
  '/assets/favicon-16x16.png',
  '/assets/favicon-32x32.png',
  '/assets/click_icon.png',
  '/assets/hamburger_menu_white.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});
  
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // force the new service worker to take control immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener("message", async (event) => {
  if (event.data && event.data.action === "purgeCache") {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
