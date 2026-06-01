import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import type { Character, PlayerChannel, Absence } from '../types/index';

const PROD_PATH = path.join(process.cwd(), 'data', 'roster.db');

let _db: DatabaseSync | undefined;

export function initDb(dbPath: string = PROD_PATH): void {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  _db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') _db.exec("PRAGMA journal_mode = WAL");
  _db.exec(`
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

  // Migration: add absence_channel_id if it doesn't exist yet
  try {
    _db.exec(`ALTER TABLE guild_settings ADD COLUMN absence_channel_id TEXT`);
  } catch {
    // Column already exists
  }

  _db.exec(`

    CREATE TABLE IF NOT EXISTS absences (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL,
      guild_id   TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date   TEXT NOT NULL,
      reason     TEXT
    );
  `);
}

function getDb(): DatabaseSync {
  if (!_db) initDb();
  return _db!;
}

// ── Characters ──────────────────────────────────────────────────────────────

export function addCharacter(
  userId: string, guildId: string,
  charName: string, server: string, className: string, ilvl: number,
) {
  return getDb().prepare(`
    INSERT INTO characters (user_id, guild_id, char_name, server, class_name, ilvl)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, guildId, charName, server, className, ilvl);
}

export function updateCharacter(
  id: number, charName: string, server: string, className: string, ilvl: number,
) {
  return getDb().prepare(`
    UPDATE characters
    SET char_name = ?, server = ?, class_name = ?, ilvl = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(charName, server, className, ilvl, id);
}

export function deleteCharacter(id: number, userId: string, guildId: string) {
  return getDb().prepare(`
    DELETE FROM characters WHERE id = ? AND user_id = ? AND guild_id = ?
  `).run(id, userId, guildId);
}

export function deleteAllCharactersForUser(userId: string, guildId: string) {
  return getDb().prepare(`DELETE FROM characters WHERE user_id = ? AND guild_id = ?`).run(userId, guildId);
}

export function getUserCharacters(userId: string, guildId: string): Character[] {
  return getDb().prepare(`
    SELECT * FROM characters WHERE user_id = ? AND guild_id = ? ORDER BY ilvl DESC
  `).all(userId, guildId) as unknown as Character[];
}

export function getAllCharacters(guildId: string): Character[] {
  return getDb().prepare(`
    SELECT * FROM characters WHERE guild_id = ? ORDER BY user_id, ilvl DESC
  `).all(guildId) as unknown as Character[];
}

export function getCharacterById(id: number): Character | undefined {
  return getDb().prepare(`SELECT * FROM characters WHERE id = ?`).get(id) as unknown as Character | undefined;
}

// ── Player Channels ──────────────────────────────────────────────────────────

export function setPlayerChannel(userId: string, guildId: string, channelId: string) {
  return getDb().prepare(`
    INSERT OR REPLACE INTO player_channels (user_id, guild_id, channel_id) VALUES (?, ?, ?)
  `).run(userId, guildId, channelId);
}

export function getPlayerChannel(userId: string, guildId: string): PlayerChannel | undefined {
  return getDb().prepare(`
    SELECT * FROM player_channels WHERE user_id = ? AND guild_id = ?
  `).get(userId, guildId) as unknown as PlayerChannel | undefined;
}

export function getAllPlayerChannels(guildId: string): PlayerChannel[] {
  return getDb().prepare(`SELECT * FROM player_channels WHERE guild_id = ?`).all(guildId) as unknown as PlayerChannel[];
}

// ── Guild Settings ────────────────────────────────────────────────────────────

export function setLogChannel(guildId: string, channelId: string) {
  return getDb().prepare(`
    INSERT INTO guild_settings (guild_id, log_channel_id) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET log_channel_id = excluded.log_channel_id
  `).run(guildId, channelId);
}

export function getLogChannel(guildId: string): string | undefined {
  const row = getDb().prepare(`SELECT log_channel_id FROM guild_settings WHERE guild_id = ?`).get(guildId) as
    | { log_channel_id: string }
    | undefined;
  return row?.log_channel_id;
}

export function setAbsenceChannel(guildId: string, channelId: string) {
  return getDb().prepare(`
    INSERT INTO guild_settings (guild_id, absence_channel_id) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET absence_channel_id = excluded.absence_channel_id
  `).run(guildId, channelId);
}

export function getAbsenceChannel(guildId: string): string | undefined {
  const row = getDb().prepare(`SELECT absence_channel_id FROM guild_settings WHERE guild_id = ?`).get(guildId) as
    | { absence_channel_id: string }
    | undefined;
  return row?.absence_channel_id;
}

// ── Absences ──────────────────────────────────────────────────────────────────

export function addAbsence(
  userId: string, guildId: string,
  startDate: string, endDate: string, reason: string | null,
) {
  return getDb().prepare(`
    INSERT INTO absences (user_id, guild_id, start_date, end_date, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, guildId, startDate, endDate, reason);
}

export function getUserAbsences(userId: string, guildId: string): Absence[] {
  return getDb().prepare(`
    SELECT * FROM absences WHERE user_id = ? AND guild_id = ? ORDER BY start_date ASC
  `).all(userId, guildId) as unknown as Absence[];
}

export function getAbsencesForWeek(guildId: string, weekStart: string, weekEnd: string): Absence[] {
  return getDb().prepare(`
    SELECT * FROM absences
    WHERE guild_id = ? AND start_date <= ? AND end_date >= ?
    ORDER BY start_date ASC
  `).all(guildId, weekEnd, weekStart) as unknown as Absence[];
}

export function getUpcomingAbsences(guildId: string): Absence[] {
  const today = new Date().toISOString().slice(0, 10);
  return getDb().prepare(`
    SELECT * FROM absences WHERE guild_id = ? AND end_date >= ? ORDER BY start_date ASC
  `).all(guildId, today) as unknown as Absence[];
}

export function getAbsenceById(id: number): Absence | undefined {
  return getDb().prepare(`SELECT * FROM absences WHERE id = ?`).get(id) as unknown as Absence | undefined;
}

export function deleteAbsence(id: number, userId: string, guildId: string) {
  return getDb().prepare(`
    DELETE FROM absences WHERE id = ? AND user_id = ? AND guild_id = ?
  `).run(id, userId, guildId);
}

export function deleteAbsenceAdmin(id: number, guildId: string) {
  return getDb().prepare(`DELETE FROM absences WHERE id = ? AND guild_id = ?`).run(id, guildId);
}
