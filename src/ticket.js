// src/ticket.js
require('dotenv').config({ path: './id.env' });

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ChannelType,
  PermissionsBitField,
} = require('discord.js');

const {
  OPEN_TICKET_CATEGORY_ID,
  CLOSED_TICKET_CATEGORY_ID,
  STAFF_ROLE_ID,
  LOG_TICKET_CHANNEL_ID,       // optionnel : salon logs
  TICKET_BANNER_URL,           // optionnel : bannière du panel
  TICKET_FOOTER_TEXT,          // optionnel : texte footer
} = process.env;

/* ────────────────────────────────────────────────────────────
 * Emojis persos SLA (pour plus de lisibilité)
 * ──────────────────────────────────────────────────────────── */

const EMOJI_FLAMME        = '<:image_20251129_165525123:1444356086701228105>';
const EMOJI_MODERATION    = '<:image_20251129_165431248:1444355861094072471>';
const EMOJI_VALID         = '<:image_20251129_165325659:1444355585817579561>';
const EMOJI_MORT          = '<:image_20251129_164450529:1444353425348497428>';
const EMOJI_PALMIER       = '<:image_20251129_164344174:1444353147718991985>';
const EMOJI_LOGO_SLA      = '<:sla_logo_png:1444339116241059902>';

/* ────────────────────────────────────────────────────────────
 * RÉASONS : labels + descriptions + emojis
 * ──────────────────────────────────────────────────────────── */

const REASONS = [
  {
    label: 'Demande générale / question',
    value: 'question_generale',
    menuEmoji: { id: '1444353147718991985' }, // palmier
    icon: EMOJI_PALMIER,
    description: 'Questions sur le serveur, règles, infos RP, etc.',
  },
  {
    label: 'Problème avec un joueur / groupe',
    value: 'probleme_joueur',
    menuEmoji: { id: '1444355861094072471' }, // modération
    icon: EMOJI_MODERATION,
    description: 'Conflit, comportement toxique, non-respect des règles.',
  },
  {
    label: 'Demande staff / scène encadrée',
    value: 'demande_scene_staff',
    menuEmoji: { id: '1444356086701228105' }, // flamme
    icon: EMOJI_FLAMME,
    description: 'Scène importante, event, intervention particulière.',
  },
  {
    label: 'Mort RP / reset personnage',
    value: 'mort_rp',
    menuEmoji: { id: '1444353425348497428' }, // mort
    icon: EMOJI_MORT,
    description: 'Gestion des morts RP, wipes, changement de perso.',
  },
  {
    label: 'Validation / dossier / projet',
    value: 'validation_projet',
    menuEmoji: { id: '1444355585817579561' }, // validé
    icon: EMOJI_VALID,
    description: 'Projet d’entreprise, dossier illégal, demande spécifique.',
  },
];

const reasonByValue = (v) =>
  REASONS.find(r => r.value === v) || {
    label: v,
    value: v,
    menuEmoji: null,
    icon: '📌',
    description: 'Demande personnalisée.',
  };

/* ────────────────────────────────────────────────────────────
 * EMBEDS & UI
 * ──────────────────────────────────────────────────────────── */

function panelEmbed() {
  return new EmbedBuilder()
    .setColor(0x0f172a) // bleu nuit
    .setAuthor({
      name: 'South Los Angeles RP • Support',
      iconURL: 'https://cdn.discordapp.com/emojis/1444339116241059902.png?size=128&quality=lossless',
    })
    .setTitle(`${EMOJI_LOGO_SLA} Centre de support - Tickets`)
    .setDescription([
      `${EMOJI_PALMIER} **Bienvenue sur le système de tickets de South Los Angeles RP.**`,
      '',
      `${EMOJI_FLAMME} Sélectionne dans le menu déroulant ci-dessous la **catégorie** correspondant le mieux à ta demande.`,
      `${EMOJI_MODERATION} Un membre du **STAFF** viendra te répondre dès que possible.`,
      '',
      `> ${EMOJI_VALID} Merci d’être **clair**, **respectueux** et de fournir un maximum de **détails**.`,
    ].join('\n'))
    .addFields(
      {
        name: `${EMOJI_MODERATION} Règles de base`,
        value: [
          '• Pas de spam de tickets.',
          '• Un ticket = **une** demande.',
          '• Toute insulte / toxicité peut mener à une sanction.',
        ].join('\n'),
      },
      {
        name: `${EMOJI_FLAMME} Conseils`,
        value: [
          '• Résume ta situation en quelques lignes dès l’ouverture.',
          '• Ajoute des preuves (captures, IDs, horaires) si besoin.',
        ].join('\n'),
      },
    )
    .setImage(
      TICKET_BANNER_URL ||
        'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/ticket/TICKET_South_Los_ Angeles.png',
    )
    .setFooter({
      text: TICKET_FOOTER_TEXT || 'South Los Angeles RP • Support',
      iconURL: 'https://cdn.discordapp.com/emojis/1444339116241059902.png?size=128&quality=lossless',
    })
    .setTimestamp();
}

function selectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('sla_ticket_reason_select')
      .setPlaceholder('Choisis le type de ticket que tu veux ouvrir...')
      .addOptions(
        REASONS.map(r => ({
          label: r.label,
          value: r.value,
          description: r.description.slice(0, 100),
          emoji: r.menuEmoji || undefined,
        })),
      ),
  );
}

function ticketWelcomeEmbed(userTag, reason) {
  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle(`${reason.icon} Ticket de ${userTag}`)
    .setDescription([
      `**Catégorie :** ${reason.label}`,
      '',
      'Merci d’expliquer ta demande en **un ou plusieurs messages clairs**.',
      'Tu peux ajouter des **captures**, des **horaires**, des **IDs** si nécessaire.',
      '',
      `${EMOJI_MODERATION} Un membre du **STAFF** prendra en charge ton ticket dès que possible.`,
    ].join('\n'))
    .setFooter({
      text: 'South Los Angeles RP • Support',
      iconURL: 'https://cdn.discordapp.com/emojis/1444339116241059902.png?size=128&quality=lossless',
    })
    .setTimestamp();
}

function closedEmbed() {
  return new EmbedBuilder()
    .setColor(0x64748b)
    .setTitle(`${EMOJI_VALID} Ticket fermé`)
    .setDescription([
      'Ce ticket a été **fermé** par un membre du staff.',
      '',
      'Si tu as encore besoin d’aide, tu peux **réouvrir** ce ticket ou en créer un nouveau.',
    ].join('\n'))
    .setTimestamp();
}

function reopenedEmbed() {
  return new EmbedBuilder()
    .setColor(0x60a5fa)
    .setTitle(`${EMOJI_FLAMME} Ticket réouvert`)
    .setDescription('Le ticket a été réouvert. Tu peux détailler ta nouvelle demande pour relancer la prise en charge.')
    .setTimestamp();
}

// Boutons CUSTOM (pas les couleurs basiques uniquement)
const closeButtonRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('sla_close_ticket')
      .setLabel('Fermer le ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),
  );

const closedButtonsRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('sla_reopen_ticket')
      .setLabel('Réouvrir')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('sla_delete_ticket')
      .setLabel('Supprimer')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
  );

/* ────────────────────────────────────────────────────────────
 * Utils
 * ──────────────────────────────────────────────────────────── */

async function getCategory(guild, categoryId) {
  if (!categoryId) return null;
  try {
    const cat = await guild.channels.fetch(categoryId).catch(() => null);
    return cat && cat.type === ChannelType.GuildCategory ? cat : null;
  } catch {
    return null;
  }
}

async function logIfPossible(guild, payload) {
  if (!LOG_TICKET_CHANNEL_ID) return;
  try {
    const ch = await guild.channels.fetch(LOG_TICKET_CHANNEL_ID).catch(() => null);
    if (!ch || !ch.isTextBased()) return;
    await ch.send(payload).catch(() => {});
  } catch {}
}

async function findExistingOpenTicket(guild, userId) {
  const openCat = await getCategory(guild, OPEN_TICKET_CATEGORY_ID);
  if (!openCat) return null;
  try {
    const children = [...openCat.children.cache.values()];
    for (const ch of children) {
      if (!ch || ch.type !== ChannelType.GuildText) continue;
      if (ch.topic?.includes(`UID:${userId}`) || ch.name.includes(userId)) return ch;
    }
  } catch {}
  return null;
}

/* ────────────────────────────────────────────────────────────
 * Panel
 * ──────────────────────────────────────────────────────────── */

async function sendTicketPanel(channel) {
  // éviter les doublons
  const fetched = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const already =
    fetched &&
    [...fetched.values()].some(
      m =>
        m.embeds?.[0]?.title?.includes('Centre de support - Tickets') ||
        m.components?.[0]?.components?.[0]?.data?.custom_id === 'sla_ticket_reason_select',
    );
  if (already) return;

  await channel.send({
    embeds: [panelEmbed()],
    components: [selectMenu()],
  });
}

/* ────────────────────────────────────────────────────────────
 * Interactions : menus + boutons
 * ──────────────────────────────────────────────────────────── */

async function handleTicketInteraction(interaction) {
  const guild = interaction.guild;
  if (!guild) return;

  // MENU DÉROULANT → création du ticket
  if (interaction.isStringSelectMenu() && interaction.customId === 'sla_ticket_reason_select') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const openCat = await getCategory(guild, OPEN_TICKET_CATEGORY_ID);
    const closedCat = await getCategory(guild, CLOSED_TICKET_CATEGORY_ID);
    if (!openCat || !closedCat) {
      return interaction.editReply('❌ Système de tickets non configuré (catégories manquantes).');
    }

    const existing = await findExistingOpenTicket(guild, interaction.user.id);
    if (existing) {
      return interaction.editReply(`ℹ️ Tu as déjà un ticket ouvert : ${existing}`);
    }

    const choice = interaction.values[0];
    const reason = reasonByValue(choice);

    try {
      const ch = await guild.channels.create({
        name: `ticket-${interaction.user.username}`.toLowerCase().slice(0, 90),
        type: ChannelType.GuildText,
        parent: openCat.id,
        topic: `Ticket de ${interaction.user.tag} — ${reason.label} • UID:${interaction.user.id}`,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks,
            ],
          },
          {
            id: STAFF_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageMessages,
            ],
          },
        ],
      });

      await ch.send({
        content: `${interaction.user}`,
        embeds: [ticketWelcomeEmbed(interaction.user.tag, reason)],
        components: [closeButtonRow()],
        allowedMentions: { users: [interaction.user.id] },
      });

      await logIfPossible(guild, `🆕 Ticket ouvert par ${interaction.user} — **${reason.label}** → ${ch}`);

      return interaction.editReply({
        content: `✅ Ton ticket a été créé : ${ch}`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error('Erreur création ticket :', err);
      return interaction.editReply({
        content: '❌ Impossible de créer le ticket. Contacte un membre du staff si le problème persiste.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // BOUTON : fermer
  if (interaction.isButton() && interaction.customId === 'sla_close_ticket') {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Tu n’as pas la permission de fermer ce ticket.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const closedCat = await getCategory(interaction.guild, CLOSED_TICKET_CATEGORY_ID);
    if (!closedCat) {
      return interaction.editReply('❌ Catégorie « tickets fermés » introuvable.');
    }

    try {
      await interaction.channel.setParent(closedCat.id, { lockPermissions: false });
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
        ViewChannel: false,
      });

      await interaction.channel.send({
        embeds: [closedEmbed()],
        components: [closedButtonsRow()],
      });

      await logIfPossible(interaction.guild, `🔒 Ticket fermé : ${interaction.channel} par ${interaction.user}`);

      return interaction.editReply({ content: '🔒 Ticket fermé.', flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error('Erreur fermeture ticket :', err);
      return interaction.editReply({
        content: '❌ Impossible de fermer ce ticket.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // BOUTON : réouvrir
  if (interaction.isButton() && interaction.customId === 'sla_reopen_ticket') {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Tu n’as pas la permission de réouvrir ce ticket.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const openCat = await getCategory(interaction.guild, OPEN_TICKET_CATEGORY_ID);
    if (!openCat) {
      return interaction.editReply('❌ Catégorie « tickets ouverts » introuvable.');
    }

    try {
      await interaction.channel.setParent(openCat.id, { lockPermissions: false });
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, {
        ViewChannel: false,
      });

      await interaction.channel.send({
        embeds: [reopenedEmbed()],
        components: [closeButtonRow()],
      });

      await logIfPossible(interaction.guild, `🔓 Ticket réouvert : ${interaction.channel} par ${interaction.user}`);

      return interaction.editReply({ content: '🔓 Ticket réouvert.', flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error('Erreur réouverture ticket :', err);
      return interaction.editReply({
        content: '❌ Impossible de réouvrir ce ticket.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // BOUTON : supprimer
  if (interaction.isButton() && interaction.customId === 'sla_delete_ticket') {
    if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
      return interaction.reply({ content: '❌ Tu n’as pas la permission de supprimer ce ticket.', flags: MessageFlags.Ephemeral });
    }

    await interaction.reply({ content: '🗑️ Suppression du ticket...', flags: MessageFlags.Ephemeral });
    await logIfPossible(interaction.guild, `🗑️ Ticket supprimé : ${interaction.channel} par ${interaction.user}`);

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 1500);
  }
}

module.exports = {
  sendTicketPanel,
  handleTicketInteraction,
};
