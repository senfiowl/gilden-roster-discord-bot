# Todo

## Testen

- [X] Mit Raidmember-only Rolle testen (Berechtigungen, Player-Channel Einschränkung)
- [X] Mit Trial-only Rolle testen
- [X] Council-Rolle testen (Admin-Commands verfügbar?)
- [X] Log-Channel Benachrichtigungen prüfen (add / edit / remove)
- [X] Player-Channel Benachrichtigung bei Admin-Commands prüfen
- [X] Autocomplete bei `/char edit` und `/char remove` testen
- [X] `/setup overview` mit mehreren Mitgliedern testen
- [X] Verhalten testen wenn kein Player-Channel registriert ist

## Features

- [X] `/admin remove-player` — alle Chars eines Spielers auf einmal löschen (z.B. bei Gildenaustritt)
- [ ] Google Sheets Export (optional, war früh erwähnt)
- [ ] Optional auto-sync feature für google sheets
- [ ] Abmeldungen - inkl. Möglichkeit die Abmeldungen für bestimmte Tage zu sehen

## Bekannte Einschränkungen

- [ ] `/roster view` zeigt maximal 25 Spieler — Pagination für größere Gilden einbauen
- [ ] Node.js zeigt beim Start eine Warnung: `SQLite is an experimental feature` — kann ignoriert werden, verschwindet in einer zukünftigen Node-Version

## Deployment

- [ ] Bot auf einem Server deployen (Hetzner VPS o.ä.) für dauerhaften Betrieb
- [ ] PM2 einrichten für automatischen Neustart
