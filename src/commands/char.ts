import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  GuildMember,
  TextChannel,
} from 'discord.js';
import { WOW_CLASSES } from '../types/index';
import {
  addCharacter,
  updateCharacter,
  deleteCharacter,
  getUserCharacters,
  getCharacterById,
  getLogChannel,
} from '../database/db';
import { hasAnyGuildRole } from '../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('char')
  .setDescription('Verwalte deine WoW-Chars')
  .addSubcommand(sub => sub
    .setName('add')
    .setDescription('Füge einen neuen Char hinzu')
    .addStringOption(opt => opt
      .setName('klasse')
      .setDescription('WoW-Klasse des Chars')
      .setRequired(true)
      .setAutocomplete(true))
    .addStringOption(opt => opt
      .setName('name')
      .setDescription('Char-Name (ohne Server)')
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(12))
    .addStringOption(opt => opt
      .setName('server')
      .setDescription('Realm-Name (z.B. Blackhand)')
      .setRequired(true))
    .addIntegerOption(opt => opt
      .setName('ilvl')
      .setDescription('Item Level')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1000)))
  .addSubcommand(sub => sub
    .setName('edit')
    .setDescription('Bearbeite einen bestehenden Char')
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
    .setName('remove')
    .setDescription('Lösche einen Char')
    .addStringOption(opt => opt
      .setName('char')
      .setDescription('Welchen Char löschen?')
      .setRequired(true)
      .setAutocomplete(true)))
  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('Zeige deine eingetragenen Chars'));

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
    const chars = getUserCharacters(interaction.user.id, interaction.guildId);
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
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (!hasAnyGuildRole(member)) {
    await interaction.reply({ content: '❌ Keine Berechtigung für diesen Command.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub === 'add')    return handleAdd(interaction, userId, guildId);
  if (sub === 'edit')   return handleEdit(interaction, userId, guildId);
  if (sub === 'remove') return handleRemove(interaction, userId, guildId);
  if (sub === 'list')   return handleList(interaction, userId, guildId);
}

// ── Log helper ────────────────────────────────────────────────────────────────

async function sendLog(interaction: ChatInputCommandInteraction, guildId: string, embed: EmbedBuilder): Promise<void> {
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
  userId: string,
  guildId: string,
): Promise<void> {
  const classInput = interaction.options.getString('klasse', true);
  const charName   = interaction.options.getString('name',   true);
  const server     = interaction.options.getString('server', true);
  const ilvl       = interaction.options.getInteger('ilvl',  true);

  const wowClass = WOW_CLASSES.find(c => c.name.toLowerCase() === classInput.toLowerCase());
  if (!wowClass) {
    await interaction.reply({ content: '❌ Ungültige Klasse — bitte aus der Autocomplete-Liste wählen.', ephemeral: true });
    return;
  }

  try {
    addCharacter(userId, guildId, charName, server, wowClass.name, ilvl);
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE constraint failed')) {
      await interaction.reply({ content: `❌ **${charName}-${server}** ist bereits eingetragen.`, ephemeral: true });
      return;
    }
    throw err;
  }

  const embed = new EmbedBuilder()
    .setColor(wowClass.color)
    .setTitle('✅ Char eingetragen')
    .addFields(
      { name: 'Spieler', value: `<@${userId}>`, inline: true },
      { name: 'Char',    value: `${charName}-${server}`, inline: true },
      { name: 'Klasse',  value: wowClass.name, inline: true },
      { name: 'ilvl',    value: String(ilvl), inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
  await sendLog(interaction, guildId, new EmbedBuilder()
    .setColor(wowClass.color)
    .setTitle('📥 Char eingetragen')
    .setDescription(`<@${userId}> hat einen Char hinzugefügt`)
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
  userId: string,
  guildId: string,
): Promise<void> {
  const idStr = interaction.options.getString('char', true);
  const charId = parseInt(idStr, 10);

  if (isNaN(charId)) {
    await interaction.reply({ content: '❌ Ungültige Auswahl — bitte aus der Autocomplete-Liste wählen.', ephemeral: true });
    return;
  }

  const existing = getCharacterById(charId);
  if (!existing || existing.user_id !== userId || existing.guild_id !== guildId) {
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

  const embed = new EmbedBuilder()
    .setColor(wowClass.color)
    .setTitle('✅ Char aktualisiert')
    .addFields(
      { name: 'Spieler', value: `<@${userId}>`, inline: true },
      { name: 'Char',    value: `${charName}-${server}`, inline: true },
      { name: 'Klasse',  value: className, inline: true },
      { name: 'ilvl',    value: String(ilvl), inline: true },
    )
    .setTimestamp();

  const logChanges: string[] = [];
  if (charName  !== existing.char_name)  logChanges.push(`Name: ${existing.char_name} -> ${charName}`);
  if (server    !== existing.server)     logChanges.push(`Server: ${existing.server} -> ${server}`);
  if (className !== existing.class_name) logChanges.push(`Klasse: ${existing.class_name} -> ${className}`);
  if (ilvl      !== existing.ilvl)       logChanges.push(`ilvl: ${existing.ilvl} -> ${ilvl}`);

  await interaction.reply({ embeds: [embed], ephemeral: true });
  await sendLog(interaction, guildId, new EmbedBuilder()
    .setColor(wowClass.color)
    .setTitle('✏️ Char aktualisiert')
    .setDescription(`<@${userId}> hat **${charName}-${server}** bearbeitet`)
    .addFields({ name: 'Änderungen', value: logChanges.length > 0 ? logChanges.join('\n') : '-' })
    .setTimestamp()
  );
}

async function handleRemove(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string,
): Promise<void> {
  const charId = parseInt(interaction.options.getString('char', true), 10);

  if (isNaN(charId)) {
    await interaction.reply({ content: '❌ Ungültige Auswahl.', ephemeral: true });
    return;
  }

  const existing = getCharacterById(charId);
  if (!existing || existing.user_id !== userId || existing.guild_id !== guildId) {
    await interaction.reply({ content: '❌ Char nicht gefunden.', ephemeral: true });
    return;
  }

  deleteCharacter(charId, userId, guildId);

  await interaction.reply({ content: `**${existing.char_name}-${existing.server}** wurde gelöscht.`, ephemeral: true });

  await sendLog(interaction, guildId, new EmbedBuilder()
    .setColor(0xff4444)
    .setTitle('🗑️ Char gelöscht')
    .setDescription(`<@${userId}> hat einen Char entfernt`)
    .addFields(
      { name: 'Char',   value: `${existing.char_name}-${existing.server}`, inline: true },
      { name: 'Klasse', value: existing.class_name, inline: true },
      { name: 'ilvl',   value: String(existing.ilvl), inline: true },
    )
    .setTimestamp()
  );
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  userId: string,
  guildId: string,
): Promise<void> {
  const chars = getUserCharacters(userId, guildId);

  if (chars.length === 0) {
    await interaction.reply({
      content: '📭 Du hast noch keine Chars eingetragen. Nutze `/char add` um zu starten.',
      ephemeral: true,
    });
    return;
  }

  const lines = chars.map(c => `**${c.char_name}-${c.server}** — ${c.class_name} — **${c.ilvl} ilvl**`);

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`📋 Deine Chars (${chars.length})`)
    .setDescription(lines.join('\n'))
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
