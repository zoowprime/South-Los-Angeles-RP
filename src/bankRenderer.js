// src/bankRenderer.js
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// Police Open Sans Bold
const FONT_PATH = path.join(__dirname, 'assets', 'fonts', 'OpenSans-Bold.ttf');
try {
  registerFont(FONT_PATH, { family: 'Open Sans' });
} catch (e) {
  console.warn('[BANK RENDERER] Impossible de charger la police Open Sans :', e.message);
}

const TEMPLATE_PATH = path.join(
  __dirname,
  'assets',
  'bank',
  'user_bank_account.png',
);

/**
 * historyLines: tableau de chaînes simples déjà formatées
 * balance: nombre
 * username: nom Discord du joueur à afficher dans "identifiant"
 */
async function renderUserBankCard(balance, historyLines, username) {
  const img = await loadImage(TEMPLATE_PATH);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');

  // Fond
  ctx.drawImage(img, 0, 0);

  // ─────────────────────────────────────────────
  // Zone SOLDE (rectangle rouge en haut à gauche)
  // ─────────────────────────────────────────────
  ctx.font = '40px "Open Sans"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const balanceText = balance.toFixed(2);
  const BALANCE_X = 230; 
  const BALANCE_Y = 260;

  ctx.fillText(balanceText, BALANCE_X, BALANCE_Y);

  // ─────────────────────────────────────────────
  // Zone IDENTIFIANT (rectangle rouge en haut à droite)
  // ─────────────────────────────────────────────
  ctx.font = '28px "Open Sans"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Coordonnées précises à ajuster si besoin
  const IDENT_X = 1180; // ≈ zone rouge
  const IDENT_Y = 120;

  ctx.fillText(username, IDENT_X, IDENT_Y);

  // ─────────────────────────────────────────────
  // Zone HISTORIQUE (bloc bas gauche)
  // ─────────────────────────────────────────────
  ctx.font = '20px "Open Sans"';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const startX = 180;
  let startY = 470;
  const lineHeight = 26;

  historyLines.slice(0, 7).forEach((line) => {
    ctx.fillText(line, startX, startY);
    startY += lineHeight;
  });

  const buffer = canvas.toBuffer('image/png');

  return {
    buffer,
    filename: 'user_bank_account_dynamic.png',
  };
}

module.exports = {
  renderUserBankCard,
};
