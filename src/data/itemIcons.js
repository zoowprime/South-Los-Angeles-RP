// src/data/itemIcons.js
const path = require('path');

/**
 * Map itemId -> nom de fichier icône
 * Les fichiers doivent être dans: src/assets/icones/
 */
const ITEM_ICON_MAP = {
  // Argent
  money_cash: 'money_icon.png',

  // Armes
  '9mm_gun': '9mm_gun.png',
  pistolet_combat: 'pistolet_combat.png',

  // Consommables
  alcool_bouteille: 'alcool_bouteille.png', // si tu crées l’icône plus tard
  bouteille_eau: 'bouteille_eau.png',
  burger_poulet: 'burger_poulet.png',
  cola_cup: 'cola_cup.png',
  double_cheese: 'double_cheese.png',
  fries_box: 'fries_box.png',
};

/**
 * Retourne le nom de fichier pour un item donné (sans le chemin complet).
 */
function getItemIconFilename(itemId) {
  return ITEM_ICON_MAP[itemId] || null;
}

/**
 * Retourne le chemin complet vers l’icône (pour canvas, fs, etc.)
 * Exemple de résultat :
 *   /.../src/assets/icones/burger_poulet.png
 */
function getItemIconPath(itemId) {
  const filename = getItemIconFilename(itemId);
  if (!filename) return null;

  // __dirname = src/data → on remonte d’un cran vers src, puis assets/icones
  return path.join(__dirname, '..', 'assets', 'icones', filename);
}

module.exports = {
  ITEM_ICON_MAP,
  getItemIconFilename,
  getItemIconPath,
};
