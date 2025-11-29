// src/data/economyData.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ECON_FILE = path.join(DATA_DIR, 'economy.json');

let data = {
  users: {},   // { [userId]: { id, createdAt, updatedAt, courant: { cash, banque } } }
  lastSave: null,
};

let saving = false;
let pendingSave = false;

/* ────────────────────────────────────────────────────────────
 * IO helpers
 * ──────────────────────────────────────────────────────────── */

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log('[ECO] DATA_DIR créé :', DATA_DIR);
    }
  } catch (err) {
    console.error('[ECO] Impossible de créer DATA_DIR :', err);
  }
}

function loadData() {
  ensureDataDir();
  if (!fs.existsSync(ECON_FILE)) {
    data = { users: {}, lastSave: null };
    saveSync();
    return;
  }

  try {
    const raw = fs.readFileSync(ECON_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    data.users = parsed.users || {};
    data.lastSave = parsed.lastSave || null;
    console.log(`[ECO] Données chargées. Comptes: ${Object.keys(data.users).length}`);
  } catch (err) {
    console.error('[ECO] Erreur chargement economy.json, réinit :', err);
    data = { users: {}, lastSave: null };
  }
}

function saveSync() {
  try {
    ensureDataDir();
    data.lastSave = new Date().toISOString();
    fs.writeFileSync(ECON_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[ECO] Erreur saveSync :', err);
  }
}

function save() {
  if (saving) {
    pendingSave = true;
    return;
  }
  saving = true;
  ensureDataDir();
  data.lastSave = new Date().toISOString();

  fs.writeFile(ECON_FILE, JSON.stringify(data, null, 2), 'utf8', (err) => {
    saving = false;
    if (err) console.error('[ECO] Erreur save async :', err);
    if (pendingSave) {
      pendingSave = false;
      save();
    }
  });
}

/* ────────────────────────────────────────────────────────────
 * Core
 * ──────────────────────────────────────────────────────────── */

function createEmptyAccount(userId) {
  const now = new Date().toISOString();
  return {
    id: String(userId),
    createdAt: now,
    updatedAt: now,
    courant: {
      cash: 0,   // argent liquide
      banque: 0, // solde bancaire
    },
  };
}

function getOrCreateAccount(userId) {
  if (!data.users) data.users = {};
  const key = String(userId);
  let acc = data.users[key];
  if (!acc) {
    acc = createEmptyAccount(key);
    data.users[key] = acc;
    save();
  }
  return acc;
}

/**
 * updateAccount(userId, updater)
 * - updater peut être une fonction(acc) ou un objet à merge
 */
function updateAccount(userId, updater) {
  const key = String(userId);
  const acc = getOrCreateAccount(key);

  if (typeof updater === 'function') {
    updater(acc);
  } else if (updater && typeof updater === 'object') {
    Object.assign(acc, updater);
  }

  acc.updatedAt = new Date().toISOString();
  data.users[key] = acc;
  save();
  return acc;
}

/* ────────────────────────────────────────────────────────────
 * Init
 * ──────────────────────────────────────────────────────────── */

loadData();

module.exports = {
  getOrCreateAccount,
  updateAccount,
};
