const DB_NAME = 'mise-recipe-library';
const DB_VERSION = 1;
const stores = ['recipes', 'shopping', 'settings'];

let dbPromise;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      stores.forEach((name) => {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function request(storeName, mode, operation) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = operation(tx.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export const db = {
  all: (store) => request(store, 'readonly', (s) => s.getAll()),
  get: (store, id) => request(store, 'readonly', (s) => s.get(id)),
  put: (store, value) => request(store, 'readwrite', (s) => s.put(value)),
  delete: (store, id) => request(store, 'readwrite', (s) => s.delete(id)),
  clear: (store) => request(store, 'readwrite', (s) => s.clear()),
  async exportAll() {
    const [recipes, shopping, settings] = await Promise.all(stores.map((s) => this.all(s)));
    return { format: 'rezapp-backup', version: 1, exportedAt: new Date().toISOString(), recipes, shopping, settings };
  },
  async importAll(data) {
    if (!['rezapp-backup', 'mise-backup'].includes(data?.format) || !Array.isArray(data.recipes)) throw new Error('Keine gültige Rezapp-Sicherungsdatei.');
    await Promise.all(stores.map((s) => this.clear(s)));
    for (const store of stores) for (const item of (data[store] || [])) await this.put(store, item);
  },
  async clearAll() { await Promise.all(stores.map((s) => this.clear(s))); }
};
