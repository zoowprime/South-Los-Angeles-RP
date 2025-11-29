// src/inventoryRenderer.js
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const { itemCatalog } = require('./data/itemCatalog');
const { getItemIconPath } = require('./data/itemIcons');
const { getUserSnapshot, getTotalWeight } = require('./data/inventoryStore');

// Charger police OpenSans-Bold
try {
  registerFont(
    path.join(__dirname, 'assets', 'fonts', 'OpenSans-Bold.ttf'),
    { family: 'OpenSansBold' }
  );
} catch (err) {
  console.warn("[INV] Impossible de charger OpenSans-Bold.ttf");
}

// Dimensions
const WIDTH = 1200;
const HEIGHT = 700;

// Grille
const COLS = 3;
const ROWS = 5;

const GRID_WIDTH = WIDTH * 0.80;
const GRID_HEIGHT = HEIGHT * 0.70;

const GRID_X = (WIDTH - GRID_WIDTH) / 2;
const GRID_Y = (HEIGHT - GRID_HEIGHT) / 2;

const CELL_W = GRID_WIDTH / COLS;
const CELL_H = GRID_HEIGHT / ROWS;

// URLs des fonds selon le poids
function getBackgroundUrl(weight) {
  if (weight <= 0)
    return "https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_clean.png";

  if (weight > 0 && weight < 2)
    return "https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_1kg-2kg.png";

  if (weight === 2)
    return "https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_2kg.png";

  if (weight > 2 && weight < 3)
    return "https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_2kg-3kg.png";

  if (weight >= 4 && weight < 5)
    return "https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_4kg-5kg.png";

  if (weight >= 5 && weight < 6)
    return "https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_5kg-6kg.png";

  if (weight === 7)
    return "https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_7kg.png";

  if (weight >= 8)
    return "https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_full.png";

  return "https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/inventaire/inventory_clean.png";
}

/**
 * Rendu complet de l’inventaire
 */
async function renderInventory(userId) {
  const snapshot = getUserSnapshot(userId);
  const weight = Math.round(getTotalWeight(userId) * 10) / 10;

  const bg = await loadImage(getBackgroundUrl(weight));

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Fond
  ctx.drawImage(bg, 0, 0, WIDTH, HEIGHT);

  // Style texte
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "20px OpenSansBold";

  // ---------------------------------------------------------
  //     🔥 NOUVEAU : Affichage du poids dans la barre du haut
  // ---------------------------------------------------------
  const weightText = `${weight.toFixed(1)} / 8 kg`;

  // Coordonnées précises basées sur ton HUD
  const WEIGHT_X = 880; // aligné à droite dans la barre
  const WEIGHT_Y = 122; // centré verticalement dans la barre

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(weightText, WEIGHT_X, WEIGHT_Y);

  // ---------------------------------------------------------
  //     Grille d’items
  // ---------------------------------------------------------
  const entries = Object.values(snapshot.items || {}).filter(e => e.quantity > 0);

  const limited = entries.slice(0, COLS * ROWS);
  limited.forEach(async (entry, index) => {
    const item = itemCatalog[entry.id];
    if (!item) return;

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
        const size = Math.min(CELL_W, CELL_H) * 0.60;
        ctx.drawImage(icon, centerX - size / 2, centerY - size / 2 - 10, size, size);
      } catch (e) {}
    }

    // Quantité xN
    ctx.font = "17px OpenSansBold";
    ctx.textAlign = "left";
    ctx.fillText(`x${entry.quantity}`, cellX + 10, cellY + 8);

    // Poids individuel
    ctx.textAlign = "right";
    ctx.fillText(`${item.weight}kg`, cellX + CELL_W - 10, cellY + 8);

    // Nom
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(item.label, centerX, cellY + CELL_H - 5, CELL_W - 20);
  });

  return { buffer: canvas.toBuffer(), filename: `inventory_${userId}.png` };
}

module.exports = {
  renderInventory,
};
