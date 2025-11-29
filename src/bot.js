// src/bot.js
require('dotenv').config({ path: './id.env' });
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { sendTicketPanel, handleTicketInteraction } = require('./ticket');

// ─────────────────────────────────────────────────────────────
// Client Discord
// ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // pour les slash commands & interactions
  ],
});

// ─────────────────────────────────────────────────────────────
// Quand le bot est prêt
// ─────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  // Activité du bot
  const activityText = process.env.BOT_ACTIVITY_TEXT || 'SLA RP PS4';
  const activityTypeEnv = (process.env.BOT_ACTIVITY_TYPE || 'WATCHING').toUpperCase();

  const activityType =
    activityTypeEnv === 'PLAYING'
      ? ActivityType.Playing
      : activityTypeEnv === 'LISTENING'
      ? ActivityType.Listening
      : activityTypeEnv === 'COMPETING'
      ? ActivityType.Competing
      : ActivityType.Watching; // par défaut : regarde SLA RP PS4

  try {
    await client.user.setPresence({
      activities: [{ name: activityText, type: activityType }],
      status: 'online',
    });
    console.log(`🎮 Activité définie: ${activityTypeEnv} ${activityText}`);
  } catch (e) {
    console.error('Erreur setPresence :', e);
  }

  // Panel de ticket SLA
  const panelChannelId = process.env.ID_DU_CANAL_POUR_TICKET;
  if (panelChannelId) {
    try {
      const channel = await client.channels.fetch(panelChannelId);
      if (channel && channel.isTextBased()) {
        await sendTicketPanel(channel);
        console.log('🎫 Panel de tickets SLA envoyé / vérifié.');
      } else {
        console.warn('⚠️ Le salon pour le panel de ticket est introuvable ou non textuel.');
      }
    } catch (err) {
      console.error('Erreur lors de l’envoi du panel de ticket :', err);
    }
  } else {
    console.warn('⚠️ ID_DU_CANAL_POUR_TICKET manquant dans id.env');
  }
});

// ─────────────────────────────────────────────────────────────
// Gestion des interactions (tickets, etc.)
// ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  try {
    await handleTicketInteraction(interaction);
  } catch (err) {
    console.error('Erreur handleTicketInteraction :', err);
  }
});

// ─────────────────────────────────────────────────────────────
// Connexion
// ─────────────────────────────────────────────────────────────
const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;

if (!token) {
  console.error('❌ Aucun token trouvé. Vérifie BOT_TOKEN ou DISCORD_TOKEN dans id.env / Render');
  process.exit(1);
}

client.login(token);
