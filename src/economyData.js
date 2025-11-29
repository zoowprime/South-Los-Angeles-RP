// src/economyData.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ECON_FILE = path.join(DATA_DIR, 'economy.json');

// Structure en mémoire
let econData = {
  users: {},      // comptes joueurs
  companies: {},  // comptes entreprises
  lastSave: null,
};

let saving = false;
let pendingSave = false;

/* ────────────────────────────────────────────────────────────
 * INIT / IO
 * ──────────────────────────────────────────────────────────── */

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log('[ECON] DATA_DIR créé :', DATA_DIR);
    }
  } catch (err) {
    console.error('[ECON] Impossible de créer DATA_DIR :', err);
  }
}

function loadData() {
  ensureDataDir();

  if (!fs.existsSync(ECON_FILE)) {
    console.log('[ECON] Aucun fichier economy.json, initialisation...');
    econData = { users: {}, companies: {}, lastSave: null };
    saveDataSync();
    return;
  }

  try {
    const raw = fs.readFileSync(ECON_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    econData.users = parsed.users || {};
    econData.companies = parsed.companies || {};
    econData.lastSave = parsed.lastSave || null;

    console.log(
      `[ECON] Données chargées. Joueurs: ${Object.keys(econData.users).length}, entreprises: ${Object.keys(econData.companies).length}`,
    );
  } catch (err) {
    console.error('[ECON] Erreur chargement economy.json, réinitialisation :', err);
    econData = { users: {}, companies: {}, lastSave: null };
  }
}

function saveDataSync() {
  try {
    ensureDataDir();
    econData.lastSave = new Date().toISOString();
    fs.writeFileSync(ECON_FILE, JSON.stringify(econData, null, 2), 'utf8');
  } catch (err) {
    console.error('[ECON] Erreur save sync :', err);
  }
}

function saveData() {
  if (saving) {
    pendingSave = true;
    return;
  }

  saving = true;
  ensureDataDir();
  econData.lastSave = new Date().toISOString();

  fs.writeFile(ECON_FILE, JSON.stringify(econData, null, 2), 'utf8', (err) => {
    saving = false;
    if (err) console.error('[ECON] Erreur sauvegarde async :', err);
    if (pendingSave) {
      pendingSave = false;
      saveData();
    }
  });
}

/* ────────────────────────────────────────────────────────────
 * COMPTES JOUEURS (compte courant par défaut)
 * ──────────────────────────────────────────────────────────── */

function createEmptyUserAccount(userId) {
  const now = new Date().toISOString();

  return {
    id: String(userId),
    createdAt: now,
    updatedAt: now,

    // Compte courant : TOUS les joueurs en ont un
    courant: {
      cash: 0,
      banque: 0,
    },

    stats: {
      earnedTotal: 0,
      spentTotal: 0,
      transfersIn: 0,
      transfersOut: 0,
    },

    meta: {
      lastKnownTag: null,
      lastReasons: [],
    },

    flags: {
      blacklisted: false,
    },
  };
}

/**
 * Récupère ou crée un compte joueur (compte courant par défaut)
 */
function getOrCreateAccount(userId) {
  if (!econData.users) econData.users = {};
  const key = String(userId);

  let acc = econData.users[key];
  if (!acc) {
    acc = createEmptyUserAccount(key);
    econData.users[key] = acc;
    saveData();
  }

  return acc;
}

/**
 * Mise à jour d’un compte joueur (courant uniquement ici)
 */
function updateAccount(userId, updater) {
  const key = String(userId);
  const account = getOrCreateAccount(key);

  if (typeof updater === 'function') {
    updater(account);
  } else if (updater && typeof updater === 'object') {
    Object.assign(account, updater);
  }

  account.updatedAt = new Date().toISOString();
  econData.users[key] = account;
  saveData();
  return account;
}

function getAccountSnapshot(userId) {
  const acc = getOrCreateAccount(userId);
  return JSON.parse(JSON.stringify(acc));
}

function listAccountIds() {
  return Object.keys(econData.users || {});
}

/* ────────────────────────────────────────────────────────────
 * COMPTES ENTREPRISE (créés UNIQUEMENT sur demande)
 * ──────────────────────────────────────────────────────────── */

/**
 * Crée un compte entreprise.
 * NE PAS appeler automatiquement : réservé aux commandes banquier/staff.
 *
 * @param {string} companyId  - ID unique de l’entreprise (ex: "LSBANK", "BURGERSHOT_01"...)
 * @param {object} options    - { name, ownerId }
 */
function createCompanyAccount(companyId, { name, ownerId }) {
  if (!econData.companies) econData.companies = {};

  const key = String(companyId);
  if (econData.companies[key]) {
    throw new Error('Company already exists for id ' + key);
  }

  const now = new Date().toISOString();

  const company = {
    id: key,
    name: String(name || 'Entreprise'),
    ownerId: ownerId ? String(ownerId) : null,
    createdAt: now,
    updatedAt: now,
    balances: {
      cash: 0,
      banque: 0,
    },
    stats: {
      earnedTotal: 0,
      spentTotal: 0,
    },
    members: [], // tu pourras plus tard y mettre des IDs d’employés
    meta: {},
  };

  econData.companies[key] = company;
  saveData();

  return company;
}

function getCompanyAccount(companyId) {
  if (!econData.companies) econData.companies = {};
  return econData.companies[String(companyId)] || null;
}

/**
 * Met à jour un compte entreprise.
 * NE crée pas de compte si l’entreprise n’existe pas.
 */
function updateCompanyAccount(companyId, updater) {
  if (!econData.companies) econData.companies = {};
  const key = String(companyId);
  const company = econData.companies[key];

  if (!company) {
    throw new Error('Company does not exist for id ' + key);
  }

  if (typeof updater === 'function') {
    updater(company);
  } else if (updater && typeof updater === 'object') {
    Object.assign(company, updater);
  }

  company.updatedAt = new Date().toISOString();
  econData.companies[key] = company;
  saveData();

  return company;
}

function getCompanySnapshot(companyId) {
  const comp = getCompanyAccount(companyId);
  return comp ? JSON.parse(JSON.stringify(comp)) : null;
}

function listCompanyIds() {
  return Object.keys(econData.companies || {});
}

/* ────────────────────────────────────────────────────────────
 * DEBUG / RAW
 * ──────────────────────────────────────────────────────────── */

function getRawData() {
  return econData;
}

/* ────────────────────────────────────────────────────────────
 * INIT
 * ──────────────────────────────────────────────────────────── */
loadData();

module.exports = {
  // joueurs
  getOrCreateAccount,
  updateAccount,
  getAccountSnapshot,
  listAccountIds,

  // entreprises
  createCompanyAccount,
  getCompanyAccount,
  updateCompanyAccount,
  getCompanySnapshot,
  listCompanyIds,

  // global
  getRawData,
  saveData,
};
