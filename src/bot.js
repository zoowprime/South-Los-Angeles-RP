// src/bot.js
require('dotenv').config({ path: './id.env' });

const {
  Client,
  GatewayIntentBits,
  ActivityType,
  Collection,
} = require('discord.js');

const fs   = require('fs');
const path = require('path');

const { sendTicketPanel, handleTicketInteraction } = require('./ticket');
const { handleInventoryInteraction }             = require('./inventoryInteractions');

// ─────────────────────────────────────────────────────────────
// Client Discord
// ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // slash commands & interactions
  ],
});

// Collection pour les commandes
client.commands = new Collection();

// ─────────────────────────────────────────────────────────────
// Chargement des commandes (dossier /src/commands)
// ─────────────────────────────────────────────────────────────
function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');

  if (!fs.existsSync(commandsPath)) {
    console.warn('⚠️ Dossier "src/commands" introuvable, aucune commande slash chargée.');
    return;
  }

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (command && command.data && command.execute) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Commande chargée: /${command.data.name}`);
      } else {
        console.warn(`⚠️ Fichier commande invalide (manque data ou execute) : ${file}`);
      }
    } catch (err) {
      console.error(`❌ Erreur au chargement de la commande ${file}:`, err);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Quand le bot est prêt
// ─────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  // Charger les commandes
  loadCommands();

  // Activité du bot
  const activityText    = process.env.BOT_ACTIVITY_TEXT || 'SLA RP PS4';
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
// Gestion des interactions (tickets, inventaire, slash)
// ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  // 1) Tickets (menu + boutons de ticket)
  try {
    await handleTicketInteraction(interaction);
  } catch (err) {
    console.error('Erreur handleTicketInteraction :', err);
  }

  // 2) Inventaire (boutons, selects, modals Donner / Utiliser / Jeter)
  try {
    await handleInventoryInteraction(interaction);
  } catch (err) {
    console.error('Erreur handleInventoryInteraction :', err);
  }

  // 3) Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Erreur lors de l’exécution de /${interaction.commandName} :`, err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Une erreur est survenue pendant l’exécution de la commande.',
          ephemeral: true,
        }).catch(() => {});
      }
    }
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
