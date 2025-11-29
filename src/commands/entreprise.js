// src/commands/entreprise.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const {
  createEnterprise,
  getEnterpriseByOwner,
} = require('../data/bankData');

const STAFF_ROLE_ID    = process.env.STAFF_ROLE_ID;
const BANQUIER_ROLE_ID = process.env.BANQUIER_ROLE_ID;

function hasBankPower(member) {
  if (!member) return false;
  if (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID)) return true;
  if (BANQUIER_ROLE_ID && member.roles.cache.has(BANQUIER_ROLE_ID)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('entreprise')
    .setDescription('Gestion des comptes bancaires entreprise.')
    .addSubcommand((sub) =>
      sub
        .setName('comptecréer')
        .setDescription('Créer un compte entreprise pour un joueur (Staff / Banquier).')
        .addUserOption((opt) =>
          opt.setName('propriétaire').setDescription('Joueur propriétaire du compte').setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('nom')
            .setDescription("Nom de l'entreprise (affiché sur le compte)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('compte')
        .setDescription("Afficher le compte bancaire de l'entreprise (propriétaire uniquement)."),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'comptecréer') {
      if (!hasBankPower(interaction.member)) {
        return interaction.reply({
          content: '❌ Tu n’as pas les permissions pour créer un compte entreprise.',
          ephemeral: true,
        });
      }

      const owner = interaction.options.getUser('propriétaire', true);
      const name  = interaction.options.getString('nom', true);

      const existing = getEnterpriseByOwner(owner.id);
      if (existing) {
        return interaction.reply({
          content: `❌ Ce joueur possède déjà un compte entreprise (**${existing.name}**).`,
          ephemeral: true,
        });
      }

      const ent = createEnterprise(owner.id, name);

      const embed = new EmbedBuilder()
        .setColor(0x166534)
        .setTitle('🏢 Compte entreprise créé')
        .setDescription(
          [
            `Entreprise : **${ent.name}**`,
            `Propriétaire : <@${ent.ownerId}>`,
            `Numéro de compte : \`${ent.accountNumber}\``,
          ].join('\n'),
        )
        .setFooter({ text: 'South Los Angeles RP • Banque Entreprise' });

      return interaction.reply({
        content: `✅ Compte entreprise créé pour <@${owner.id}>.`,
        embeds: [embed],
        ephemeral: true,
      });
    }

    if (sub === 'compte') {
      await interaction.deferReply({ ephemeral: true });

      const ent = getEnterpriseByOwner(interaction.user.id);
      if (!ent) {
        return interaction.editReply({
          content: "❌ Tu n'as pas encore de compte entreprise. Contacte un banquier.",
        });
      }

      // Pour le moment, on ne gère pas un vrai solde entreprise, on affiche 0
      const balance = 0;

      const embed = new EmbedBuilder()
        .setColor(0x166534)
        .setTitle(`🏢 Compte entreprise — ${ent.name}`)
        .setDescription(
          [
            `**Numéro de compte :** \`${ent.accountNumber}\``,
            '',
            `💰 **Solde affiché :** \`$${balance.toFixed(2)}\` (placeholder)`,
          ].join('\n'),
        )
        .setImage(
          'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/bank/entreprise_template.png',
        )
        .setFooter({ text: 'South Los Angeles RP • Banque Entreprise' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
