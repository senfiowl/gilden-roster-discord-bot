import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as charCommand    from './commands/char';
import * as rosterCommand  from './commands/roster';
import * as setupCommand   from './commands/setup';
import * as adminCommand   from './commands/admin';
import * as absenceCommand from './commands/absence';

dotenv.config();

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN und CLIENT_ID müssen in .env gesetzt sein!');
  process.exit(1);
}

const commands = [
  charCommand.data.toJSON(),
  rosterCommand.data.toJSON(),
  setupCommand.data.toJSON(),
  adminCommand.data.toJSON(),
  absenceCommand.data.toJSON(),
];

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`📤 Registriere ${commands.length} Slash Commands...`);

    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`✅ Commands für Guild ${GUILD_ID} registriert (sofort aktiv).`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('✅ Globale Commands registriert (bis zu 1h bis verfügbar).');
    }
  } catch (error) {
    console.error('❌ Fehler beim Registrieren:', error);
    process.exit(1);
  }
})();
