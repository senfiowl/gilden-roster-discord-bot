# CLAUDE.md — Roster Bot

Discord-Bot zur Verwaltung eines WoW-Gilden-Rosters. Geschrieben in TypeScript mit discord.js v14 und SQLite.

---

## Stack

- **Runtime:** Node.js v22+ (v24.13.1 im Einsatz)
- **Language:** TypeScript (`"module": "commonjs"`)
- **Discord:** discord.js v14, Slash Commands, Autocomplete, Modals
- **Datenbank:** `node:sqlite` (Node.js built-in, experimentell ab v22.5) — kein Build-Tool nötig
- **Tests:** Vitest v2
- **Sheets:** googleapis (Google Sheets API v4)

---

## Projektstruktur

```
src/
  commands/
    char.ts        — /char add|edit|remove|list  (Raidmember/Trial)
    roster.ts      — /roster view [klasse]        (Admin/Council)
    admin.ts       — /admin char-add|char-edit|char-remove|remove-player|announce|export
    setup.ts       — /setup player-channel|log-channel|overview
  database/
    db.ts          — SQLite-Wrapper, alle CRUD-Funktionen
    db.test.ts     — Vitest-Tests für alle DB-Funktionen
  sheets/
    sheets.ts      — Google Sheets Export-Modul (kein Discord-Import)
  utils/
    permissions.ts       — isManagement / isMember / hasAnyGuildRole
    permissions.test.ts  — Vitest-Tests
  types/
    index.ts       — Character, PlayerChannel, WowClass, WOW_CLASSES
  index.ts         — Bot-Einstiegspunkt (Client, Interaction-Router)
  deploy-commands.ts — Registriert Slash Commands bei Discord
```

---

## Rollen & Berechtigungen

| Rolle | Zugriff |
|---|---|
| Admin, Council | Alle Commands |
| Raidmember, Trial | `/char`-Commands (überall, ephemeral) |

Rollennamen werden aus `.env` gelesen (`ADMIN_ROLE_NAME` etc.) und default auf `Admin`, `Council`, `Raidmember`, `Trial`.

---

## Datenmodell

- **characters** — `id, user_id, guild_id, char_name, server, class_name, ilvl` — UNIQUE auf `(guild_id, char_name, server)`
- **player_channels** — `user_id, guild_id, channel_id` — verknüpft Discord-User mit ihrem Player-Channel
- **guild_settings** — `guild_id, log_channel_id`

---

## Wichtige Designentscheidungen

### node:sqlite statt better-sqlite3
`better-sqlite3` benötigt native Kompilierung (node-gyp, Visual Studio Build Tools). Auf Windows ohne Build-Tools nicht installierbar. `node:sqlite` ist ein Node.js 22+ Built-in und braucht keinen Compiler.

### Ephemeral replies bei /char
`/char add`, `/char edit`, `/char remove` antworten ephemeral (nur für den ausführenden Spieler sichtbar). Der öffentliche Player-Channel bleibt sauber. Logs gehen in den Log-Channel. `/admin`-Commands antworten weiterhin ephemeral an den Admin, senden aber zusätzlich in Player-Channel + Log-Channel.

### Player-Channel-Restriktion entfernt
Ursprünglich konnten `/char`-Commands nur im eigenen Player-Channel ausgeführt werden. Da Replies ephemeral sind, ist die Restriktion nicht mehr nötig — `user_id`/`guild_id` kommen aus der Interaction, nicht aus dem Channel.

### /admin announce als Modal
Statt sofortigem Senden öffnet `/admin announce` ein Modal mit vorausgefülltem Text, der vor dem Absenden bearbeitet werden kann. `handleAnnounceSubmit` ist aus `admin.ts` exportiert, damit `index.ts` den `ModalSubmitInteraction`-Event routen kann.

### Vitest + node:sqlite
Vite kennt `node:sqlite` nicht als Node.js-Built-in und versucht es als npm-Paket aufzulösen. Lösung: Plugin in `vitest.config.ts` das `node:sqlite`-Imports auf ein virtuelles CJS-Modul (`module.exports = require('node:sqlite')`) umleitet.

### Google Sheets Export (sheets.ts)
`exportRosterToSheets()` hat **keine Discord-Abhängigkeiten** — nimmt nur `PlayerExportRow[]` entgegen. Dadurch kann die Funktion später problemlos für automatischen Sync bei Char-Änderungen aufgerufen werden, ohne den Command-Handler zu involvieren.

---

## Google Sheets Setup

Auth via Service Account. Zwei Optionen in `.env`:
- `GOOGLE_SERVICE_ACCOUNT_PATH=pfad/zur/key.json` — Dateipfad (relativ zum Projektverzeichnis)
- `GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}` — JSON als String (für Server-Deployment)

Sheet-ID aus der URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`

Service-Account-E-Mail muss als Bearbeiter im Sheet eingetragen sein.

---

## Workflow

```bash
npm run dev      # Bot starten (ts-node, kein Build nötig)
npm run deploy   # Slash Commands bei Discord registrieren (kann bei laufendem Bot ausgeführt werden)
npm run build    # TypeScript kompilieren → dist/
npm start        # Kompilierten Bot starten (für Produktion)
npm test         # Vitest run
npm run test:watch
```

---

## Offene Punkte (todo.md)

- Rollen-Tests (Raidmember-only, Trial-only, Council)
- Verhalten wenn kein Player-Channel registriert ist
- `/roster view` Pagination (aktuell max. 25 Spieler)
- Deployment auf Hetzner VPS mit PM2
- Automatischer Sheets-Sync bei Char-Änderungen (Grundlage ist gelegt)

---

## Bekannte Eigenheiten

- Node.js zeigt beim Start: `ExperimentalWarning: SQLite is an experimental feature` — kann ignoriert werden
- Git zeigt CRLF-Warnings auf Windows — harmlos, `.gitattributes` wäre die saubere Lösung
- `npm run deploy` registriert Commands guild-spezifisch wenn `GUILD_ID` gesetzt ist (sofort aktiv), sonst global (bis zu 1h Wartezeit)


# Before every Task

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.