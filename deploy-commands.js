// deploy-commands.js
require('dotenv').config({ path: './id.env' });

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const TOKEN   = process.env.BOT_TOKEN;     // ⚠️ le jeton du BOT
const CLIENT  = process.env.CLIENT_ID;     // ID de l'application/bot
const GUILD   = process.env.GUILD_ID;      // ID du serveur pour déploiement local (rapide)

if (!TOKEN)  throw new Error('BOT_TOKEN manquant (vérifie id.env ou les Env Vars Render).');
if (!CLIENT) throw new Error('CLIENT_ID manquant.');
if (!GUILD)  throw new Error('GUILD_ID manquant.');

// Charge tous les fichiers de commandes depuis src/commands
const commandsDir = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

const commandsJson = [];
for (const file of commandFiles) {
  const cmd = require(path.join(commandsDir, file));
  if (cmd?.data) commandsJson.push(cmd.data.toJSON());
}

console.log(`Déploiement des commandes slash… (${commandsJson.length} cmd)`);

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    // Déploiement GUILD (instantané)
    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT, GUILD),
      { body: commandsJson }
    );
    console.log(`✅ ${data.length} commande(s) déployée(s) sur la guilde ${GUILD}.`);
  } catch (err) {
    console.error('❌ Échec du déploiement :', err);
    process.exit(1);
  }
})();
