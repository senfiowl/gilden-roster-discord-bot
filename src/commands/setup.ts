import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { setPlayerChannel, getPlayerChannel, setLogChannel, getLogChannel, getAllPlayerChannels, setAbsenceChannel, getAbsenceChannel } from '../database/db';
import { isManagement } from '../utils/permissions';

function relevantRoleNames(): string[] {
  return [
    process.env.COUNCIL_ROLE_NAME    ?? 'Council',
    process.env.RAIDMEMBER_ROLE_NAME ?? 'Raidmember',
    process.env.TRIAL_ROLE_NAME      ?? 'Trial',
  ];
}

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Bot-Einstellungen (nur Admin/Council)')
  .addSubcommand(sub => sub
    .setName('player-channel')
    .setDescription('Verknüpfe einen Player-Channel mit einem Gilden-Mitglied')
    .addUserOption(opt => opt
      .setName('user')
      .setDescription('Das Gilden-Mitglied')
      .setRequired(true))
    .addChannelOption(opt => opt
      .setName('channel')
      .setDescription('Der persönliche Channel des Mitglieds')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('log-channel')
    .setDescription('Setze den Log-Channel für Roster-Änderungen')
    .addChannelOption(opt => opt
      .setName('channel')
      .setDescription('Channel in dem der Bot Änderungen loggt (nur Admin/Council sichtbar)')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('overview')
    .setDescription('Zeige Setup-Status aller Mitglieder mit Council/Raidmember/Trial Rolle'))
  .addSubcommand(sub => sub
    .setName('absence-channel')
    .setDescription('Setze den Channel für öffentliche Abwesenheits-Benachrichtigungen')
    .addChannelOption(opt => opt
      .setName('channel')
      .setDescription('In diesem Channel postet der Bot neue Abwesenheiten')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;

  if (!isManagement(member)) {
    await interaction.reply({ content: '❌ Nur Admin/Council können Setup-Commands ausführen.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'player-channel') {
    const targetUser = interaction.options.getUser('user', true);
    const channel    = interaction.options.getChannel('channel', true);
    const guildId    = interaction.guildId!;

    const previous = getPlayerChannel(targetUser.id, guildId);
    setPlayerChannel(targetUser.id, guildId, channel.id);

    const updateNote = previous ? ` (vorher: <#${previous.channel_id}>)` : '';

    await interaction.reply({
      content: `✅ Player-Channel für <@${targetUser.id}> gesetzt: <#${channel.id}>${updateNote}`,
      ephemeral: true,
    });
  }

  if (sub === 'log-channel') {
    const channel = interaction.options.getChannel('channel', true);
    const guildId = interaction.guildId!;

    const previous = getLogChannel(guildId);
    setLogChannel(guildId, channel.id);

    const updateNote = previous ? ` (vorher: <#${previous}>)` : '';

    await interaction.reply({
      content: `✅ Log-Channel gesetzt: <#${channel.id}>${updateNote}`,
      ephemeral: true,
    });
  }

  if (sub === 'overview') {
    await handleOverview(interaction);
  }

  if (sub === 'absence-channel') {
    const channel = interaction.options.getChannel('channel', true);
    const guildId = interaction.guildId!;

    const previous = getAbsenceChannel(guildId);
    setAbsenceChannel(guildId, channel.id);

    const updateNote = previous ? ` (vorher: <#${previous}>)` : '';

    await interaction.reply({
      content: `✅ Abwesenheits-Channel gesetzt: <#${channel.id}>${updateNote}`,
      ephemeral: true,
    });
  }
}

async function handleOverview(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId     = interaction.guildId!;
  const roleNames   = relevantRoleNames();
  const registrations = getAllPlayerChannels(guildId);
  const registeredMap = new Map(registrations.map(r => [r.user_id, r.channel_id]));

  // Fetch all guild members (requires GuildMembers intent)
  const allMembers = await interaction.guild!.members.fetch();

  const relevant = allMembers.filter(m =>
    !m.user.bot && m.roles.cache.some(r => roleNames.includes(r.name))
  );

  if (relevant.size === 0) {
    await interaction.editReply('Keine Mitglieder mit Council/Raidmember/Trial Rolle gefunden.');
    return;
  }

  const registered:   string[] = [];
  const unregistered: string[] = [];

  for (const [, m] of relevant) {
    const channelId = registeredMap.get(m.id);
    if (channelId) {
      registered.push(`<@${m.id}> → <#${channelId}>`);
    } else {
      unregistered.push(`<@${m.id}>`);
    }
  }

  // Sort alphabetically by display name
  registered.sort();
  unregistered.sort();

  const embed = new EmbedBuilder()
    .setColor(0xc69b3a)
    .setTitle('Setup-Übersicht — Player-Channels')
    .setDescription(`**${relevant.size}** Mitglieder · **${registered.length}** registriert · **${unregistered.length}** fehlen`)
    .setTimestamp();

  if (registered.length > 0) {
    // Discord field value limit is 1024 chars — split if needed
    const chunks = chunkLines(registered, 1024);
    chunks.forEach((chunk, i) => {
      embed.addFields({
        name: i === 0 ? `✅ Registriert (${registered.length})` : '​',
        value: chunk,
      });
    });
  }

  if (unregistered.length > 0) {
    const chunks = chunkLines(unregistered, 1024);
    chunks.forEach((chunk, i) => {
      embed.addFields({
        name: i === 0 ? `❌ Kein Player-Channel (${unregistered.length})` : '​',
        value: chunk,
      });
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

function chunkLines(lines: string[], maxLength: number): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
