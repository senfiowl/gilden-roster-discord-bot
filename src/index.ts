import { Client, Collection, Events, GatewayIntentBits, Interaction } from 'discord.js';
import * as dotenv from 'dotenv';
import * as charCommand    from './commands/char';
import * as rosterCommand  from './commands/roster';
import * as setupCommand   from './commands/setup';
import * as adminCommand   from './commands/admin';
import * as absenceCommand from './commands/absence';

dotenv.config();

interface BotCommand {
  data: { name: string; toJSON(): unknown };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

// Needed for the interface above
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

const commands = new Collection<string, BotCommand>();
commands.set('char',    charCommand);
commands.set('roster',  rosterCommand);
commands.set('setup',   setupCommand);
commands.set('admin',   adminCommand);
commands.set('absence', absenceCommand);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, ready => {
  console.log(`✅ Bot eingeloggt als ${ready.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      const sub = interaction.options.getSubcommand(false);
      const label = sub ? `/${interaction.commandName} ${sub}` : `/${interaction.commandName}`;
      console.log(`[CMD] ${interaction.user.username} (${interaction.user.id}) ${label}`);
      await command.execute(interaction);
    } catch (error) {
      console.error(`Fehler bei /${interaction.commandName}:`, error);
      const msg = { content: '❌ Es ist ein interner Fehler aufgetreten.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg).catch(() => null);
      } else {
        await interaction.reply(msg).catch(() => null);
      }
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`Fehler bei Autocomplete /${interaction.commandName}:`, error);
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    const handler =
      interaction.customId === 'announce_modal'     ? () => adminCommand.handleAnnounceSubmit(interaction, interaction.guildId!)  :
      interaction.customId === 'absence_add_modal'  ? () => absenceCommand.handleAbsenceAddSubmit(interaction, interaction.guildId!) :
      null;

    if (handler && interaction.guildId) {
      try {
        console.log(`[MODAL] ${interaction.user.username} (${interaction.user.id}) ${interaction.customId}`);
        await handler();
      } catch (error) {
        console.error(`Fehler bei Modal ${interaction.customId}:`, error);
        const msg = { content: '❌ Es ist ein interner Fehler aufgetreten.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => null);
        } else {
          await interaction.reply(msg).catch(() => null);
        }
      }
    }
  }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ DISCORD_TOKEN fehlt in .env!');
  process.exit(1);
}

client.login(token);
