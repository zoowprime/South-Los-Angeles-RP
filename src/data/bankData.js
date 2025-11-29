// src/data/bankData.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const BANK_FILE = path.join(DATA_DIR, 'bank.json');

// 3 tentatives max
const MAX_PIN_ATTEMPTS = 3;
// Durée de blocage après trop de tentatives (en ms)
const PIN_LOCK_MS = (parseInt(process.env.BANK_PIN_LOCK_MINUTES || '10', 10) || 10) * 60 * 1000;

let data = {
  users: {},       // profils bancaires des joueurs
  enterprises: {}, // comptes entreprises
  lastSave: null,
};

let saving = false;
let pendingSave = false;

/* ────────────────────────────────────────────────────────────
 * IO
 * ──────────────────────────────────────────────────────────── */

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log('[BANK] DATA_DIR créé :', DATA_DIR);
    }
  } catch (err) {
    console.error('[BANK] Impossible de créer DATA_DIR :', err);
  }
}

function loadData() {
  ensureDataDir();
  if (!fs.existsSync(BANK_FILE)) {
    data = { users: {}, enterprises: {}, lastSave: null };
    saveSync();
    return;
  }

  try {
    const raw = fs.readFileSync(BANK_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    data.users = parsed.users || {};
    data.enterprises = parsed.enterprises || {};
    data.lastSave = parsed.lastSave || null;
    console.log(
      `[BANK] Données chargées. Utilisateurs: ${Object.keys(data.users).length}, entreprises: ${Object.keys(data.enterprises).length}`,
    );
  } catch (err) {
    console.error('[BANK] Erreur chargement bank.json, réinit :', err);
    data = { users: {}, enterprises: {}, lastSave: null };
  }
}

function saveSync() {
  try {
    ensureDataDir();
    data.lastSave = new Date().toISOString();
    fs.writeFileSync(BANK_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[BANK] Erreur saveSync :', err);
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

  fs.writeFile(BANK_FILE, JSON.stringify(data, null, 2), 'utf8', (err) => {
    saving = false;
    if (err) console.error('[BANK] Erreur save async :', err);
    if (pendingSave) {
      pendingSave = false;
      save();
    }
  });
}

/* ────────────────────────────────────────────────────────────
 * PROFIL UTILISATEUR
 * ──────────────────────────────────────────────────────────── */

function createEmptyUserProfile(userId) {
  const now = new Date().toISOString();
  return {
    id: String(userId),
    createdAt: now,
    updatedAt: now,
    status: 'active', // active | frozen | closed
    pin: null,
    pinAttempts: 0,
    pinLockedUntil: null,
    history: [], // { id, at, type, amount, balanceAfter, description, targetType, targetId, actorId }
  };
}

function getOrCreateUserProfile(userId) {
  if (!data.users) data.users = {};
  const key = String(userId);
  let profile = data.users[key];
  if (!profile) {
    profile = createEmptyUserProfile(key);
    data.users[key] = profile;
    save();
  }
  return profile;
}

function updateUserProfile(userId, updater) {
  const key = String(userId);
  const profile = getOrCreateUserProfile(key);

  if (typeof updater === 'function') {
    updater(profile);
  } else if (updater && typeof updater === 'object') {
    Object.assign(profile, updater);
  }

  profile.updatedAt = new Date().toISOString();
  data.users[key] = profile;
  save();
  return profile;
}

function setUserPin(userId, pin) {
  return updateUserProfile(userId, (p) => {
    p.pin = String(pin);
    p.pinAttempts = 0;
    p.pinLockedUntil = null;
  });
}

function isUserAccountClosed(userId) {
  const p = getOrCreateUserProfile(userId);
  return p.status === 'closed';
}

function isUserAccountFrozen(userId) {
  const p = getOrCreateUserProfile(userId);
  return p.status === 'frozen';
}

/**
 * Vérifie le PIN et gère les tentatives / lock.
 *
 * @returns {ok, reason?, attemptsLeft?, lockedUntil?}
 */
function verifyUserPin(userId, inputPin) {
  const profile = getOrCreateUserProfile(userId);
  const now = Date.now();

  if (!profile.pin) {
    return { ok: false, reason: 'no_pin' };
  }

  if (profile.pinLockedUntil && now < profile.pinLockedUntil) {
    return {
      ok: false,
      reason: 'locked',
      lockedUntil: profile.pinLockedUntil,
    };
  }

  if (String(inputPin) === String(profile.pin)) {
    profile.pinAttempts = 0;
    profile.pinLockedUntil = null;
    save();
    return { ok: true };
  }

  // Mauvais PIN
  profile.pinAttempts = (profile.pinAttempts || 0) + 1;

  if (profile.pinAttempts >= MAX_PIN_ATTEMPTS) {
    profile.pinLockedUntil = now + PIN_LOCK_MS;
    profile.pinAttempts = 0;
    save();
    return {
      ok: false,
      reason: 'too_many',
      lockedUntil: profile.pinLockedUntil,
    };
  }

  const attemptsLeft = MAX_PIN_ATTEMPTS - profile.pinAttempts;
  save();
  return { ok: false, reason: 'wrong', attemptsLeft };
}

function addUserHistoryEntry(userId, entry) {
  return updateUserProfile(userId, (p) => {
    if (!Array.isArray(p.history)) p.history = [];
    p.history.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...entry,
    });
    p.history = p.history.slice(0, 30); // on garde les 30 dernières
  });
}

/* ────────────────────────────────────────────────────────────
 * ENTREPRISES
 * ──────────────────────────────────────────────────────────── */

function createEnterprise(ownerId, name) {
  if (!data.enterprises) data.enterprises = {};
  const id = `ent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const accountNumber = `${Math.floor(100000 + Math.random() * 900000)}-${Math.floor(
    100000 + Math.random() * 900000,
  )}`;

  const now = new Date().toISOString();

  const ent = {
    id,
    ownerId: String(ownerId),
    name: String(name || 'Entreprise'),
    accountNumber,
    status: 'active', // active | frozen | closed
    createdAt: now,
    updatedAt: now,
    history: [], // { id, at, type, amount, balanceAfter, description, targetType, targetId, actorId }
  };

  data.enterprises[id] = ent;
  save();
  return ent;
}

function getEnterprise(entId) {
  return data.enterprises[String(entId)] || null;
}

function getEnterpriseByOwner(ownerId) {
  return Object.values(data.enterprises || {}).find((e) => e.ownerId === String(ownerId)) || null;
}

function updateEnterprise(entId, updater) {
  const ent = getEnterprise(entId);
  if (!ent) return null;

  if (typeof updater === 'function') {
    updater(ent);
  } else if (updater && typeof updater === 'object') {
    Object.assign(ent, updater);
  }

  ent.updatedAt = new Date().toISOString();
  data.enterprises[entId] = ent;
  save();
  return ent;
}

function addEnterpriseHistoryEntry(entId, entry) {
  return updateEnterprise(entId, (e) => {
    if (!Array.isArray(e.history)) e.history = [];
    e.history.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...entry,
    });
    e.history = e.history.slice(0, 30);
  });
}

function isEnterpriseFrozen(entId) {
  const e = getEnterprise(entId);
  return e?.status === 'frozen';
}

function isEnterpriseClosed(entId) {
  const e = getEnterprise(entId);
  return e?.status === 'closed';
}

/* ────────────────────────────────────────────────────────────
 * INIT
 * ──────────────────────────────────────────────────────────── */
loadData();

module.exports = {
  // user
  getOrCreateUserProfile,
  setUserPin,
  verifyUserPin,
  addUserHistoryEntry,
  isUserAccountClosed,
  isUserAccountFrozen,

  // enterprise
  createEnterprise,
  getEnterprise,
  getEnterpriseByOwner,
  addEnterpriseHistoryEntry,
  isEnterpriseClosed,
  isEnterpriseFrozen,
};
