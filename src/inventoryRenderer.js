// src/inventoryRenderer.js
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { itemCatalog } = require('./data/itemCatalog');
const { getItemIconPath } = require('./data/itemIcons');
const { getUserSnapshot, getTotalWeight } = require('./data/inventoryStore');

// Police Open Sans (adapte le chemin si différent)
try {
  registerFont(path.join(__dirname, 'assets', 'fonts', 'OpenSans-Regular.ttf'), {
    family: 'OpenSans',
  });
} catch (e) {
  // Si la police n'existe pas encore, on laisse la police par défaut
  console.warn('[INV] Impossible de charger OpenSans-Regular, utilisation police par défaut.');
}

// Taille de l’inventaire
const WIDTH = 1200;
const HEIGHT = 700;

// Grille 3 x 5
const COLS = 3;
const ROWS = 5;

// On centre grossièrement la grille sur l'image
const GRID_WIDTH = WIDTH * 0.8;   // 80% de largeur
const GRID_HEIGHT = HEIGHT * 0.7; // 70% de hauteur
const GRID_X = (WIDTH - GRID_WIDTH) / 2;
const GRID_Y = (HEIGHT - GRID_HEIGHT) / 2;

const CELL_W = GRID_WIDTH / COLS;
const CELL_H = GRID_HEIGHT / ROWS;

// URLs des fonds selon le poids
function getBackgroundUrl(weight) {
  const w = weight || 0;

  if (w <= 0) {
    return 'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_clean.png';
  }
  if (w > 0 && w < 2) {
    return 'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_1kg-2kg.png';
  }
  if (w === 2) {
    return 'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_2kg.png';
  }
  if (w > 2 && w < 3) {
    return 'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_2kg-3kg.png';
  }
  if (w >= 4 && w < 5) {
    return 'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_4kg-5kg.png';
  }
  if (w >= 5 && w < 6) {
    return 'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_5kg-6kg.png';
  }
  if (w === 7) {
    return 'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_7kg.png';
  }
  if (w >= 8) {
    return 'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_full.png';
  }

  // fallback
  return 'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_clean.png';
}

/**
 * Dessine le texte centré dans une case
 */
function drawCenteredText(ctx, text, x, y, maxWidth) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y, maxWidth);
}

/**
 * Rendu complet de l’inventaire d’un joueur
 * Retourne { buffer, filename }
 */
async function renderInventory(userId) {
  const snapshot = getUserSnapshot(userId);
  const weight = Math.round(getTotalWeight(userId) * 10) / 10; // 1 décimale

  const bgUrl = getBackgroundUrl(weight);
  const bgImage = await loadImage(bgUrl);

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Fond
  ctx.drawImage(bgImage, 0, 0, WIDTH, HEIGHT);

  // Style texte général
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px OpenSans';

  // Items : on les range dans un array (max 15)
  const entries = Object.values(snapshot.items || {}).filter(e => e.quantity > 0);
  entries.sort((a, b) => a.id.localeCompare(b.id));
  const limited = entries.slice(0, COLS * ROWS);

  for (let index = 0; index < limited.length; index++) {
    const entry = limited[index];
    const itemDef = itemCatalog[entry.id];
    if (!itemDef) continue;

    const col = index % COLS;
    const row = Math.floor(index / COLS);

    const cellX = GRID_X + col * CELL_W;
    const cellY = GRID_Y + row * CELL_H;
    const centerX = cellX + CELL_W / 2;
    const centerY = cellY + CELL_H / 2;

    // Icône
    const iconPath = getItemIconPath(entry.id);
    if (iconPath) {
      try {
        const icon = await loadImage(iconPath);
        const iconSize = Math.min(CELL_W, CELL_H) * 0.6;
        const iconX = centerX - iconSize / 2;
        const iconY = centerY - iconSize / 2 - 5;

        ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
      } catch (e) {
        console.warn('[INV] Impossible de charger icône pour', entry.id, iconPath, e);
      }
    }

    // Texte en haut gauche : xN
    const qtyText = `x${entry.quantity}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '16px OpenSans';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(qtyText, cellX + 8, cellY + 4);

    // Texte en haut droite : poids individuel
    const w = typeof itemDef.weight === 'number' ? itemDef.weight : 0;
    const wText = `${w}kg`;
    ctx.textAlign = 'right';
    ctx.fillText(wText, cellX + CELL_W - 8, cellY + 4);

    // Texte en bas : nom de l’objet (dans le rectangle gris foncé du template)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '16px OpenSans';
    ctx.fillStyle = '#e5e5e5';

    const name = itemDef.label || entry.id;
    const nameY = cellY + CELL_H - 6;
    drawCenteredText(ctx, name, centerX, nameY, CELL_W - 12);
  }

  // Poids total dans un coin (en plus du visuel sur l’image)
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = '20px OpenSans';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${weight.toFixed(1)} / 8 kg`, WIDTH - 20, HEIGHT - 20);

  const buffer = canvas.toBuffer('image/png');
  const filename = `inventory_${userId}.png`;

  return { buffer, filename };
}

module.exports = {
  renderInventory,
};
