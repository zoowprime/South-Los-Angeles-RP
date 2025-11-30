// src/commands/banque.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const { startUserPinFlow } = require('../bankInteractions');
const {
  getOrCreateUserProfile,
  addUserHistoryEntry,
} = require('../data/bankData');
const {
  getOrCreateAccount,
  updateAccount,
} = require('../data/economyData');

const STAFF_ROLE_ID    = process.env.STAFF_ROLE_ID;
const BANQUIER_ROLE_ID = process.env.BANQUIER_ROLE_ID;

/* ────────────────────────────────────────────────────────────
 * Helpers permissions & solde
 * ──────────────────────────────────────────────────────────── */

function hasBankPower(member) {
  if (!member) return false;
  if (STAFF_ROLE_ID && member.roles.cache.has(STAFF_ROLE_ID)) return true;
  if (BANQUIER_ROLE_ID && member.roles.cache.has(BANQUIER_ROLE_ID)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return false;
}

function getBankBalance(userId) {
  const acc = getOrCreateAccount(userId);
  return acc.courant?.banque || 0;
}
function setBankBalance(userId, amount) {
  updateAccount(userId, (acc) => {
    if (!acc.courant) acc.courant = { cash: 0, banque: 0 };
    acc.courant.banque = Math.max(0, Math.round(amount * 100) / 100);
  });
}

/* ──────────────────────────────────────────────────────────── */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banque')
    .setDescription('Gestion de votre compte bancaire.')
    // Utilisateur : définir PIN
    .addSubcommand((sub) =>
      sub
        .setName('codedefinir')
        .setDescription('Définir ou modifier le code PIN de votre compte.'),
    )
    // Utilisateur : accéder au compte
    .addSubcommand((sub) =>
      sub
        .setName('compte')
        .setDescription('Accéder à votre compte courant.'),
    )
    // STAFF / BANQUIER
    .addSubcommandGroup((group) =>
      group
        .setName('staff')
        .setDescription('Outils bancaires pour le staff / banquier.')
        .addSubcommand((sub) =>
          sub
            .setName('give')
            .setDescription('Crediter le compte bancaire d’un joueur.')
            .addUserOption((opt) =>
              opt.setName('joueur').setDescription('Joueur ciblé').setRequired(true),
            )
            .addNumberOption((opt) =>
              opt.setName('montant').setDescription('Montant à créditer').setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName('raison')
                .setDescription('Raison RP / administrative (log)')
                .setRequired(false),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('retirer')
            .setDescription('Débiter le compte bancaire d’un joueur.')
            .addUserOption((opt) =>
              opt.setName('joueur').setDescription('Joueur ciblé').setRequired(true),
            )
            .addNumberOption((opt) =>
              opt.setName('montant').setDescription('Montant à retirer').setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName('raison')
                .setDescription('Raison RP / administrative (log)')
                .setRequired(false),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName('cloturer')
            .setDescription('Clôturer le compte bancaire d’un joueur.')
            .addUserOption((opt) =>
              opt.setName('joueur').setDescription('Joueur à clôturer').setRequired(true),
            )
            .addStringOption((opt) =>
              opt
                .setName('raison')
                .setDescription('Raison de la clôture (log)')
                .setRequired(false),
            ),
        ),
    ),

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub   = interaction.options.getSubcommand();

    /* ─────────────── PARTIE JOUEUR ─────────────── */

    // /banque codedefinir
    if (!group && sub === 'codedefinir') {
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

    // /banque compte
    if (!group && sub === 'compte') {
      await interaction.deferReply({ ephemeral: true });
      return startUserPinFlow(interaction);
    }

    /* ─────────────── PARTIE STAFF / BANQUIER ─────────────── */

    if (group === 'staff') {
      if (!hasBankPower(interaction.member)) {
        return interaction.reply({
          content: '❌ Tu n’as pas les permissions pour utiliser les commandes staff de la banque.',
          ephemeral: true,
        });
      }

      const target = interaction.options.getUser('joueur', true);
      const raison = interaction.options.getString('raison') || 'Aucune raison spécifiée.';
      const actor  = interaction.user;

      // /banque staff give
      if (sub === 'give') {
        const montant = interaction.options.getNumber('montant', true);
        if (montant <= 0) {
          return interaction.reply({
            content: '❌ Montant invalide. Il doit être supérieur à 0.',
            ephemeral: true,
          });
        }

        const before = getBankBalance(target.id);
        const after  = before + montant;
        setBankBalance(target.id, after);

        addUserHistoryEntry(target.id, {
          type: 'crédit staff',
          amount: +montant,
          balanceAfter: after,
          description: `Crédit staff : ${raison}`,
          actorId: actor.id,
        });

        return interaction.reply({
          content: `✅ Tu as **crédité** le compte de <@${target.id}> de **$${montant.toFixed(
            2,
          )}**.\nSolde avant : \`$${before.toFixed(2)}\` → après : \`$${after.toFixed(2)}\`.`,
          ephemeral: true,
        });
      }

      // /banque staff retirer
      if (sub === 'retirer') {
        const montant = interaction.options.getNumber('montant', true);
        if (montant <= 0) {
          return interaction.reply({
            content: '❌ Montant invalide. Il doit être supérieur à 0.',
            ephemeral: true,
          });
        }

        const before = getBankBalance(target.id);
        const after  = Math.max(0, before - montant);
        setBankBalance(target.id, after);

        addUserHistoryEntry(target.id, {
          type: 'débit staff',
          amount: -montant,
          balanceAfter: after,
          description: `Débit staff : ${raison}`,
          actorId: actor.id,
        });

        return interaction.reply({
          content: `✅ Tu as **retiré** **$${montant.toFixed(
            2,
          )}** du compte de <@${target.id}>.\nSolde avant : \`$${before.toFixed(
            2,
          )}\` → après : \`$${after.toFixed(2)}\`.`,
          ephemeral: true,
        });
      }

      // /banque staff cloturer
      if (sub === 'cloturer') {
        const profile = getOrCreateUserProfile(target.id);
        profile.status = 'closed';
        profile.updatedAt = new Date().toISOString();
        addUserHistoryEntry(target.id, {
          type: 'clôture staff',
          amount: 0,
          balanceAfter: getBankBalance(target.id),
          description: `Compte clôturé par le staff : ${raison}`,
          actorId: actor.id,
        });

        return interaction.reply({
          content: `🗑️ Le compte bancaire de <@${target.id}> a été **clôturé**.`,
          ephemeral: true,
        });
      }
    }
  },
};
