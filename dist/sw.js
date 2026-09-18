const CACHE = 'rezapp-shell-v9';
const SHELL = ['./','./index.html','./styles.css','./manifest.json','./assets/icon.svg','./assets/placeholder.svg','./src/app.js?v=1.2.0','./src/storage/indexedDb.js','./src/models/recipe.js','./src/components/icons.js','./src/components/editor.js','./src/utils/ingredients.js','./src/utils/image.js','./src/services/recipeImportService.js?v=1.1.0','./src/services/bringService.js?v=1.2.0'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === location.origin) event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response}).catch(()=>caches.match('./index.html'))));
  else if (event.request.destination === 'image') event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response}).catch(()=>caches.match('./assets/placeholder.svg'))));
});
