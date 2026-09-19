// A small promise-based wrapper around IndexedDB.
// Everything here stays on the owner's device -- nothing is ever sent over the network.
const DB_NAME = "cafeInsightsDB";
// Version history:
//   1 -> original release: "sales" + "settings" stores.
//   2 -> added "dayNotes" store (Phase 1: holidays & day notes). Existing
//        "sales" and "settings" data is untouched by this upgrade -- adding
//        a brand-new store never touches rows already saved in the others,
//        so nothing you've uploaded before is lost.
const DB_VERSION = 2;
const STORE_SALES = "sales";
const STORE_SETTINGS = "settings";
const STORE_DAY_NOTES = "dayNotes";

let dbPromise = null;

// If this page still has an old-version connection open when a newer tab
// (e.g. after an update) tries to upgrade the database, IndexedDB blocks
// that upgrade until every old connection closes. Without this handler, a
// stale background tab could block a new tab's DB open forever, with no
// error -- just a page that never finishes loading. This makes any old
// connection close itself as soon as a newer version wants to open.
function letOldConnectionStepAside(db) {
  db.onversionchange = () => db.close();
}

function openDB() {
  if (dbPromise) return dbPromise;
  const openPromise = new Promise((resolve, reject) => {
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
      if (!db.objectStoreNames.contains(STORE_DAY_NOTES)) {
        db.createObjectStore(STORE_DAY_NOTES, { keyPath: "date" });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      letOldConnectionStepAside(db);
      resolve(db);
    };
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => reject(new Error("DB_BLOCKED"));
  });
  // Guard against a hang (e.g. a stale tab that never releases its
  // connection) so the app can show a helpful message instead of a blank
  // page that never finishes loading.
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("DB_TIMEOUT")), 8000);
  });
  dbPromise = Promise.race([openPromise, timeout]).catch((err) => {
    dbPromise = null; // allow a retry (e.g. after the owner closes other tabs)
    throw err;
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
      const tx = db.transaction([STORE_SALES, STORE_SETTINGS, STORE_DAY_NOTES], "readwrite");
      tx.objectStore(STORE_SALES).clear();
      tx.objectStore(STORE_SETTINGS).clear();
      tx.objectStore(STORE_DAY_NOTES).clear();
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

  async getAllDayNotes() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DAY_NOTES, "readonly");
      const req = tx.objectStore(STORE_DAY_NOTES).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  // note: { date: "YYYY-MM-DD", text: "...", tags: ["rainy", ...] }
  async setDayNote(note) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DAY_NOTES, "readwrite");
      tx.objectStore(STORE_DAY_NOTES).put(note);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteDayNote(date) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DAY_NOTES, "readwrite");
      tx.objectStore(STORE_DAY_NOTES).delete(date);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async replaceAllDayNotes(notes) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_DAY_NOTES, "readwrite");
      const store = tx.objectStore(STORE_DAY_NOTES);
      store.clear();
      (notes || []).forEach((n) => store.add(n));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAllSettings() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, "readonly");
      const req = tx.objectStore(STORE_SETTINGS).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
};
