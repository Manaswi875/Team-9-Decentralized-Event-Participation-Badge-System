/**
 * Owns the single in-memory data store and exposes controlled access to it.
 * All mutations happen through the objects returned by getStore(); call
 * persistStore() after any write to flush changes to disk.
 */

const { ensureDirectory, loadStore, saveStore } = require("./lib/storage");
const config = require("./lib/config");

// Guarantee the data and email-preview directories exist at startup.
ensureDirectory(config.DATA_DIR);
ensureDirectory(config.EMAIL_PREVIEW_DIR);

/** @type {import('./lib/storage').Store} */
let store = loadStore(config.STORE_FILE);

/**
 * Return the current in-memory store object.
 * Callers receive a live reference; mutations are reflected immediately.
 */
function getStore() {
  return store;
}

/** Flush the current in-memory store to disk. */
function persistStore() {
  saveStore(config.STORE_FILE, store);
}

/**
 * Re-read the store from disk, replacing the in-memory copy.
 * Use this when another process may have written to the store file.
 *
 * @returns {import('./lib/storage').Store} The freshly-loaded store
 */
function refreshStoreFromDisk() {
  store = loadStore(config.STORE_FILE);
  return store;
}

module.exports = { getStore, persistStore, refreshStoreFromDisk };
