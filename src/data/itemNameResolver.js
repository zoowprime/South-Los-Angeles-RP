// src/data/itemNameResolver.js
const { itemCatalog } = require('./itemCatalog');

/**
 * Normalise une chaîne (pour matcher "bouteille d’alcool" avec "bouteille alcool" par exemple)
 */
function normalize(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')                    // sépare lettres et accents
    .replace(/[\u0300-\u036f]/g, '')     // supprime les accents
    .replace(/[^a-z0-9]+/g, ' ')         // remplace tout ce qui n'est pas lettre/chiffre par espace
    .trim();
}

/**
 * Résout un nom fourni par le code (ou plus tard par un joueur)
 * vers un itemId du catalogue.
 *
 * Exemple :
 *  resolveItemId('Bouteille d’alcool') -> 'alcool_bouteille'
 *  resolveItemId('bouteille alcool')   -> 'alcool_bouteille'
 *  resolveItemId('9mm_gun')            -> '9mm_gun'
 */
function resolveItemId(input) {
  if (!input) return null;

  const normalizedInput = normalize(input);

  // 1) match direct sur l'id
  if (itemCatalog[input]) return input;

  // 2) Préparation de liste pour recherche
  const entries = Object.entries(itemCatalog); // [ [id, item], ... ]

  // 2.a) match exact sur id normalisé
  for (const [id] of entries) {
    if (normalize(id) === normalizedInput) {
      return id;
    }
  }

  // 2.b) match exact sur label normalisé
  for (const [id, item] of entries) {
    if (item.label && normalize(item.label) === normalizedInput) {
      return id;
    }
  }

  // 2.c) match partiel (contient) sur label
  for (const [id, item] of entries) {
    if (item.label && normalize(item.label).includes(normalizedInput)) {
      return id;
    }
  }

  // 2.d) match partiel sur id
  for (const [id] of entries) {
    if (normalize(id).includes(normalizedInput)) {
      return id;
    }
  }

  return null;
}

/**
 * Récupère l'item complet directement à partir du nom.
 */
function resolveItem(input) {
  const id = resolveItemId(input);
  if (!id) return null;
  return itemCatalog[id] || null;
}

module.exports = {
  resolveItemId,
  resolveItem,
};
