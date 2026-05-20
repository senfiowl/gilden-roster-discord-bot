import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import { WOW_CLASSES } from '../types/index';
import { getAllCharacters } from '../database/db';
import { isManagement } from '../utils/permissions';
import type { Character } from '../types/index';

export const data = new SlashCommandBuilder()
  .setName('roster')
  .setDescription('Roster-Übersicht (nur Admin/Council)')
  .addSubcommand(sub => sub
    .setName('view')
    .setDescription('Zeige alle eingetragenen Chars')
    .addStringOption(opt => opt
      .setName('klasse')
      .setDescription('Filter nach Klasse (optional)')
      .setAutocomplete(true)));

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const value = interaction.options.getFocused();
  const matches = WOW_CLASSES.filter(c => c.name.toLowerCase().includes(value.toLowerCase()));
  await interaction.respond(matches.map(c => ({ name: c.name, value: c.name })));
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;

  if (!isManagement(member)) {
    await interaction.reply({ content: '❌ Nur Admin/Council können den Roster einsehen.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const guildId     = interaction.guildId!;
  const classFilter = interaction.options.getString('klasse');

  let chars = getAllCharacters(guildId);

  if (classFilter) {
    chars = chars.filter(c => c.class_name.toLowerCase() === classFilter.toLowerCase());
  }

  if (chars.length === 0) {
    const msg = classFilter
      ? `📭 Keine **${classFilter}**-Chars im Roster.`
      : '📭 Noch keine Chars eingetragen.';
    await interaction.editReply(msg);
    return;
  }

  const byUser = new Map<string, Character[]>();
  for (const char of chars) {
    if (!byUser.has(char.user_id)) byUser.set(char.user_id, []);
    byUser.get(char.user_id)!.push(char);
  }

  const title = classFilter ? `📋 Roster — ${classFilter}` : '📋 Gilden-Roster';

  const embed = new EmbedBuilder()
    .setColor(0xc69b3a)
    .setTitle(title)
    .setDescription(`**${chars.length}** Chars von **${byUser.size}** Spielern`)
    .setTimestamp();

  let fieldCount = 0;
  for (const [userId, userChars] of byUser) {
    if (fieldCount >= 25) break;

    const lines = userChars.map(c =>
      `${c.char_name}-${c.server} — ${c.class_name} — **${c.ilvl}** ilvl`
    );

    embed.addFields({
      name:  `<@${userId}> (${userChars.length} ${userChars.length === 1 ? 'Char' : 'Chars'})`,
      value: lines.join('\n'),
    });
    fieldCount++;
  }

  const reply =
    byUser.size > 25
      ? { content: `⚠️ Nur die ersten 25 von ${byUser.size} Spielern werden angezeigt.`, embeds: [embed] }
      : { embeds: [embed] };

  await interaction.editReply(reply);
}
