import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  GuildMember,
  TextChannel,
} from 'discord.js';
import {
  addAbsence,
  getUserAbsences,
  getAbsencesForWeek,
  deleteAbsence,
  getAbsenceById,
  getAbsenceChannel,
} from '../database/db';
import { hasAnyGuildRole } from '../utils/permissions';
import { parseDateDE, formatDateDE } from '../utils/dates';

export const data = new SlashCommandBuilder()
  .setName('absence')
  .setDescription('Abwesenheiten verwalten')
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Abwesenheit eintragen'))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Abwesenheiten der nächsten 7 Tage anzeigen'))
  .addSubcommand(sub => sub
    .setName('mine')
    .setDescription('Meine eingetragenen Abwesenheiten anzeigen'))
  .addSubcommand(sub => sub
    .setName('remove')
    .setDescription('Eigene Abwesenheit löschen')
    .addStringOption(opt => opt
      .setName('id')
      .setDescription('Abwesenheit auswählen')
      .setRequired(true)
      .setAutocomplete(true)));

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'id') return;

  const absences = getUserAbsences(interaction.user.id, interaction.guildId);
  const query = focused.value.toLowerCase();
  const matches = absences.filter(a =>
    formatDateDE(a.start_date).includes(query) ||
    formatDateDE(a.end_date).includes(query) ||
    (a.reason ?? '').toLowerCase().includes(query)
  );

  await interaction.respond(
    matches.slice(0, 25).map(a => ({
      name: `${formatDateDE(a.start_date)} – ${formatDateDE(a.end_date)}${a.reason ? ` (${a.reason})` : ''}`,
      value: String(a.id),
    }))
  );
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!hasAnyGuildRole(member)) {
    await interaction.reply({ content: '❌ Du hast keine Berechtigung für diesen Command.', ephemeral: true });
    return;
  }

  const guildId = interaction.guildId!;
  const sub = interaction.options.getSubcommand();

  if (sub === 'add')    return handleAdd(interaction);
  if (sub === 'list')   return handleList(interaction, guildId);
  if (sub === 'mine')   return handleMine(interaction, guildId);
  if (sub === 'remove') return handleRemove(interaction, guildId);
}

async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('absence_add_modal')
    .setTitle('Abwesenheit eintragen');

  const vonInput = new TextInputBuilder()
    .setCustomId('absence_von')
    .setLabel('Von (TT.MM.JJJJ)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('15.06.2026')
    .setRequired(true);

  const bisInput = new TextInputBuilder()
    .setCustomId('absence_bis')
    .setLabel('Bis (TT.MM.JJJJ) — leer lassen für nur 1 Tag')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('leer = gleicher Tag wie Von')
    .setRequired(false);

  const grundInput = new TextInputBuilder()
    .setCustomId('absence_grund')
    .setLabel('Grund (optional)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(vonInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(bisInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(grundInput),
  );

  await interaction.showModal(modal);
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  const todayUTC = new Date();
  const startDate = new Date(Date.UTC(todayUTC.getFullYear(), todayUTC.getMonth(), todayUTC.getDate()));
  const endDate   = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);

  const start = startDate.toISOString().slice(0, 10);
  const end   = endDate.toISOString().slice(0, 10);

  const absences = getAbsencesForWeek(guildId, start, end);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📅 Abwesenheiten — nächste 7 Tage (${formatDateDE(start)} – ${formatDateDE(end)})`);

  if (absences.length === 0) {
    embed.setDescription('Keine Abwesenheiten in den nächsten 7 Tagen. ✅');
  } else {
    const userIds = [...new Set(absences.map(a => a.user_id))];
    try { await interaction.guild?.members.fetch({ user: userIds }); } catch { /* ignore */ }

    for (const abs of absences.slice(0, 25)) {
      const member = interaction.guild?.members.cache.get(abs.user_id);
      const name   = member?.displayName ?? abs.user_id;
      const dateRange = `${formatDateDE(abs.start_date)} – ${formatDateDE(abs.end_date)}`;
      embed.addFields({
        name,
        value: abs.reason ? `${dateRange}\n*${abs.reason}*` : dateRange,
      });
    }
    if (absences.length > 25) {
      embed.setFooter({ text: `+ ${absences.length - 25} weitere nicht angezeigt` });
    }
  }

  embed.setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleMine(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  const absences = getUserAbsences(interaction.user.id, guildId);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📋 Meine Abwesenheiten');

  if (absences.length === 0) {
    embed.setDescription('Keine Abwesenheiten eingetragen.');
  } else {
    for (const abs of absences.slice(0, 25)) {
      embed.addFields({
        name: `${formatDateDE(abs.start_date)} – ${formatDateDE(abs.end_date)}`,
        value: abs.reason ?? '*Kein Grund angegeben*',
      });
    }
  }

  embed.setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  const id = parseInt(interaction.options.getString('id', true), 10);

  if (isNaN(id)) {
    await interaction.reply({ content: '❌ Ungültige Auswahl.', ephemeral: true });
    return;
  }

  const absence = getAbsenceById(id);
  if (!absence || absence.user_id !== interaction.user.id || absence.guild_id !== guildId) {
    await interaction.reply({ content: '❌ Abwesenheit nicht gefunden.', ephemeral: true });
    return;
  }

  deleteAbsence(id, interaction.user.id, guildId);

  await interaction.reply({
    content: `✅ Abwesenheit **${formatDateDE(absence.start_date)} – ${formatDateDE(absence.end_date)}** wurde gelöscht.`,
    ephemeral: true,
  });
}

export async function handleAbsenceAddSubmit(
  interaction: ModalSubmitInteraction,
  guildId: string,
): Promise<void> {
  const vonRaw   = interaction.fields.getTextInputValue('absence_von').trim();
  const bisRawInput = interaction.fields.getTextInputValue('absence_bis').trim();
  const grundRaw = interaction.fields.getTextInputValue('absence_grund').trim();

  const vonISO = parseDateDE(vonRaw);
  if (!vonISO) {
    await interaction.reply({ content: '❌ Ungültiges Startdatum. Format: TT.MM.JJJJ (z.B. 15.06.2026)', ephemeral: true });
    return;
  }

  const bisRaw = bisRawInput || vonRaw;
  const bisISO = parseDateDE(bisRaw);
  if (!bisISO) {
    await interaction.reply({ content: '❌ Ungültiges Enddatum. Format: TT.MM.JJJJ (z.B. 20.06.2026)', ephemeral: true });
    return;
  }
  if (bisISO < vonISO) {
    await interaction.reply({ content: '❌ Das Enddatum muss nach dem Startdatum liegen.', ephemeral: true });
    return;
  }

  addAbsence(interaction.user.id, guildId, vonISO, bisISO, grundRaw || null);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('✅ Abwesenheit eingetragen');

  if (vonISO === bisISO) {
    embed.addFields({ name: 'Datum', value: vonRaw, inline: true });
  } else {
    embed.addFields(
      { name: 'Von', value: vonRaw, inline: true },
      { name: 'Bis', value: bisRaw, inline: true },
    );
  }

  if (grundRaw) embed.addFields({ name: 'Grund', value: grundRaw });
  embed.setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });

  const absenceChannelId = getAbsenceChannel(guildId);
  if (absenceChannelId) {
    try {
      const channel = await interaction.client.channels.fetch(absenceChannelId);
      if (channel instanceof TextChannel) {
        const notifyEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📅 Neue Abwesenheit')
          .setDescription(`<@${interaction.user.id}> ist von **${vonRaw}** bis **${bisRaw}** abwesend.`);
        if (grundRaw) notifyEmbed.addFields({ name: 'Grund', value: grundRaw });
        notifyEmbed.setTimestamp();
        await channel.send({ embeds: [notifyEmbed] });
      }
    } catch {
      // Absence-Channel nicht erreichbar
    }
  }
}
