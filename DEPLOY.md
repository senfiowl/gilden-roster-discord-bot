# Deployment auf Railway

---

## Voraussetzungen

- GitHub-Repository mit dem Bot-Code (bereits vorhanden)
- [Railway-Account](https://railway.app) (GitHub-Login empfohlen)

---

## 1. Neues Projekt anlegen

1. Railway öffnen → **New Project**
2. **Deploy from GitHub repo** wählen
3. Das Repository `gilden-roster-discord-bot` auswählen
4. Railway erkennt automatisch `npm run build` und `npm start` aus der `package.json` — nichts weiter konfigurieren

---

## 2. Volume anlegen (SQLite-Datenbank)

Railway hat ein flüchtiges Filesystem — ohne Volume geht die Datenbank bei jedem Deploy verloren.

1. Im Projekt auf den Service klicken → **Volumes** → **Add Volume**
2. Einstellungen:
   - **Mount Path:** `/app/data`
3. Speichern

Die SQLite-Datei liegt unter `data/roster.db` relativ zum Arbeitsverzeichnis — das Volume stellt sicher, dass sie Deployments überlebt.

---

## 3. Umgebungsvariablen setzen

Im Service → **Variables** → jeweils **New Variable**:

| Variable | Wert | Pflicht |
|---|---|---|
| `DISCORD_TOKEN` | Bot Token aus dem Developer Portal | ✅ |
| `CLIENT_ID` | Application ID aus dem Developer Portal | ✅ |
| `GUILD_ID` | Discord Server ID | ✅ |
| `ADMIN_ROLE_NAME` | z.B. `Admin` | ✅ |
| `COUNCIL_ROLE_NAME` | z.B. `Council` | ✅ |
| `RAIDMEMBER_ROLE_NAME` | z.B. `Raidmember` | ✅ |
| `TRIAL_ROLE_NAME` | z.B. `Trial` | ✅ |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Den kompletten Inhalt der JSON-Datei als String | optional |
| `GOOGLE_SHEET_ID` | Sheet-ID aus der URL | optional |

> **Wichtig für Google Sheets:** Auf Railway keine Datei hochladen — stattdessen `GOOGLE_SERVICE_ACCOUNT_JSON` mit dem kompletten JSON-Inhalt als einzeiligem String befüllen (den Inhalt der `service-account-key.json` in eine Zeile kopieren).

### Discord IDs herausfinden

- **Bot Token & Client ID:** [Discord Developer Portal](https://discord.com/developers/applications) → Deine App → Bot (Token) bzw. General Information (Application ID)
- **Guild ID (Server ID):** Discord → Rechtsklick auf deinen Server → „Server-ID kopieren" (Entwicklermodus muss aktiv sein: Einstellungen → Erweitert → Entwicklermodus)

---

## 4. Ersten Deploy abwarten

Railway baut und startet den Bot automatisch nach dem ersten Push. Im Tab **Deployments** kannst du den Build-Log verfolgen. Der Bot ist bereit wenn im Log steht:

```
✅ Bot eingeloggt als GuildBot#1234
```

---

## 5. Slash Commands registrieren

Die Slash Commands müssen einmalig bei Discord registriert werden. Das geht am einfachsten **lokal** mit den Produktions-Variablen:

```bash
# .env kurz auf die echten Werte setzen, dann:
npm run deploy
```

Alternativ im Railway-Dashboard: Service → **Settings** → **One-off commands** → `npm run deploy` ausführen lassen.

> Nach diesem Schritt sollten die Commands innerhalb weniger Sekunden in Discord erscheinen (da `GUILD_ID` gesetzt ist).

---

## Updates einspielen

Ein `git push` auf `main` reicht — Railway deployt automatisch.

```bash
git push
```

---

## Troubleshooting

| Problem | Lösung |
|---|---|
| Bot startet nicht | Logs prüfen: Railway → Deployments → aktueller Deploy → View Logs |
| Datenbank leer nach Deploy | Volume korrekt auf `/app/data` gemountet? |
| Commands erscheinen nicht | `npm run deploy` nochmal ausführen; `GUILD_ID` gesetzt? |
| Google Sheets schlägt fehl | `GOOGLE_SERVICE_ACCOUNT_JSON` als einzeiligen String? Service-Account als Bearbeiter im Sheet eingetragen? |
