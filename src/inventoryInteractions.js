// src/inventoryInteractions.js
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const {
  getUserSnapshot,
  getTotalWeight,
  addItem,
  removeItem,
  changeHungerThirst,
} = require('./data/inventoryStore');

const { itemCatalog } = require('./data/itemCatalog');
const { buildInventoryMessage } = require('./commands/inventaire');

/**
 * Rafraîchit le message principal d’inventaire (celui de /inventaire)
 * après une action (don, use, drop).
 */
async function refreshInventoryMessage(interaction, userId, channelId, messageId) {
  try {
    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    if (!msg) return;

    const user = await interaction.client.users.fetch(userId);
    const payload = await buildInventoryMessage(user);

    await msg.edit(payload).catch(() => {});
  } catch (err) {
    console.error('[INV] Erreur refreshInventoryMessage :', err);
  }
}

/**
 * Génère les options d’items pour un joueur
 */
function buildItemOptions(userId, { onlyConsumables = false } = {}) {
  const inv = getUserSnapshot(userId);
  const entries = Object.values(inv.items || {}).filter(e => e.quantity > 0);

  return entries
    .map(entry => {
      const def = itemCatalog[entry.id];
      if (!def) return null;
      if (onlyConsumables && !def.consumable) return null;

      const w = typeof def.weight === 'number' ? def.weight : 0;
      return {
        label: def.label || entry.id,
        value: entry.id,
        description: `x${entry.quantity} • ${w}kg`,
        emoji: def.emoji || undefined,
      };
    })
    .filter(Boolean);
}

/**
 * Applique les effets de consommation (faim / soif) d’un item consommable
 */
function applyConsumeEffects(userId, itemId) {
  const def = itemCatalog[itemId];
  if (!def || !def.consumable) return getUserSnapshot(userId);

  const effect = def.effect || {};
  const hungerDelta = effect.hungerDelta || 0;
  const thirstDelta = effect.thirstDelta || 0;

  return changeHungerThirst(userId, { hungerDelta, thirstDelta });
}

/**
 * Message RP de consommation
 */
function getConsumeRPText(itemId) {
  const def = itemCatalog[itemId];
  const name = def?.label || 'l’objet';

  if (itemId === 'bouteille_eau') {
    return `💧 Vous prenez plusieurs gorgées de votre **${name}**.`;
  }
  if (itemId === 'cola_cup') {
    return `🥤 Vous buvez votre **${name}** d’une traite, le sucre vous réveille un peu.`;
  }
  if (itemId === 'burger_poulet') {
    return `🍔 Vous croquez dans votre **${name}**, de quoi calmer la faim pour un moment.`;
  }
  if (itemId === 'double_cheese') {
    return `🍔 Vous engloutissez votre **${name}**, un repas bien gras qui cale l’estomac.`;
  }

  return `✨ Vous utilisez **${name}**.`;
}

/**
 * Handler principal pour toutes les interactions d’inventaire
 */
async function handleInventoryInteraction(interaction) {
  const userId = interaction.user.id;

  // ───────────────────────────────────────────────────────────
  // BOUTONS
  // ───────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    // Donner
    if (interaction.customId === 'inv_give') {
      const options = buildItemOptions(userId, { onlyConsumables: false });
      if (!options.length) {
        return interaction.reply({
          content: '📦 Tu n’as aucun objet à donner.',
          ephemeral: true,
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`inv_give_item|${interaction.channelId}|${interaction.message.id}`)
          .setPlaceholder('Choisis l’objet à donner…')
          .addOptions(options),
      );

      return interaction.reply({
        content: '📤 Sélectionne l’objet que tu souhaites **donner**.',
        components: [row],
        ephemeral: true,
      });
    }

    // Utiliser
    if (interaction.customId === 'inv_use') {
      const options = buildItemOptions(userId, { onlyConsumables: true });
      if (!options.length) {
        return interaction.reply({
          content: '📩 Tu n’as aucun objet **consommable** à utiliser.',
          ephemeral: true,
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`inv_use_item|${interaction.channelId}|${interaction.message.id}`)
          .setPlaceholder('Choisis l’objet à utiliser…')
          .addOptions(options),
      );

      return interaction.reply({
        content: '📩 Choisis l’objet que tu souhaites **consommer**.',
        components: [row],
        ephemeral: true,
      });
    }

    // Jeter
    if (interaction.customId === 'inv_drop') {
      const options = buildItemOptions(userId, { onlyConsumables: false }); // tu peux tout jeter
      if (!options.length) {
        return interaction.reply({
          content: '📥 Tu n’as aucun objet à jeter.',
          ephemeral: true,
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`inv_drop_item|${interaction.channelId}|${interaction.message.id}`)
          .setPlaceholder('Choisis l’objet à jeter…')
          .addOptions(options),
      );

      return interaction.reply({
        content: '📥 Choisis l’objet que tu veux **jeter au sol**.',
        components: [row],
        ephemeral: true,
      });
    }

    // Si ce n’est pas une interaction d’inventaire
    return;
  }

  // ───────────────────────────────────────────────────────────
  // SELECT MENUS
  // ───────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu()) {
    const [type, chId, msgId] = interaction.customId.split('|');

    // Donner – choix de l’objet
    if (type === 'inv_give_item') {
      const itemId = interaction.values[0];

      const row = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`inv_give_target|${itemId}|${chId}|${msgId}`)
          .setPlaceholder('Choisis le joueur à qui donner cet objet…'),
      );

      return interaction.update({
        content: `📤 Tu as choisi **${itemCatalog[itemId]?.label || itemId}**.\nSélectionne maintenant le joueur qui va le recevoir :`,
        components: [row],
      });
    }

    // Utiliser – choix du consommable
    if (type === 'inv_use_item') {
      const itemId = interaction.values[0];

      // On retire 1 exemplaire
      const remove = removeItem(userId, itemId, 1);
      if (!remove.ok) {
        return interaction.update({
          content: '❌ Tu ne possèdes plus cet objet.',
          components: [],
        });
      }

      // Appliquer les effets
      const newInv = applyConsumeEffects(userId, itemId);

      // Rafraîchir l’inventaire principal
      await refreshInventoryMessage(interaction, userId, chId, msgId);

      const rpText = getConsumeRPText(itemId);
      const hunger = Math.round(newInv.hunger ?? 0);
      const thirst = Math.round(newInv.thirst ?? 0);

      return interaction.update({
        content: `${rpText}\n\n🍖 Faim actuelle : **${hunger}%**\n💧 Soif actuelle : **${thirst}%**`,
        components: [],
      });
    }

    // Jeter – choix de l’objet
    if (type === 'inv_drop_item') {
      const itemId = interaction.values[0];
      const def = itemCatalog[itemId];

      const modal = new ModalBuilder()
        .setCustomId(`inv_drop_qty|${itemId}|${chId}|${msgId}`)
        .setTitle('Jeter des objets');

      const input = new TextInputBuilder()
        .setCustomId('qty')
        .setLabel(`Combien de "${def?.label || itemId}" veux-tu jeter ?`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Exemple : 1, 2, 3...')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    return;
  }

  // ───────────────────────────────────────────────────────────
  // SELECT MENU UTILISATEUR (Donner)
  // ───────────────────────────────────────────────────────────
  if (interaction.isUserSelectMenu()) {
    const [type, itemId, chId, msgId] = interaction.customId.split('|');

    if (type === 'inv_give_target') {
      const targetId = interaction.values[0];
      if (!targetId || targetId === interaction.user.id) {
        return interaction.update({
          content: '❌ Tu dois sélectionner un **autre** joueur.',
          components: [],
        });
      }

      // Vérifier que le donneur a bien l’objet
      const snapshot = getUserSnapshot(userId);
      const entry = snapshot.items?.[itemId];
      if (!entry || entry.quantity <= 0) {
        return interaction.update({
          content: '❌ Tu ne possèdes plus cet objet.',
          components: [],
        });
      }

      // Retirer 1 au donneur
      const removed = removeItem(userId, itemId, 1);
      if (!removed.ok) {
        return interaction.update({
          content: '❌ Impossible de retirer l’objet de ton inventaire.',
          components: [],
        });
      }

      // Ajouter 1 au receveur (avec gestion du surpoids)
      const addResult = addItem(targetId, itemId, 1);
      if (!addResult.ok) {
        // On restitue l’objet au donneur
        addItem(userId, itemId, 1);

        if (addResult.reason === 'overweight') {
          return interaction.update({
            content: '❌ L’inventaire du joueur ciblé est **trop lourd** pour recevoir cet objet.',
            components: [],
          });
        }

        return interaction.update({
          content: '❌ Impossible d’ajouter l’objet à l’inventaire du joueur ciblé.',
          components: [],
        });
      }

      // Rafraîchir l’inventaire principal du donneur
      await refreshInventoryMessage(interaction, userId, chId, msgId);

      const def = itemCatalog[itemId];
      const label = def?.label || itemId;

      return interaction.update({
        content: `📤 Tu as donné **1x ${label}** à <@${targetId}>.`,
        components: [],
      });
    }

    return;
  }

  // ───────────────────────────────────────────────────────────
  // MODAL : quantité à jeter
  // ───────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const [type, itemId, chId, msgId] = interaction.customId.split('|');
    if (type !== 'inv_drop_qty') return;

    const rawQty = interaction.fields.getTextInputValue('qty');
    const qty = parseInt(rawQty, 10);

    if (isNaN(qty) || qty <= 0) {
      return interaction.reply({
        content: '❌ Quantité invalide. Merci d’entrer un nombre positif.',
        ephemeral: true,
      });
    }

    // Vérifier quantité possédée
    const snapshot = getUserSnapshot(userId);
    const entry = snapshot.items?.[itemId];
    if (!entry || entry.quantity <= 0) {
      return interaction.reply({
        content: '❌ Tu ne possèdes pas cet objet.',
        ephemeral: true,
      });
    }

    if (qty > entry.quantity) {
      return interaction.reply({
        content: `❌ Tu ne peux pas jeter **${qty}** exemplaires, tu n’en as que **${entry.quantity}**.`,
        ephemeral: true,
      });
    }

    // Retirer
    const res = removeItem(userId, itemId, qty);
    if (!res.ok) {
      return interaction.reply({
        content: '❌ Impossible de retirer ces objets de ton inventaire.',
        ephemeral: true,
      });
    }

    // Rafraîchir l’inventaire principal
    await refreshInventoryMessage(interaction, userId, chId, msgId);

    const def = itemCatalog[itemId];
    const label = def?.label || itemId;

    return interaction.reply({
      content: `📥 Vous avez jeté **${qty}x ${label}** au sol.`,
      ephemeral: true,
    });
  }
}

module.exports = {
  handleInventoryInteraction,
};
