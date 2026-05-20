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
import { WOW_CLASSES } from '../types/index';
import {
  addCharacter,
  updateCharacter,
  deleteCharacter,
  deleteAllCharactersForUser,
  getUserCharacters,
  getCharacterById,
  getPlayerChannel,
  getLogChannel,
  getAllPlayerChannels,
} from '../database/db';
import { isManagement } from '../utils/permissions';
import { exportRosterToSheets } from '../sheets/sheets';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin/Council-Verwaltung')
  .addSubcommand(sub => sub
    .setName('char-add')
    .setDescription('Char für einen Spieler eintragen')
    .addUserOption(opt => opt
      .setName('user')
      .setDescription('Spieler')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('klasse')
      .setDescription('WoW-Klasse')
      .setRequired(true)
      .setAutocomplete(true))
    .addStringOption(opt => opt
      .setName('name')
      .setDescription('Char-Name')
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(12))
    .addStringOption(opt => opt
      .setName('server')
      .setDescription('Realm-Name')
      .setRequired(true))
    .addIntegerOption(opt => opt
      .setName('ilvl')
      .setDescription('Item Level')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1000)))
  .addSubcommand(sub => sub
    .setName('char-edit')
    .setDescription('Char eines Spielers bearbeiten')
    .addUserOption(opt => opt
      .setName('user')
      .setDescription('Spieler')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('char')
      .setDescription('Welchen Char bearbeiten?')
      .setRequired(true)
      .setAutocomplete(true))
    .addStringOption(opt => opt
      .setName('klasse')
      .setDescription('Neue Klasse')
      .setAutocomplete(true))
    .addStringOption(opt => opt
      .setName('name')
      .setDescription('Neuer Char-Name')
      .setMinLength(2)
      .setMaxLength(12))
    .addStringOption(opt => opt
      .setName('server')
      .setDescription('Neuer Realm'))
    .addIntegerOption(opt => opt
      .setName('ilvl')
      .setDescription('Neues Item Level')
      .setMinValue(1)
      .setMaxValue(1000)))
  .addSubcommand(sub => sub
    .setName('char-remove')
    .setDescription('Char eines Spielers löschen')
    .addUserOption(opt => opt
      .setName('user')
      .setDescription('Spieler')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('char')
      .setDescription('Welchen Char löschen?')
      .setRequired(true)
      .setAutocomplete(true)))
  .addSubcommand(sub => sub
    .setName('remove-player')
    .setDescription('Alle Chars eines Spielers löschen (z.B. bei Gildenaustritt)')
    .addUserOption(opt => opt
      .setName('user')
      .setDescription('Spieler')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('announce')
    .setDescription('Nachricht mit Char-Eintrage-Aufforderung an alle Player-Channels schicken'))
  .addSubcommand(sub => sub
    .setName('export')
    .setDescription('Roster in Google Sheets exportieren'));

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'klasse') {
    const matches = WOW_CLASSES.filter(c =>
      c.name.toLowerCase().includes(focused.value.toLowerCase())
    );
    await interaction.respond(matches.map(c => ({ name: c.name, value: c.name })));
    return;
  }

  if (focused.name === 'char' && interaction.guildId) {
    const targetUserId = interaction.options.get('user')?.value as string | undefined;
    if (!targetUserId) {
      await interaction.respond([]);
      return;
    }
    const chars = getUserCharacters(targetUserId, interaction.guildId);
    const matches = chars.filter(c =>
      `${c.char_name}-${c.server}`.toLowerCase().includes(focused.value.toLowerCase())
    );
    await interaction.respond(
      matches.slice(0, 25).map(c => ({
        name: `${c.char_name}-${c.server} (${c.class_name}, ${c.ilvl} ilvl)`,
        value: String(c.id),
      }))
    );
  }
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;

  if (!isManagement(member)) {
    await interaction.reply({ content: '❌ Nur Admin/Council können diesen Command nutzen.', ephemeral: true });
    return;
  }

  const guildId = interaction.guildId!;
  const sub = interaction.options.getSubcommand();

  if (sub === 'char-add')      return handleAdd(interaction, guildId, member);
  if (sub === 'char-edit')     return handleEdit(interaction, guildId, member);
  if (sub === 'char-remove')   return handleRemove(interaction, guildId, member);
  if (sub === 'remove-player') return handleRemovePlayer(interaction, guildId, member);
  if (sub === 'announce')      return handleAnnounce(interaction);
  if (sub === 'export')        return handleExport(interaction, guildId);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendToPlayerChannel(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  targetUserId: string,
  embed: EmbedBuilder,
): Promise<void> {
  const playerChannel = getPlayerChannel(targetUserId, guildId);
  if (!playerChannel) return;

  try {
    const channel = await interaction.client.channels.fetch(playerChannel.channel_id);
    if (channel instanceof TextChannel) {
      await channel.send({ embeds: [embed] });
    }
  } catch {
    // Player-Channel nicht erreichbar
  }
}

async function sendToLogChannel(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  embed: EmbedBuilder,
): Promise<void> {
  const logChannelId = getLogChannel(guildId);
  if (!logChannelId) return;

  try {
    const channel = await interaction.client.channels.fetch(logChannelId);
    if (channel instanceof TextChannel) {
      await channel.send({ embeds: [embed] });
    }
  } catch {
    // Log-Channel nicht erreichbar
  }
}

// ── Subcommand handlers ───────────────────────────────────────────────────────

async function handleAdd(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  admin: GuildMember,
): Promise<void> {
  const targetUser = interaction.options.getUser('user', true);
  const classInput = interaction.options.getString('klasse', true);
  const charName   = interaction.options.getString('name',   true);
  const server     = interaction.options.getString('server', true);
  const ilvl       = interaction.options.getInteger('ilvl',  true);

  const wowClass = WOW_CLASSES.find(c => c.name.toLowerCase() === classInput.toLowerCase());
  if (!wowClass) {
    await interaction.reply({ content: '❌ Ungültige Klasse.', ephemeral: true });
    return;
  }

  try {
    addCharacter(targetUser.id, guildId, charName, server, wowClass.name, ilvl);
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE constraint failed')) {
      await interaction.reply({ content: `❌ **${charName}-${server}** ist bereits eingetragen.`, ephemeral: true });
      return;
    }
    throw err;
  }

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(wowClass.color)
      .setTitle('✅ Char eingetragen')
      .addFields(
        { name: 'Spieler', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Char',    value: `${charName}-${server}`, inline: true },
        { name: 'Klasse',  value: wowClass.name, inline: true },
        { name: 'ilvl',    value: String(ilvl), inline: true },
      )
      .setTimestamp()],
    ephemeral: true,
  });

  const playerEmbed = new EmbedBuilder()
    .setColor(wowClass.color)
    .setTitle('Char eingetragen')
    .setDescription(`<@${admin.id}> hat einen Char für dich eingetragen.`)
    .addFields(
      { name: 'Char',   value: `${charName}-${server}`, inline: true },
      { name: 'Klasse', value: wowClass.name, inline: true },
      { name: 'ilvl',   value: String(ilvl), inline: true },
    )
    .setTimestamp();

  await sendToPlayerChannel(interaction, guildId, targetUser.id, playerEmbed);
  await sendToLogChannel(interaction, guildId, new EmbedBuilder()
    .setColor(wowClass.color)
    .setTitle('📥 Char eingetragen (Admin)')
    .setDescription(`<@${admin.id}> hat einen Char für <@${targetUser.id}> eingetragen`)
    .addFields(
      { name: 'Char',   value: `${charName}-${server}`, inline: true },
      { name: 'Klasse', value: wowClass.name, inline: true },
      { name: 'ilvl',   value: String(ilvl), inline: true },
    )
    .setTimestamp()
  );
}

async function handleEdit(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  admin: GuildMember,
): Promise<void> {
  const targetUser = interaction.options.getUser('user', true);
  const idStr  = interaction.options.getString('char', true);
  const charId = parseInt(idStr, 10);

  if (isNaN(charId)) {
    await interaction.reply({ content: '❌ Ungültige Auswahl.', ephemeral: true });
    return;
  }

  const existing = getCharacterById(charId);
  if (!existing || existing.user_id !== targetUser.id || existing.guild_id !== guildId) {
    await interaction.reply({ content: '❌ Char nicht gefunden.', ephemeral: true });
    return;
  }

  const classInput = interaction.options.getString('klasse');
  const charName   = interaction.options.getString('name')   ?? existing.char_name;
  const server     = interaction.options.getString('server') ?? existing.server;
  const ilvl       = interaction.options.getInteger('ilvl')  ?? existing.ilvl;

  let className = existing.class_name;
  if (classInput) {
    const wowClass = WOW_CLASSES.find(c => c.name.toLowerCase() === classInput.toLowerCase());
    if (!wowClass) {
      await interaction.reply({ content: '❌ Ungültige Klasse.', ephemeral: true });
      return;
    }
    className = wowClass.name;
  }

  try {
    updateCharacter(charId, charName, server, className, ilvl);
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE constraint failed')) {
      await interaction.reply({ content: '❌ Ein Char mit diesem Namen/Server existiert bereits.', ephemeral: true });
      return;
    }
    throw err;
  }

  const wowClass = WOW_CLASSES.find(c => c.name === className)!;

  const logChanges: string[] = [];
  if (charName  !== existing.char_name)  logChanges.push(`Name: ${existing.char_name} -> ${charName}`);
  if (server    !== existing.server)     logChanges.push(`Server: ${existing.server} -> ${server}`);
  if (className !== existing.class_name) logChanges.push(`Klasse: ${existing.class_name} -> ${className}`);
  if (ilvl      !== existing.ilvl)       logChanges.push(`ilvl: ${existing.ilvl} -> ${ilvl}`);

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(wowClass.color)
      .setTitle('✅ Char aktualisiert')
      .addFields(
        { name: 'Spieler', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Char',    value: `${charName}-${server}`, inline: true },
        { name: 'Klasse',  value: className, inline: true },
        { name: 'ilvl',    value: String(ilvl), inline: true },
      )
      .setTimestamp()],
    ephemeral: true,
  });

  const playerEmbed = new EmbedBuilder()
    .setColor(wowClass.color)
    .setTitle('Char aktualisiert')
    .setDescription(`<@${admin.id}> hat deinen Char **${charName}-${server}** bearbeitet.`)
    .addFields({ name: 'Änderungen', value: logChanges.length > 0 ? logChanges.join('\n') : '-' })
    .setTimestamp();

  await sendToPlayerChannel(interaction, guildId, targetUser.id, playerEmbed);
  await sendToLogChannel(interaction, guildId, new EmbedBuilder()
    .setColor(wowClass.color)
    .setTitle('✏️ Char aktualisiert (Admin)')
    .setDescription(`<@${admin.id}> hat **${charName}-${server}** von <@${targetUser.id}> bearbeitet`)
    .addFields({ name: 'Änderungen', value: logChanges.length > 0 ? logChanges.join('\n') : '-' })
    .setTimestamp()
  );
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  admin: GuildMember,
): Promise<void> {
  const targetUser = interaction.options.getUser('user', true);
  const charId = parseInt(interaction.options.getString('char', true), 10);

  if (isNaN(charId)) {
    await interaction.reply({ content: '❌ Ungültige Auswahl.', ephemeral: true });
    return;
  }

  const existing = getCharacterById(charId);
  if (!existing || existing.user_id !== targetUser.id || existing.guild_id !== guildId) {
    await interaction.reply({ content: '❌ Char nicht gefunden.', ephemeral: true });
    return;
  }

  deleteCharacter(charId, targetUser.id, guildId);

  await interaction.reply({
    content: `✅ **${existing.char_name}-${existing.server}** von <@${targetUser.id}> wurde gelöscht.`,
    ephemeral: true,
  });

  const playerEmbed = new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle('Char gelöscht')
    .setDescription(`<@${admin.id}> hat deinen Char **${existing.char_name}-${existing.server}** entfernt.`)
    .addFields(
      { name: 'Klasse', value: existing.class_name, inline: true },
      { name: 'ilvl',   value: String(existing.ilvl), inline: true },
    )
    .setTimestamp();

  await sendToPlayerChannel(interaction, guildId, targetUser.id, playerEmbed);
  await sendToLogChannel(interaction, guildId, new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle('🗑️ Char gelöscht (Admin)')
    .setDescription(`<@${admin.id}> hat **${existing.char_name}-${existing.server}** von <@${targetUser.id}> entfernt`)
    .addFields(
      { name: 'Klasse', value: existing.class_name, inline: true },
      { name: 'ilvl',   value: String(existing.ilvl), inline: true },
    )
    .setTimestamp()
  );
}

async function handleRemovePlayer(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  admin: GuildMember,
): Promise<void> {
  const targetUser = interaction.options.getUser('user', true);

  const chars = getUserCharacters(targetUser.id, guildId);

  if (chars.length === 0) {
    await interaction.reply({
      content: `❌ <@${targetUser.id}> hat keine eingetragenen Chars.`,
      ephemeral: true,
    });
    return;
  }

  deleteAllCharactersForUser(targetUser.id, guildId);

  const charList = chars
    .map(c => `${c.char_name}-${c.server} (${c.class_name}, ${c.ilvl} ilvl)`)
    .join('\n');

  await interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle('🗑️ Spieler entfernt')
      .setDescription(`Alle Chars von <@${targetUser.id}> wurden gelöscht.`)
      .addFields({ name: `${chars.length} gelöschte Chars`, value: charList })
      .setTimestamp()],
    ephemeral: true,
  });

  await sendToPlayerChannel(interaction, guildId, targetUser.id, new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle('Chars entfernt')
    .setDescription(`<@${admin.id}> hat alle deine eingetragenen Chars entfernt.`)
    .addFields({ name: `${chars.length} Chars`, value: charList })
    .setTimestamp()
  );

  await sendToLogChannel(interaction, guildId, new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle('🗑️ Spieler entfernt (Admin)')
    .setDescription(`<@${admin.id}> hat alle Chars von <@${targetUser.id}> gelöscht`)
    .addFields({ name: `${chars.length} gelöschte Chars`, value: charList })
    .setTimestamp()
  );
}

async function handleExport(
  interaction: ChatInputCommandInteraction,
  guildId: string,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const channels = getAllPlayerChannels(guildId);
  if (channels.length === 0) {
    await interaction.editReply('❌ Keine Player-Channels registriert.');
    return;
  }

  const guild = interaction.guild!;
  const players: Awaited<Parameters<typeof exportRosterToSheets>[0]> = [];

  for (const entry of channels) {
    let displayName = entry.user_id;
    try {
      const member = await guild.members.fetch(entry.user_id);
      displayName = member.displayName;
    } catch {
      // Mitglied hat den Server verlassen — user_id als Fallback
    }

    const chars = getUserCharacters(entry.user_id, guildId);
    players.push({
      displayName,
      chars: chars.map(c => ({
        name:      c.char_name,
        server:    c.server,
        className: c.class_name,
        ilvl:      c.ilvl,
      })),
    });
  }

  try {
    await exportRosterToSheets(players);
  } catch (err: any) {
    await interaction.editReply(`❌ Export fehlgeschlagen: ${err.message}`);
    return;
  }

  await interaction.editReply(`✅ Google Sheets aktualisiert — ${players.length} Spieler exportiert.`);
}

const DEFAULT_ANNOUNCE_TEXT =
`Bitte trag deine WoW-Chars in den Roster ein, damit wir einen aktuellen Überblick über alle verfügbaren Chars haben.

**Char hinzufügen:** \`/char add\` — Klasse, Name, Server und Item Level angeben. Du kannst mehrere Chars eintragen (Main + Alts).

**Char aktualisieren:** \`/char edit\` — Wähle einen Char aus und ändere nur die gewünschten Felder (z.B. neues ilvl).

**Char löschen:** \`/char remove\` — Wähle einen Char aus der Liste.

**Deine Chars anzeigen:** \`/char list\`

Alle Commands funktionieren nur in diesem Channel. Bitte halte dein ilvl aktuell.`;

async function handleAnnounce(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('announce_modal')
    .setTitle('Ankündigung an alle Player-Channels');

  const textInput = new TextInputBuilder()
    .setCustomId('announce_text')
    .setLabel('Nachricht (unterstützt Discord-Markdown)')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(DEFAULT_ANNOUNCE_TEXT)
    .setMaxLength(3000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));

  await interaction.showModal(modal);
}

export async function handleAnnounceSubmit(
  interaction: ModalSubmitInteraction,
  guildId: string,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const channels = getAllPlayerChannels(guildId);

  if (channels.length === 0) {
    await interaction.editReply('❌ Keine Player-Channels registriert. Bitte zuerst `/setup player-channel` ausführen.');
    return;
  }

  const text = interaction.fields.getTextInputValue('announce_text').trim();

  let sent = 0;
  let failed = 0;

  for (const entry of channels) {
    try {
      const channel = await interaction.client.channels.fetch(entry.channel_id);
      if (channel instanceof TextChannel) {
        await channel.send({ content: text });
        sent++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  const statusLines = [`✅ Erfolgreich gesendet: **${sent}** Channels`];
  if (failed > 0) statusLines.push(`❌ Fehlgeschlagen: **${failed}** Channels (Channel gelöscht oder Bot hat keinen Zugriff)`);

  await interaction.editReply(statusLines.join('\n'));
}
