// A small promise-based wrapper around IndexedDB.
// Everything here stays on the owner's device -- nothing is ever sent over the network.
const DB_NAME = "cafeInsightsDB";
const DB_VERSION = 1;
const STORE_SALES = "sales";
const STORE_SETTINGS = "settings";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SALES)) {
        const store = db.createObjectStore(STORE_SALES, { keyPath: "id", autoIncrement: true });
        store.createIndex("fingerprint", "fingerprint", { unique: false });
        store.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

const DB = {
  async getAllRows() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SALES, "readonly");
      const store = tx.objectStore(STORE_SALES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async addRows(rows) {
    if (!rows.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SALES, "readwrite");
      const store = tx.objectStore(STORE_SALES);
      rows.forEach((r) => store.add(r));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clearAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SALES, STORE_SETTINGS], "readwrite");
      tx.objectStore(STORE_SALES).clear();
      tx.objectStore(STORE_SETTINGS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async replaceAllRows(rows) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SALES, "readwrite");
      const store = tx.objectStore(STORE_SALES);
      store.clear();
      rows.forEach((r) => {
        const copy = Object.assign({}, r);
        delete copy.id; // let autoIncrement re-assign ids
        store.add(copy);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getSetting(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, "readonly");
      const req = tx.objectStore(STORE_SETTINGS).get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  },

  async setSetting(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, "readwrite");
      tx.objectStore(STORE_SETTINGS).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
