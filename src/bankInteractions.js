// src/bankInteractions.js
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');

const {
  getOrCreateUserProfile,
  setUserPin,
  verifyUserPin,
  addUserHistoryEntry,
  getEnterprise,
  getEnterpriseByOwner,
  addEnterpriseHistoryEntry,
  isUserAccountClosed,
  isUserAccountFrozen,
  isEnterpriseClosed,
  isEnterpriseFrozen,
} = require('./data/bankData');

const {
  getOrCreateAccount,
  updateAccount,
} = require('./data/economyData');

const { renderUserBankCard } = require('./bankRenderer');

// Rôles spéciaux (actuellement pas utilisés ici, mais dispo)
const STAFF_ROLE_ID    = process.env.STAFF_ROLE_ID;
const BANQUIER_ROLE_ID = process.env.BANQUIER_ROLE_ID;

// Durée de vie des boutons (3 minutes)
const BUTTON_LIFETIME_MS = 3 * 60 * 1000;

/* ────────────────────────────────────────────────────────────
 * Helpers économie (cash & banque)
 * ──────────────────────────────────────────────────────────── */

function getCash(userId) {
  const acc = getOrCreateAccount(userId);
  return acc.courant?.cash || 0;
}
function setCash(userId, amount) {
  updateAccount(userId, (acc) => {
    if (!acc.courant) acc.courant = { cash: 0, banque: 0 };
    acc.courant.cash = Math.max(0, Math.round(amount));
  });
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

/* ────────────────────────────────────────────────────────────
 * Affichage historique formaté
 * ──────────────────────────────────────────────────────────── */

function formatHistoryList(history) {
  if (!history || !history.length) {
    return '_Aucune transaction récente._';
  }

  return history
    .slice(0, 5)
    .map((h) => {
      const date = new Date(h.at).toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
      const sign = h.amount >= 0 ? '+' : '-';
      const amt = Math.abs(h.amount).toFixed(2);
      const type = h.type || 'mouvement';
      return `• ${date} — **${type}** : \`${sign}$${amt}\` ${
        h.description ? `— ${h.description}` : ''
      }`;
    })
    .join('\n');
}

// Version courte, sans markdown, pour l’image
function formatHistoryLinesForImage(history) {
  if (!history || !history.length) {
    return ['Aucune transaction récente'];
  }

  return history.slice(0, 7).map((h) => {
    const date = new Date(h.at).toLocaleDateString('fr-FR');
    const sign = h.amount >= 0 ? '+' : '-';
    const amt = Math.abs(h.amount).toFixed(2);
    const type = h.type || 'mvt';
    return `${date} • ${type} • ${sign}$${amt}`;
  });
}

/* ────────────────────────────────────────────────────────────
 * Construction embed compte perso
 * ──────────────────────────────────────────────────────────── */

function buildUserAccountEmbed(user, profile, filename, balance) {
  const historyText = formatHistoryList(profile.history);

  const statusStr =
    profile.status === 'frozen'
      ? '🧊 Compte gelé'
      : profile.status === 'closed'
      ? '🚫 Compte clôturé'
      : '✅ Compte actif';

  return new EmbedBuilder()
    .setColor(0x14532d)
    .setTitle(`🏦 Compte bancaire de ${user.username}`)
    .setDescription(
      [
        `**Statut du compte :** ${statusStr}`,
        '',
        `💰 **Solde actuel :** \`$${balance.toFixed(2)}\``,
      ].join('\n'),
    )
    .setImage(`attachment://${filename}`)
    .addFields({
      name: '📜 Historique récent',
      value: historyText,
    })
    .setFooter({ text: 'South Los Angeles RP • Banque' })
    .setTimestamp();
}

function buildUserAccountButtons(userId, messageId) {
  const baseId = `bank_user|${userId}|${messageId}`;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${baseId}|deposit`)
      .setLabel('Dépôt')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${baseId}|withdraw`)
      .setLabel('Retrait')
      .setEmoji('💸')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${baseId}|transfer`)
      .setLabel('Virement')
      .setEmoji('🔁')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${baseId}|close`)
      .setLabel('Clôturer')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${baseId}|logout`)
      .setLabel('Déconnexion')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Secondary),
  );
}

async function disableAllButtons(message) {
  if (!message?.editable) return;
  const rows = [];
  for (const row of message.components) {
    const newRow = ActionRowBuilder.from(row);
    newRow.components = newRow.components.map((btn) =>
      ButtonBuilder.from(btn).setDisabled(true),
    );
    rows.push(newRow);
  }
  await message.edit({ components: rows }).catch(() => {});
}

/* ───────────────── PIN SETUP ( /banque codedefinir ) ───────────────── */

async function handlePinSelect(interaction) {
  if (interaction.customId !== 'bank_setpin_continue') return;

  const modal = new ModalBuilder()
    .setCustomId('bank_setpin_modal')
    .setTitle('Définir votre code PIN');

  const pin1 = new TextInputBuilder()
    .setCustomId('pin')
    .setLabel('Entrez votre code PIN')
    .setStyle(TextInputStyle.Short)
    .setMinLength(4)
    .setMaxLength(8)
    .setRequired(true);

  const pin2 = new TextInputBuilder()
    .setCustomId('pin_confirm')
    .setLabel('Confirmez votre code PIN')
    .setStyle(TextInputStyle.Short)
    .setMinLength(4)
    .setMaxLength(8)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(pin1),
    new ActionRowBuilder().addComponents(pin2),
  );

  await interaction.showModal(modal);
}

async function handlePinModal(interaction) {
  if (interaction.customId !== 'bank_setpin_modal') return;

  const pin = interaction.fields.getTextInputValue('pin').trim();
  const pinConfirm = interaction.fields.getTextInputValue('pin_confirm').trim();

  if (pin !== pinConfirm) {
    return interaction.reply({
      content:
        '❌ Les deux codes PIN ne correspondent pas. Réessayez avec `/banque codedefinir`.',
      ephemeral: true,
    });
  }

  setUserPin(interaction.user.id, pin);

  return interaction.reply({
    content: '✅ Votre code PIN a été enregistré.',
    ephemeral: true,
  });
}

/* ───────────────── COMPTE PERSO ( /banque compte ) ───────────────── */

async function startUserPinFlow(interaction) {
  const userId = interaction.user.id;

  if (isUserAccountClosed(userId)) {
    return interaction.editReply({
      content:
        '🚫 Votre compte bancaire est **clôturé**. Merci de contacter un banquier ou un membre du staff.',
      embeds: [],
      components: [],
    });
  }

  getOrCreateUserProfile(userId); // s’assure qu’il existe

  const embed = new EmbedBuilder()
    .setColor(0x14532d)
    .setTitle('🏦 Accès à votre compte bancaire')
    .setDescription(
      [
        'Pour accéder à votre compte, veuillez saisir votre **code PIN** dans le chat.',
        '',
        '⚠️ Vous avez 3 tentatives avant un blocage temporaire.',
      ].join('\n'),
    )
    .setImage(
      'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/bank/user_code_bank.png',
    )
    .setFooter({ text: 'South Los Angeles RP • Banque' });

  await interaction.editReply({ embeds: [embed], components: [] });

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased()) {
    return interaction.followUp({
      content: '❌ Impossible de lire votre PIN dans ce salon.',
      ephemeral: true,
    });
  }

  const filter = (m) => m.author.id === userId;
  const collector = channel.createMessageCollector({ filter, time: 180000 });

  collector.on('collect', async (msg) => {
    const input = msg.content.trim();
    await msg.delete().catch(() => {});

    const res = verifyUserPin(userId, input);
    if (res.ok) {
      collector.stop('success');

      const profile = getOrCreateUserProfile(userId);
      const balance = getBankBalance(userId);
      const linesForImage = formatHistoryLinesForImage(profile.history);

      // 💡 Ajout du username dans l’image (identifiant :)
      const { buffer, filename } = await renderUserBankCard(
        balance,
        linesForImage,
        interaction.user.username,
      );
      const attachment = new AttachmentBuilder(buffer, { name: filename });

      const accEmbed = buildUserAccountEmbed(
        interaction.user,
        profile,
        filename,
        balance,
      );

      await interaction.editReply({
        embeds: [accEmbed],
        files: [attachment],
        components: [],
      });
      const message = await interaction.fetchReply();

      const row = buildUserAccountButtons(userId, message.id);
      await message.edit({
        embeds: [accEmbed],
        files: [attachment],
        components: [row],
      });

      setTimeout(() => disableAllButtons(message), BUTTON_LIFETIME_MS);
      return;
    }

    if (res.reason === 'no_pin') {
      collector.stop('no_pin');
      return interaction.followUp({
        content:
          '❌ Vous n’avez pas encore défini de code PIN. Utilisez `/banque codedefinir`.',
        ephemeral: true,
      });
    }

    if (res.reason === 'locked' || res.reason === 'too_many') {
      collector.stop('locked');
      const until = new Date(res.lockedUntil);
      return interaction.followUp({
        content: `❌ Trop de tentatives. Votre compte est temporairement bloqué jusqu’au **${until.toLocaleString(
          'fr-FR',
        )}**.`,
        ephemeral: true,
      });
    }

    if (res.reason === 'wrong') {
      await interaction.followUp({
        content: `❌ PIN incorrect. Tentatives restantes : **${res.attemptsLeft}**.`,
        ephemeral: true,
      });
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'success' || reason === 'locked' || reason === 'no_pin') return;
    await interaction.followUp({
      content: '⏱️ Session PIN expirée. Relancez `/banque compte` pour réessayer.',
      ephemeral: true,
    });
  });
}

/* ────────────────── BOUTONS & MODALS COMPTE PERSO ────────────────── */

async function handleUserButtons(interaction, parts) {
  const [prefix, userId, messageId, action] = parts;

  if (prefix !== 'bank_user') return;
  if (interaction.user.id !== userId) {
    return interaction.reply({
      content: '❌ Ce panneau de compte ne vous appartient pas.',
      ephemeral: true,
    });
  }

  if (isUserAccountFrozen(userId)) {
    return interaction.reply({
      content: '🧊 Ce compte est **gelé**. Aucune opération possible.',
      ephemeral: true,
    });
  }

  if (isUserAccountClosed(userId)) {
    return interaction.reply({
      content: '🚫 Ce compte est **clôturé**.',
      ephemeral: true,
    });
  }

  const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    return interaction.reply({
      content: '❌ Impossible de retrouver le message de compte.',
      ephemeral: true,
    });
  }

  if (action === 'logout') {
    await message.delete().catch(() => {});
    return interaction.reply({
      content: '🚪 Vous avez quitté votre espace bancaire.',
      ephemeral: true,
    });
  }

  if (action === 'close') {
    const profile = getOrCreateUserProfile(userId);
    profile.status = 'closed';
    profile.updatedAt = new Date().toISOString();
    addUserHistoryEntry(userId, {
      type: 'cloture',
      amount: 0,
      balanceAfter: getBankBalance(userId),
      description: 'Compte clôturé par le titulaire.',
      actorId: userId,
    });

    const balance = getBankBalance(userId);
    const lines = formatHistoryLinesForImage(profile.history);
    const { buffer, filename } = await renderUserBankCard(
      balance,
      lines,
      interaction.user.username,
    );
    const attachment = new AttachmentBuilder(buffer, { name: filename });
    const accEmbed = buildUserAccountEmbed(
      interaction.user,
      profile,
      filename,
      balance,
    );

    await message.edit({
      embeds: [accEmbed],
      files: [attachment],
      components: [],
    });

    return interaction.reply({
      content:
        '🗑️ Votre compte a été **clôturé**. Contactez un banquier si c’est une erreur.',
      ephemeral: true,
    });
  }

  if (action === 'deposit') {
    const modal = new ModalBuilder()
      .setCustomId(`bank_user_deposit|${userId}|${messageId}`)
      .setTitle('💰 Dépôt sur votre compte');

    const input = new TextInputBuilder()
      .setCustomId('amount')
      .setLabel('Montant à déposer (en $)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Exemple : 250')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (action === 'withdraw') {
    const modal = new ModalBuilder()
      .setCustomId(`bank_user_withdraw|${userId}|${messageId}`)
      .setTitle('💸 Retrait depuis votre compte');

    const input = new TextInputBuilder()
      .setCustomId('amount')
      .setLabel('Montant à retirer (en $)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Exemple : 100')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  if (action === 'transfer') {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`bank_transfer_type|${userId}|${messageId}`)
        .setPlaceholder('Choisis le type de compte destinataire…')
        .addOptions(
          {
            label: '🏦 Compte courant',
            value: 'user',
            description: 'Vers le compte courant d’un autre joueur.',
            emoji: '🏦',
          },
          {
            label: '🏢 Compte entreprise',
            value: 'enterprise',
            description: 'Vers un compte bancaire d’entreprise.',
            emoji: '🏢',
          },
        ),
    );

    return interaction.reply({
      content: '🔁 Choisis le type de compte destinataire pour ton virement.',
      components: [row],
      ephemeral: true,
    });
  }
}

async function handleUserMoneyModal(interaction, type, userId, messageId) {
  const rawAmount = interaction.fields
    .getTextInputValue('amount')
    .replace(',', '.')
    .trim();
  const amount = parseFloat(rawAmount);

  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({
      content: '❌ Montant invalide. Merci d’entrer un nombre positif.',
      ephemeral: true,
    });
  }

  const rounded = Math.round(amount * 100) / 100;

  if (type === 'deposit') {
    const cash = getCash(userId);
    if (cash < rounded) {
      return interaction.reply({
        content: `❌ Tu n’as pas assez d’argent liquide. Cash disponible : **$${cash.toFixed(
          2,
        )}**.`,
        ephemeral: true,
      });
    }

    setCash(userId, cash - rounded);
    const balance = getBankBalance(userId);
    setBankBalance(userId, balance + rounded);

    addUserHistoryEntry(userId, {
      type: 'dépôt',
      amount: +rounded,
      balanceAfter: balance + rounded,
      description: `Dépôt de $${rounded.toFixed(2)} depuis l’argent liquide.`,
      actorId: userId,
    });
  }

  if (type === 'withdraw') {
    const balance = getBankBalance(userId);
    if (balance < rounded) {
      return interaction.reply({
        content: `❌ Solde insuffisant. Solde actuel : **$${balance.toFixed(2)}**.`,
        ephemeral: true,
      });
    }

    setBankBalance(userId, balance - rounded);
    const cash = getCash(userId);
    setCash(userId, cash + rounded);

    addUserHistoryEntry(userId, {
      type: 'retrait',
      amount: -rounded,
      balanceAfter: balance - rounded,
      description: `Retrait de $${rounded.toFixed(2)} vers l’argent liquide.`,
      actorId: userId,
    });
  }

  // Rafraîchir le panneau principal (embed + image)
  const channel = interaction.channel;
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (message) {
    const profile = getOrCreateUserProfile(userId);
    const balance = getBankBalance(userId);
    const lines = formatHistoryLinesForImage(profile.history);
    const { buffer, filename } = await renderUserBankCard(
      balance,
      lines,
      interaction.user.username,
    );
    const attachment = new AttachmentBuilder(buffer, { name: filename });
    const accEmbed = buildUserAccountEmbed(
      interaction.user,
      profile,
      filename,
      balance,
    );

    await message.edit({
      embeds: [accEmbed],
      files: [attachment],
      components: message.components,
    });
  }

  return interaction.reply({
    content:
      type === 'deposit'
        ? `✅ Dépôt de **$${rounded.toFixed(2)}** effectué avec succès.`
        : `✅ Retrait de **$${rounded.toFixed(2)}** effectué avec succès.`,
    ephemeral: true,
  });
}

/* ───────────────────── TRANSFERTS (USER → USER / ENT) ───────────────── */

async function handleTransferTypeSelect(interaction, parts) {
  const [_, userId, messageId] = parts;
  if (interaction.user.id !== userId) {
    return interaction.reply({
      content: '❌ Ce menu ne t’est pas destiné.',
      ephemeral: true,
    });
  }

  const typeDest = interaction.values[0];

  const modal = new ModalBuilder()
    .setCustomId(`bank_transfer_modal|${userId}|${messageId}|${typeDest}`)
    .setTitle('🔁 Virement bancaire');

  const amount = new TextInputBuilder()
    .setCustomId('amount')
    .setLabel('Montant à envoyer (en $)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Exemple : 300')
    .setRequired(true);

  const target = new TextInputBuilder()
    .setCustomId('target')
    .setLabel(
      typeDest === 'user'
        ? 'Mentionne le joueur (@pseudo) ou son ID'
        : 'ID de l’entreprise ou propriétaire (ID joueur)',
    )
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(amount),
    new ActionRowBuilder().addComponents(target),
  );

  return interaction
    .update({
      content: '🔁 Remplis le formulaire de virement.',
      components: [],
    })
    .then(() => interaction.showModal(modal));
}

async function handleTransferModal(interaction, parts) {
  const [_, userId, messageId, typeDest] = parts;

  if (interaction.user.id !== userId) {
    return interaction.reply({
      content: '❌ Ce formulaire ne t’est pas destiné.',
      ephemeral: true,
    });
  }

  const rawAmount = interaction.fields
    .getTextInputValue('amount')
    .replace(',', '.')
    .trim();
  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    return interaction.reply({
      content: '❌ Montant invalide.',
      ephemeral: true,
    });
  }
  const rounded = Math.round(amount * 100) / 100;

  const balance = getBankBalance(userId);
  if (balance < rounded) {
    return interaction.reply({
      content: `❌ Solde insuffisant. Solde actuel : **$${balance.toFixed(2)}**.`,
      ephemeral: true,
    });
  }

  const rawTarget = interaction.fields.getTextInputValue('target').trim();

  if (typeDest === 'user') {
    let targetId = rawTarget;
    const mentionMatch = rawTarget.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
      targetId = mentionMatch[1];
    }

    setBankBalance(userId, balance - rounded);
    const targetBalance = getBankBalance(targetId);
    setBankBalance(targetId, targetBalance + rounded);

    addUserHistoryEntry(userId, {
      type: 'virement sortant',
      amount: -rounded,
      balanceAfter: balance - rounded,
      description: `Virement vers ${targetId}`,
      targetType: 'user',
      targetId,
      actorId: userId,
    });

    addUserHistoryEntry(targetId, {
      type: 'virement entrant',
      amount: +rounded,
      balanceAfter: targetBalance + rounded,
      description: `Virement de ${userId}`,
      targetType: 'user',
      targetId: userId,
      actorId: userId,
    });

    const channel = interaction.channel;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (message) {
      const profile = getOrCreateUserProfile(userId);
      const newBal = getBankBalance(userId);
      const lines = formatHistoryLinesForImage(profile.history);
      const { buffer, filename } = await renderUserBankCard(
        newBal,
        lines,
        interaction.user.username,
      );
      const attachment = new AttachmentBuilder(buffer, { name: filename });
      const accEmbed = buildUserAccountEmbed(
        interaction.user,
        profile,
        filename,
        newBal,
      );
      await message.edit({
        embeds: [accEmbed],
        files: [attachment],
        components: message.components,
      });
    }

    return interaction.reply({
      content: `✅ Virement de **$${rounded.toFixed(2)}** effectué vers <@${targetId}>.`,
      ephemeral: true,
    });
  }

  if (typeDest === 'enterprise') {
    let ent = getEnterprise(rawTarget);
    if (!ent) {
      ent = getEnterpriseByOwner(rawTarget);
    }
    if (!ent) {
      return interaction.reply({
        content: '❌ Impossible de trouver cette entreprise (ID ou propriétaire).',
        ephemeral: true,
      });
    }

    if (isEnterpriseClosed(ent.id) || isEnterpriseFrozen(ent.id)) {
      return interaction.reply({
        content: '🧊 Ce compte entreprise est gelé ou clôturé.',
        ephemeral: true,
      });
    }

    setBankBalance(userId, balance - rounded);

    addEnterpriseHistoryEntry(ent.id, {
      type: 'virement entrant',
      amount: +rounded,
      description: `Virement de ${userId}`,
      targetType: 'user',
      targetId: userId,
      actorId: userId,
    });

    addUserHistoryEntry(userId, {
      type: 'virement entreprise',
      amount: -rounded,
      balanceAfter: balance - rounded,
      description: `Virement vers l’entreprise ${ent.name}`,
      targetType: 'enterprise',
      targetId: ent.id,
      actorId: userId,
    });

    const channel = interaction.channel;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (message) {
      const profile = getOrCreateUserProfile(userId);
      const newBal = getBankBalance(userId);
      const lines = formatHistoryLinesForImage(profile.history);
      const { buffer, filename } = await renderUserBankCard(
        newBal,
        lines,
        interaction.user.username,
      );
      const attachment = new AttachmentBuilder(buffer, { name: filename });
      const accEmbed = buildUserAccountEmbed(
        interaction.user,
        profile,
        filename,
        newBal,
      );
      await message.edit({
        embeds: [accEmbed],
        files: [attachment],
        components: message.components,
      });
    }

    return interaction.reply({
      content: `✅ Virement de **$${rounded.toFixed(2)}** effectué vers l’entreprise **${ent.name}**.`,
      ephemeral: true,
    });
  }
}

/* ───────────────────────── ENTREPRISE (vue simple) ───────────────────────── */

function buildEnterpriseEmbed(ent, balance) {
  const statusStr =
    ent.status === 'frozen'
      ? '🧊 Compte gelé'
      : ent.status === 'closed'
      ? '🚫 Compte clôturé'
      : '✅ Compte actif';

  const hist = formatHistoryList(ent.history);

  return new EmbedBuilder()
    .setColor(0x166534)
    .setTitle(`🏢 Compte entreprise — ${ent.name}`)
    .setDescription(
      [
        `**Statut :** ${statusStr}`,
        `**Numéro de compte :** \`${ent.accountNumber}\``,
        '',
        `💰 **Solde affiché :** \`$${balance.toFixed(
          2,
        )}\` (simulation, à lier à l’éco entreprise)`,
      ].join('\n'),
    )
    .setImage(
      'https://raw.githubusercontent.com/zoowprime/South-Los-Angeles-RP/main/src/assets/bank/entreprise_template.png',
    )
    .addFields({
      name: '📜 Historique récent',
      value: hist,
    })
    .setFooter({ text: 'South Los Angeles RP • Banque Entreprise' })
    .setTimestamp();
}

/* ───────────────────────── HANDLER GLOBAL ───────────────────────── */

async function handleBankInteraction(interaction) {
  // PIN codedéfinir
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'bank_setpin_continue') {
      return handlePinSelect(interaction);
    }

    if (interaction.customId.startsWith('bank_transfer_type')) {
      const parts = interaction.customId.split('|');
      return handleTransferTypeSelect(interaction, parts);
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'bank_setpin_modal') {
      return handlePinModal(interaction);
    }

    if (
      interaction.customId.startsWith('bank_user_deposit') ||
      interaction.customId.startsWith('bank_user_withdraw')
    ) {
      const [kind, userId, messageId] = interaction.customId.split('|');
      const type = kind === 'bank_user_deposit' ? 'deposit' : 'withdraw';
      return handleUserMoneyModal(interaction, type, userId, messageId);
    }

    if (interaction.customId.startsWith('bank_transfer_modal')) {
      const parts = interaction.customId.split('|');
      return handleTransferModal(interaction, parts);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('bank_user|')) {
      const parts = interaction.customId.split('|');
      return handleUserButtons(interaction, parts);
    }
  }
}

/* ───────────────────────── EXPORTS ───────────────────────── */

module.exports = {
  handleBankInteraction,
  startUserPinFlow,
};
