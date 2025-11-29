// src/economy.js
const {
  getOrCreateAccount,
  updateAccount,
  getAccountSnapshot,
  createCompanyAccount,
  getCompanyAccount,
  updateCompanyAccount,
  getCompanySnapshot,
} = require('./economyData');

/* ────────────────────────────────────────────────────────────
 * JOUEURS : COMPTE COURANT
 * ──────────────────────────────────────────────────────────── */

function getBalance(userId) {
  const acc = getOrCreateAccount(userId);
  const cash = acc.courant?.cash || 0;
  const banque = acc.courant?.banque || 0;

  return {
    cash,
    banque,
    total: cash + banque,
  };
}

/**
 * Ajout / retrait d’argent sur le compte courant
 * type: 'cash' ou 'banque'
 */
function addMoney(userId, amount, type = 'cash', { reason = null } = {}) {
  if (typeof amount !== 'number' || isNaN(amount) || amount === 0) {
    throw new Error('Montant invalide pour addMoney');
  }
  if (!['cash', 'banque'].includes(type)) {
    throw new Error('Type de solde invalide pour addMoney (cash ou banque)');
  }

  return updateAccount(userId, (acc) => {
    if (!acc.courant) acc.courant = { cash: 0, banque: 0 };
    if (!acc.stats) acc.stats = { earnedTotal: 0, spentTotal: 0, transfersIn: 0, transfersOut: 0 };
    if (!acc.meta) acc.meta = { lastKnownTag: null, lastReasons: [] };

    const before = acc.courant[type] || 0;
    const after = before + amount;

    acc.courant[type] = Math.max(0, Math.round(after));

    if (amount > 0) {
      acc.stats.earnedTotal += amount;
    } else {
      acc.stats.spentTotal += Math.abs(amount);
    }

    if (reason) {
      acc.meta.lastReasons.unshift({
        reason: String(reason),
        amount,
        type,
        at: new Date().toISOString(),
      });
      acc.meta.lastReasons = acc.meta.lastReasons.slice(0, 10);
    }
  });
}

function moveCashToBank(userId, amount) {
  if (amount <= 0) throw new Error('Montant invalide dans moveCashToBank');

  return updateAccount(userId, (acc) => {
    if (!acc.courant) acc.courant = { cash: 0, banque: 0 };
    const cash = acc.courant.cash || 0;
    const banque = acc.courant.banque || 0;

    if (cash < amount) {
      throw new Error('Fonds insuffisants en cash');
    }

    acc.courant.cash = Math.round(cash - amount);
    acc.courant.banque = Math.round(banque + amount);
  });
}

function moveBankToCash(userId, amount) {
  if (amount <= 0) throw new Error('Montant invalide dans moveBankToCash');

  return updateAccount(userId, (acc) => {
    if (!acc.courant) acc.courant = { cash: 0, banque: 0 };
    const cash = acc.courant.cash || 0;
    const banque = acc.courant.banque || 0;

    if (banque < amount) {
      throw new Error('Fonds insuffisants en banque');
    }

    acc.courant.banque = Math.round(banque - amount);
    acc.courant.cash = Math.round(cash + amount);
  });
}

/**
 * Transfert entre deux comptes courants joueurs (cash → cash)
 */
function transferBetweenUsers(fromUserId, toUserId, amount) {
  if (amount <= 0) throw new Error('Montant invalide pour un transfert');
  const amt = Math.round(amount);

  // Débiter l’émetteur
  let fromSnapshot;
  updateAccount(fromUserId, (acc) => {
    if (!acc.courant) acc.courant = { cash: 0, banque: 0 };
    if (!acc.stats) acc.stats = { earnedTotal: 0, spentTotal: 0, transfersIn: 0, transfersOut: 0 };

    const cash = acc.courant.cash || 0;
    if (cash < amt) {
      throw new Error('Fonds insuffisants chez l’émetteur');
    }

    acc.courant.cash = cash - amt;
    acc.stats.spentTotal += amt;
    acc.stats.transfersOut += amt;
    fromSnapshot = getAccountSnapshot(fromUserId);
  });

  // Créditer le receveur
  updateAccount(toUserId, (acc) => {
    if (!acc.courant) acc.courant = { cash: 0, banque: 0 };
    if (!acc.stats) acc.stats = { earnedTotal: 0, spentTotal: 0, transfersIn: 0, transfersOut: 0 };

    const cash = acc.courant.cash || 0;
    acc.courant.cash = cash + amt;
    acc.stats.earnedTotal += amt;
    acc.stats.transfersIn += amt;
  });

  const toSnapshot = getAccountSnapshot(toUserId);

  return {
    amount: amt,
    from: fromSnapshot,
    to: toSnapshot,
  };
}

/* ────────────────────────────────────────────────────────────
 * ENTREPRISES : création & gestion
 * ──────────────────────────────────────────────────────────── */

/**
 * Création d’un compte entreprise.
 * ⚠️ À appeler UNIQUEMENT depuis une commande banquier/staff.
 */
function createEnterprise(companyId, { name, ownerId }) {
  return createCompanyAccount(companyId, { name, ownerId });
}

function getEnterpriseBalance(companyId) {
  const comp = getCompanyAccount(companyId);
  if (!comp) return null;

  const cash = comp.balances?.cash || 0;
  const banque = comp.balances?.banque || 0;

  return {
    cash,
    banque,
    total: cash + banque,
  };
}

/**
 * Ajout / retrait d’argent sur un compte entreprise
 * type: 'cash' ou 'banque'
 */
function addEnterpriseMoney(companyId, amount, type = 'banque', { reason = null } = {}) {
  if (typeof amount !== 'number' || isNaN(amount) || amount === 0) {
    throw new Error('Montant invalide pour addEnterpriseMoney');
  }
  if (!['cash', 'banque'].includes(type)) {
    throw new Error('Type de solde invalide (cash ou banque)');
  }

  return updateCompanyAccount(companyId, (comp) => {
    if (!comp.balances) comp.balances = { cash: 0, banque: 0 };
    if (!comp.stats) comp.stats = { earnedTotal: 0, spentTotal: 0 };
    if (!comp.meta) comp.meta = {};

    const before = comp.balances[type] || 0;
    const after = before + amount;

    comp.balances[type] = Math.max(0, Math.round(after));

    if (amount > 0) {
      comp.stats.earnedTotal += amount;
    } else {
      comp.stats.spentTotal += Math.abs(amount);
    }

    if (reason) {
      if (!comp.meta.lastReasons) comp.meta.lastReasons = [];
      comp.meta.lastReasons.unshift({
        reason: String(reason),
        amount,
        type,
        at: new Date().toISOString(),
      });
      comp.meta.lastReasons = comp.meta.lastReasons.slice(0, 10);
    }
  });
}

/**
 * Transfert joueur -> entreprise (paiement d’un service)
 */
function transferUserToEnterprise(fromUserId, companyId, amount) {
  if (amount <= 0) throw new Error('Montant invalide pour un transfert');
  const amt = Math.round(amount);

  // Débiter joueur (cash)
  updateAccount(fromUserId, (acc) => {
    if (!acc.courant) acc.courant = { cash: 0, banque: 0 };
    const cash = acc.courant.cash || 0;
    if (cash < amt) throw new Error('Fonds insuffisants chez le joueur');
    acc.courant.cash = cash - amt;

    if (!acc.stats) acc.stats = { earnedTotal: 0, spentTotal: 0, transfersIn: 0, transfersOut: 0 };
    acc.stats.spentTotal += amt;
    acc.stats.transfersOut += amt;
  });

  // Créditer entreprise (banque par défaut)
  addEnterpriseMoney(companyId, amt, 'banque', { reason: `Paiement joueur ${fromUserId}` });

  return {
    amount: amt,
    user: getAccountSnapshot(fromUserId),
    company: getCompanySnapshot(companyId),
  };
}

/**
 * Transfert entreprise -> joueur (salaire par exemple)
 */
function transferEnterpriseToUser(companyId, toUserId, amount, { as = 'cash' } = {}) {
  if (amount <= 0) throw new Error('Montant invalide pour un transfert');
  if (!['cash', 'banque'].includes(as)) throw new Error('Type cible invalide pour joueur (cash / banque)');

  const amt = Math.round(amount);

  // Débiter entreprise (banque par défaut)
  updateCompanyAccount(companyId, (comp) => {
    if (!comp.balances) comp.balances = { cash: 0, banque: 0 };
    const banque = comp.balances.banque || 0;
    if (banque < amt) throw new Error('Fonds insuffisants sur le compte entreprise');
    comp.balances.banque = banque - amt;

    if (!comp.stats) comp.stats = { earnedTotal: 0, spentTotal: 0 };
    comp.stats.spentTotal += amt;
  });

  // Créditer joueur
  addMoney(toUserId, amt, as, { reason: `Salaire / paiement entreprise ${companyId}` });

  return {
    amount: amt,
    user: getAccountSnapshot(toUserId),
    company: getCompanySnapshot(companyId),
  };
}

/* ────────────────────────────────────────────────────────────
 * BLACKLIST
 * ──────────────────────────────────────────────────────────── */

function setBlacklisted(userId, value = true) {
  return updateAccount(userId, (acc) => {
    if (!acc.flags) acc.flags = {};
    acc.flags.blacklisted = !!value;
  });
}

function isBlacklisted(userId) {
  const acc = getOrCreateAccount(userId);
  return !!(acc.flags && acc.flags.blacklisted);
}

module.exports = {
  // joueurs
  getBalance,
  addMoney,
  moveCashToBank,
  moveBankToCash,
  transferBetweenUsers,

  // entreprises
  createEnterprise,
  getEnterpriseBalance,
  addEnterpriseMoney,
  transferUserToEnterprise,
  transferEnterpriseToUser,

  // flags
  setBlacklisted,
  isBlacklisted,
};
