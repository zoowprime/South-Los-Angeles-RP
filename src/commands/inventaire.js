// src/commands/inventaire.js
const {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { getUserSnapshot, getTotalWeight } = require('../data/inventoryStore');
const { renderInventory } = require('../inventoryRenderer');
const { makeBar } = require('../utils/bars');

/**
 * Construit tout le payload d’affichage d’un inventaire
 * (embed + image + boutons) pour un utilisateur donné.
 *
 * @param {import('discord.js').User} user
 * @returns {Promise<{ embeds, files, components }>}
 */
async function buildInventoryMessage(user) {
  const userId = user.id;

  const inv     = getUserSnapshot(userId);
  const weight  = Math.round(getTotalWeight(userId) * 10) / 10;
  const hunger  = inv.hunger ?? 100;
  const thirst  = inv.thirst ?? 100;

  // Image
  const { buffer, filename } = await renderInventory(userId);
  const attachment = new AttachmentBuilder(buffer, { name: filename });

  // Barres faim / soif
  const hungerBar = makeBar(hunger);
  const thirstBar = makeBar(thirst);

  const embed = new EmbedBuilder()
    .setColor(0x1f2933) // marron/noir foncé
    .setTitle(`📦 Inventaire de ${user.username}`)
    .setDescription(
      [
        `💰 Poids total : **${weight.toFixed(1)} / 8 kg**`,
        '',
        `🍖 Faim : \`${hungerBar}\` **${Math.round(hunger)}%**`,
        `💧 Soif : \`${thirstBar}\` **${Math.round(thirst)}%**`,
      ].join('\n'),
    )
    .setImage(`attachment://${filename}`)
    .setFooter({ text: 'South Los Angeles RP • Inventaire' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('inv_give')
      .setLabel('Donner')
      .setEmoji('📤')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('inv_use')
      .setLabel('Utiliser')
      .setEmoji('📩')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('inv_drop')
      .setLabel('Jeter')
      .setEmoji('📥')
      .setStyle(ButtonStyle.Danger),
  );

  return {
    embeds: [embed],
    files: [attachment],
    components: [row],
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventaire')
    .setDescription('Affiche ton inventaire visuel (items, poids, faim, soif).'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const payload = await buildInventoryMessage(interaction.user);
    await interaction.editReply(payload);
  },

  // Export du helper pour les autres modules (interactions)
  buildInventoryMessage,
};
