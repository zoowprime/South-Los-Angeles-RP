// src/commands/banque.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const { startUserPinFlow } = require('../bankInteractions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banque')
    .setDescription('Gestion de votre compte bancaire.')
    .addSubcommand((sub) =>
      sub
        .setName('codedefinir')
        .setDescription('Définir ou modifier le code PIN de votre compte.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('compte')
        .setDescription('Accéder à votre compte courant.'),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'codedefinir') {
      const embed = new EmbedBuilder()
        .setColor(0x166534)
        .setTitle('🔐 Configuration du code PIN')
        .setDescription(
          [
            'Ce code PIN protège l’accès à votre **compte bancaire**.',
            '',
            '• Choisissez **Continuer** pour définir un nouveau PIN.',
            '• Le PIN doit comporter **4 à 8 chiffres/lettres**.',
          ].join('\n'),
        )
        .setFooter({ text: 'South Los Angeles RP • Banque' });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('bank_setpin_continue')
          .setPlaceholder('➡️ Continuer')
          .addOptions({
            label: '➡️ Continuer',
            value: 'continue',
            description: 'Ouvrir le formulaire pour définir votre code PIN.',
          }),
      );

      return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
    }

    if (sub === 'compte') {
      await interaction.deferReply({ ephemeral: true });
      return startUserPinFlow(interaction);
    }
  },
};
