// src/data/inventoryStore.js
const fs = require('fs');
const path = require('path');
const { itemCatalog } = require('./itemCatalog');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');

// 1h30 -> 0% faim
const HUNGER_FULL_MS = 90 * 60 * 1000;
// 1h -> 0% soif
const THIRST_FULL_MS = 60 * 60 * 1000;

let state = {
  users: {},   // { [userId]: UserInventory }
  lastSave: null,
};

let saving = false;
let pendingSave = false;

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log('[INV] DATA_DIR créé :', DATA_DIR);
    }
  } catch (err) {
    console.error('[INV] Impossible de créer DATA_DIR :', err);
  }
}

function loadState() {
  ensureDataDir();
  if (!fs.existsSync(INVENTORY_FILE)) {
    state = { users: {}, lastSave: null };
    saveStateSync();
    return;
  }

  try {
    const raw = fs.readFileSync(INVENTORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    state.users = parsed.users || {};
    state.lastSave = parsed.lastSave || null;
    console.log('[INV] Inventaires chargés pour', Object.keys(state.users).length, 'joueurs');
  } catch (err) {
    console.error('[INV] Erreur chargement inventory.json, réinit :', err);
    state = { users: {}, lastSave: null };
  }
}

function saveStateSync() {
  try {
    ensureDataDir();
    state.lastSave = new Date().toISOString();
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[INV] Erreur save sync :', err);
  }
}

function saveState() {
  if (saving) {
    pendingSave = true;
    return;
  }

  saving = true;
  ensureDataDir();
  state.lastSave = new Date().toISOString();

  fs.writeFile(INVENTORY_FILE, JSON.stringify(state, null, 2), 'utf8', (err) => {
    saving = false;
    if (err) console.error('[INV] Erreur sauvegarde async :', err);
    if (pendingSave) {
      pendingSave = false;
      saveState();
    }
  });
}

/* ────────────────────────────────────────────────────────────
 * Faim / Soif
 * ──────────────────────────────────────────────────────────── */

function applyDecay(user) {
  const now = Date.now();
  if (!user.lastUpdate) {
    user.lastUpdate = now;
    if (typeof user.hunger !== 'number') user.hunger = 100;
    if (typeof user.thirst !== 'number') user.thirst = 100;
    return;
  }

  const delta = now - user.lastUpdate;
  user.lastUpdate = now;

  if (typeof user.hunger !== 'number') user.hunger = 100;
  if (typeof user.thirst !== 'number') user.thirst = 100;

  const hungerLoss = (delta / HUNGER_FULL_MS) * 100;
  const thirstLoss = (delta / THIRST_FULL_MS) * 100;

  user.hunger = Math.max(0, user.hunger - hungerLoss);
  user.thirst = Math.max(0, user.thirst - thirstLoss);
}

function changeHungerThirst(userId, { hungerDelta = 0, thirstDelta = 0 }) {
  const user = getOrCreateUserInventory(userId);
  applyDecay(user);

  user.hunger = Math.max(0, Math.min(100, user.hunger + hungerDelta));
  user.thirst = Math.max(0, Math.min(100, user.thirst + thirstDelta));

  saveState();
  return getUserSnapshot(userId);
}

/* ────────────────────────────────────────────────────────────
 * Inventaire
 * ──────────────────────────────────────────────────────────── */

function createEmptyUserInventory(userId) {
  const now = Date.now();
  return {
    id: String(userId),
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    items: {}, // { [itemId]: { id, quantity } }
    hunger: 100,
    thirst: 100,
    lastUpdate: now,
  };
}

function getOrCreateUserInventory(userId) {
  if (!state.users) state.users = {};
  const key = String(userId);
  let user = state.users[key];

  if (!user) {
    user = createEmptyUserInventory(key);
    state.users[key] = user;
    saveState();
  }

  applyDecay(user);
  return user;
}

function getUserSnapshot(userId) {
  const u = getOrCreateUserInventory(userId);
  return JSON.parse(JSON.stringify(u));
}

function getTotalWeight(userId) {
  const inv = getOrCreateUserInventory(userId);
  let total = 0;

  for (const [itemId, entry] of Object.entries(inv.items || {})) {
    const def = itemCatalog[itemId];
    if (!def) continue;
    const w = typeof def.weight === 'number' ? def.weight : 0;
    total += w * (entry.quantity || 0);
  }

  return total;
}

/**
 * Ajoute **quantité** d'un item, en respectant la limite de 8kg.
 * Retourne { ok: boolean, reason?, newInventory?, newWeight? }
 */
function addItem(userId, itemId, quantity = 1) {
  const q = Math.max(1, Math.floor(quantity));
  const inv = getOrCreateUserInventory(userId);
  const def = itemCatalog[itemId];

  if (!def) {
    return { ok: false, reason: 'unknown_item' };
  }

  const currentWeight = getTotalWeight(userId);
  const itemWeight = typeof def.weight === 'number' ? def.weight : 0;
  const addedWeight = itemWeight * q;

  if (currentWeight + addedWeight > 8) {
    return { ok: false, reason: 'overweight', currentWeight, addedWeight };
  }

  if (!inv.items[itemId]) {
    inv.items[itemId] = { id: itemId, quantity: 0 };
  }

  inv.items[itemId].quantity += q;
  inv.updatedAt = new Date().toISOString();

  saveState();
  return {
    ok: true,
    newInventory: getUserSnapshot(userId),
    newWeight: getTotalWeight(userId),
  };
}

/**
 * Retire quantité d'un item (sans aller en dessous de 0).
 * Retourne { ok, removed, remaining }
 */
function removeItem(userId, itemId, quantity = 1) {
  const q = Math.max(1, Math.floor(quantity));
  const inv = getOrCreateUserInventory(userId);
  const entry = inv.items[itemId];

  if (!entry || entry.quantity <= 0) {
    return { ok: false, reason: 'no_item' };
  }

  const removed = Math.min(q, entry.quantity);
  entry.quantity -= removed;

  if (entry.quantity <= 0) {
    delete inv.items[itemId];
  }

  inv.updatedAt = new Date().toISOString();
  saveState();

  return {
    ok: true,
    removed,
    remaining: inv.items[itemId]?.quantity || 0,
  };
}

/**
 * Réinitialise l’inventaire (utile pour debug)
 */
function clearInventory(userId) {
  const inv = getOrCreateUserInventory(userId);
  inv.items = {};
  inv.updatedAt = new Date().toISOString();
  saveState();
  return getUserSnapshot(userId);
}

loadState();

module.exports = {
  getOrCreateUserInventory,
  getUserSnapshot,
  getTotalWeight,
  addItem,
  removeItem,
  clearInventory,
  changeHungerThirst,
};
