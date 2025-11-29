// src/bot.js
require('dotenv').config({ path: './id.env' });
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

// ─────────────────────────────────────────────────────────────
// Client Discord (intents minimum pour un bot de base)
// Tu pourras en rajouter plus tard si besoin.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // pour les slash commands
  ],
});

// ─────────────────────────────────────────────────────────────
// Quand le bot est prêt
client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  // Activité du bot
  // Tu peux changer BOT_ACTIVITY_TYPE dans id.env : PLAYING ou WATCHING
  const activityText = process.env.BOT_ACTIVITY_TEXT || 'SLA RP PS4';
  const activityTypeEnv = (process.env.BOT_ACTIVITY_TYPE || 'WATCHING').toUpperCase();

  const activityType =
    activityTypeEnv === 'PLAYING'   ? ActivityType.Playing  :
    activityTypeEnv === 'LISTENING' ? ActivityType.Listening :
    activityTypeEnv === 'COMPETING' ? ActivityType.Competing :
    ActivityType.Watching; // par défaut : regarde SLA RP PS4

  client.user.setPresence({
    activities: [{ name: activityText, type: activityType }],
    status: 'online',
  });

  console.log(`🎮 Activité définie: ${activityTypeEnv} ${activityText}`);
});

// ─────────────────────────────────────────────────────────────
// Connexion
const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;

if (!token) {
  console.error('❌ Aucun token trouvé. Vérifie BOT_TOKEN ou DISCORD_TOKEN dans id.env');
  process.exit(1);
}

client.login(token);
