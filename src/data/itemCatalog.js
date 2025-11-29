// src/data/itemCatalog.js

/**
 * Catégories d'items (pour filtrer plus tard dans l'inventaire, boutiques, etc.)
 */
const ITEM_CATEGORIES = {
  WEAPON: 'weapon',
  CONSUMABLE: 'consumable',
  MONEY: 'money',
  MISC: 'misc',
};

/**
 * Catalogue des items.
 *
 * Chaque entrée:
 *  id: string (clé unique)
 *  label: nom lisible
 *  category: une des ITEM_CATEGORIES
 *  weight: poids en kg (ou équivalent)
 *  stackable: bool (peut se stacker dans un slot)
 *  consumable: bool (peut être "utilisé" / consommé)
 *  effect: optionnel (obj pour la logique plus tard : faim, soif, etc.)
 *  emoji: optionnel (pour les embeds)
 */
const itemCatalog = {
  // ───────────────────────────────────────────────────────────
  // ARGENT (présent automatiquement dans l'inventaire joueur)
  // ───────────────────────────────────────────────────────────
  money_cash: {
    id: 'money_cash',
    label: 'Argent liquide',
    category: ITEM_CATEGORIES.MONEY,
    weight: 0, // on considère que l’argent ne pèse rien pour le gameplay
    stackable: true,
    consumable: false,
    emoji: '💵',
  },

  // ───────────────────────────────────────────────────────────
  // ARMES
  // ───────────────────────────────────────────────────────────
  '9mm_gun': {
    id: '9mm_gun',
    label: 'Pistolet 9mm',
    category: ITEM_CATEGORIES.WEAPON,
    weight: 1.3,
    stackable: true,
    consumable: false,
    emoji: '🔫',
  },

  pistolet_combat: {
    id: 'pistolet_combat',
    label: 'Pistolet de combat',
    category: ITEM_CATEGORIES.WEAPON,
    weight: 1.5,
    stackable: true,
    consumable: false,
    emoji: '🔫',
  },

  // ───────────────────────────────────────────────────────────
  // CONSOMMABLES
  // ───────────────────────────────────────────────────────────

  // Exemple donné
  alcool_bouteille: {
    id: 'alcool_bouteille',
    label: 'Bouteille d’alcool',
    category: ITEM_CATEGORIES.CONSUMABLE,
    weight: 0.75,
    stackable: true,
    consumable: true,
    effect: {
      thirstDelta: +35,
      // plus tard : drunkLevel, blur, etc.
    },
    emoji: '🍾',
  },

  bouteille_eau: {
    id: 'bouteille_eau',
    label: 'Bouteille d’eau',
    category: ITEM_CATEGORIES.CONSUMABLE,
    weight: 0.5,
    stackable: true,
    consumable: true,
    effect: {
      thirstDelta: +40,
    },
    emoji: '🧴',
  },

  burger_poulet: {
    id: 'burger_poulet',
    label: 'Burger poulet',
    category: ITEM_CATEGORIES.CONSUMABLE,
    weight: 0.4,
    stackable: true,
    consumable: true,
    effect: {
      hungerDelta: +45,
    },
    emoji: '🍔',
  },

  cola_cup: {
    id: 'cola_cup',
    label: 'Gobelet de cola',
    category: ITEM_CATEGORIES.CONSUMABLE,
    weight: 0.3,
    stackable: true,
    consumable: true,
    effect: {
      thirstDelta: +30,
      sugarRush: true,
    },
    emoji: '🥤',
  },

  double_cheese: {
    id: 'double_cheese',
    label: 'Double cheese',
    category: ITEM_CATEGORIES.CONSUMABLE,
    weight: 0.45,
    stackable: true,
    consumable: true,
    effect: {
      hungerDelta: +55,
    },
    emoji: '🍔',
  },

  fries_box: {
    id: 'fries_box',
    label: 'Boîte de frites',
    category: ITEM_CATEGORIES.CONSUMABLE,
    weight: 0.25,
    stackable: true,
    consumable: true,
    effect: {
      hungerDelta: +25,
    },
    emoji: '🍟',
  },
};

/**
 * Récupérer un item par son id.
 */
function getItemById(id) {
  if (!id) return null;
  return itemCatalog[id] || null;
}

/**
 * Liste de tous les items (array)
 */
function getAllItems() {
  return Object.values(itemCatalog);
}

module.exports = {
  ITEM_CATEGORIES,
  itemCatalog,
  getItemById,
  getAllItems,
};
