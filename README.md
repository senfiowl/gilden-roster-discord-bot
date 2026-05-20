# Roster Bot

Discord Bot zur Verwaltung des WoW-Gilden-Rosters.

---

## Voraussetzungen

- [Node.js](https://nodejs.org/) v22 oder höher
- Ein Discord Bot (erstellt im [Discord Developer Portal](https://discord.com/developers/applications))

---

## Installation

```bash
npm install
```

`.env` Datei anlegen (Kopie von `.env.example`):

```
DISCORD_TOKEN=dein_bot_token
CLIENT_ID=deine_client_id
GUILD_ID=deine_guild_id

ADMIN_ROLE_NAME=Admin
COUNCIL_ROLE_NAME=Council
RAIDMEMBER_ROLE_NAME=Raidmember
TRIAL_ROLE_NAME=Trial
```

---

## Bot starten

```bash
# Slash Commands bei Discord registrieren (einmalig, oder nach Änderungen)
npm run deploy

# Bot starten
npm start

# Oder direkt ohne Build (für Entwicklung)
npm run dev
```

---

## Privileged Gateway Intents

Im [Discord Developer Portal](https://discord.com/developers/applications) unter **Bot → Privileged Gateway Intents** muss aktiviert sein:

- **Server Members Intent** — wird für `/setup overview` benötigt

---

## Ersteinrichtung in Discord

Nach dem ersten Start müssen einmalig folgende Commands ausgeführt werden:

**1. Log-Channel festlegen** (Channel in dem der Bot Änderungen protokolliert):
```
/setup log-channel channel:#log-channel
```

**2. Player-Channel für jeden Raider/Trial registrieren:**
```
/setup player-channel user:@Spieler channel:#spieler-channel
```
Dieser Schritt muss für jeden Raider und Trial wiederholt werden. Mit `/setup overview` lässt sich jederzeit prüfen, wer noch keinen registrierten Channel hat.

**3. Spieler zur Char-Eintragung auffordern:**
```
/admin announce
```
Öffnet ein Popup mit vorausgefülltem Text, der vor dem Senden bearbeitet werden kann. Sendet die Nachricht dann an alle registrierten Player-Channels.

---

## Commands

### Raidmember & Trial

Alle Commands nur im eigenen Player-Channel verfügbar.

| Command | Beschreibung |
|---|---|
| `/char add` | Neuen Char eintragen (Klasse, Name, Server, ilvl) |
| `/char edit` | Bestehenden Char bearbeiten |
| `/char remove` | Char löschen |
| `/char list` | Eigene Chars anzeigen |

### Admin & Council

| Command | Beschreibung |
|---|---|
| `/roster view` | Alle Chars aller Spieler anzeigen |
| `/roster view klasse:Warrior` | Roster nach Klasse filtern |
| `/admin char-add` | Char für einen Spieler eintragen |
| `/admin char-edit` | Char eines Spielers bearbeiten |
| `/admin char-remove` | Char eines Spielers löschen |
| `/admin remove-player` | Alle Chars eines Spielers löschen (z.B. bei Gildenaustritt) |
| `/admin announce` | Editable Modal öffnet sich — Text anpassen und an alle Player-Channels senden |
| `/admin export` | Roster in Google Sheets exportieren |
| `/setup player-channel` | Player-Channel mit Spieler verknüpfen |
| `/setup log-channel` | Log-Channel festlegen |
| `/setup overview` | Setup-Status aller Council/Raidmember/Trial anzeigen |

---

## Benachrichtigungen

| Aktion | Player-Channel | Log-Channel |
|---|---|---|
| Spieler trägt Char ein | Öffentliche Bestätigung | Eintrag mit Spieler, Char, Klasse, ilvl |
| Spieler bearbeitet Char | Öffentliche Bestätigung | Eintrag mit Änderungen |
| Spieler löscht Char | Öffentliche Bestätigung | Eintrag |
| Admin trägt Char ein | Benachrichtigung an Spieler | Eintrag mit Admin-Vermerk |
| Admin bearbeitet Char | Benachrichtigung an Spieler | Eintrag mit Admin-Vermerk |
| Admin löscht Char | Benachrichtigung an Spieler | Eintrag mit Admin-Vermerk |
| Admin entfernt Spieler | Benachrichtigung an Spieler | Eintrag mit Admin-Vermerk |

---

## Rollen

Die Rollennamen in `.env` müssen exakt mit den Rollennamen in Discord übereinstimmen (Groß-/Kleinschreibung beachten).

| Rolle | Zugriff |
|---|---|
| Admin, Council | Alle Commands |
| Raidmember, Trial | `/char`-Commands im eigenen Player-Channel |

---

## Google Sheets Export (optional)

Mit `/admin export` wird der aktuelle Roster in ein Google Sheet geschrieben. Einmalige Einrichtung:

### 1. Google Cloud Service Account anlegen

1. [Google Cloud Console](https://console.cloud.google.com/) öffnen → neues Projekt anlegen (oder bestehendes wählen)
2. **APIs & Dienste → Bibliothek** → „Google Sheets API" suchen und aktivieren
3. **APIs & Dienste → Anmeldedaten** → „Anmeldedaten erstellen" → „Dienstkonto"
4. Dienstkonto einen Namen geben → erstellen
5. Auf das erstellte Dienstkonto klicken → **Schlüssel** → „Schlüssel hinzufügen" → JSON → Datei wird heruntergeladen

### 2. Sheet freigeben

Das Google Sheet mit der **E-Mail-Adresse des Dienstkontos** teilen (mit Bearbeitungsrechten).  
Die E-Mail steht in der heruntergeladenen JSON-Datei unter `client_email`, z.B. `roster-bot@mein-projekt.iam.gserviceaccount.com`.

### 3. .env konfigurieren

```
# Pfad zur JSON-Datei (relativ zum Projektverzeichnis)
GOOGLE_SERVICE_ACCOUNT_PATH=service-account-key.json

# Sheet-ID aus der URL: https://docs.google.com/spreadsheets/d/<ID>/edit
GOOGLE_SHEET_ID=deine_sheet_id

# Optional: Name des Tab im Sheet (Standard: erster Tab)
# GOOGLE_SHEET_TAB=Roster
```

> Alternativ zu `GOOGLE_SERVICE_ACCOUNT_PATH` kann der JSON-Inhalt direkt als String in `GOOGLE_SERVICE_ACCOUNT_JSON` gesetzt werden — praktisch für Server-Deployments ohne Dateiablage.

---

## Datenbank

Die SQLite-Datenbank wird automatisch beim ersten Start unter `data/roster.db` angelegt. Keine manuelle Einrichtung nötig.
