import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import type { Character, PlayerChannel } from '../types/index';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(path.join(DATA_DIR, 'roster.db'));

db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS characters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    char_name  TEXT    NOT NULL,
    server     TEXT    NOT NULL,
    class_name TEXT    NOT NULL,
    ilvl       INTEGER NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, char_name, server)
  );

  CREATE TABLE IF NOT EXISTS player_channels (
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id        TEXT PRIMARY KEY,
    log_channel_id  TEXT
  );
`);

// ── Characters ──────────────────────────────────────────────────────────────

export function addCharacter(
  userId: string, guildId: string,
  charName: string, server: string, className: string, ilvl: number,
) {
  return db.prepare(`
    INSERT INTO characters (user_id, guild_id, char_name, server, class_name, ilvl)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, guildId, charName, server, className, ilvl);
}

export function updateCharacter(
  id: number, charName: string, server: string, className: string, ilvl: number,
) {
  return db.prepare(`
    UPDATE characters
    SET char_name = ?, server = ?, class_name = ?, ilvl = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(charName, server, className, ilvl, id);
}

export function deleteCharacter(id: number, userId: string, guildId: string) {
  return db.prepare(`
    DELETE FROM characters WHERE id = ? AND user_id = ? AND guild_id = ?
  `).run(id, userId, guildId);
}

export function deleteAllCharactersForUser(userId: string, guildId: string) {
  return db.prepare(`DELETE FROM characters WHERE user_id = ? AND guild_id = ?`).run(userId, guildId);
}

export function getUserCharacters(userId: string, guildId: string): Character[] {
  return db.prepare(`
    SELECT * FROM characters WHERE user_id = ? AND guild_id = ? ORDER BY ilvl DESC
  `).all(userId, guildId) as unknown as Character[];
}

export function getAllCharacters(guildId: string): Character[] {
  return db.prepare(`
    SELECT * FROM characters WHERE guild_id = ? ORDER BY user_id, ilvl DESC
  `).all(guildId) as unknown as Character[];
}

export function getCharacterById(id: number): Character | undefined {
  return db.prepare(`SELECT * FROM characters WHERE id = ?`).get(id) as unknown as Character | undefined;
}

// ── Player Channels ──────────────────────────────────────────────────────────

export function setPlayerChannel(userId: string, guildId: string, channelId: string) {
  return db.prepare(`
    INSERT OR REPLACE INTO player_channels (user_id, guild_id, channel_id) VALUES (?, ?, ?)
  `).run(userId, guildId, channelId);
}

export function getPlayerChannel(userId: string, guildId: string): PlayerChannel | undefined {
  return db.prepare(`
    SELECT * FROM player_channels WHERE user_id = ? AND guild_id = ?
  `).get(userId, guildId) as unknown as PlayerChannel | undefined;
}

export function getAllPlayerChannels(guildId: string): PlayerChannel[] {
  return db.prepare(`SELECT * FROM player_channels WHERE guild_id = ?`).all(guildId) as unknown as PlayerChannel[];
}

// ── Guild Settings ────────────────────────────────────────────────────────────

export function setLogChannel(guildId: string, channelId: string) {
  return db.prepare(`
    INSERT INTO guild_settings (guild_id, log_channel_id) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET log_channel_id = excluded.log_channel_id
  `).run(guildId, channelId);
}

export function getLogChannel(guildId: string): string | undefined {
  const row = db.prepare(`SELECT log_channel_id FROM guild_settings WHERE guild_id = ?`).get(guildId) as
    | { log_channel_id: string }
    | undefined;
  return row?.log_channel_id;
}
