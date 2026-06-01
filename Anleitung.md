# Guild Bot — Anleitung

---

# Für Raidmember & Trial

> Alle Commands funktionieren **überall auf dem Server** — Antworten sind nur für dich sichtbar (ephemeral).

---

## Char eintragen — `/char add`

Mit `/char add` trägst du einen neuen Char ein.

**Pflichtfelder:**
- `klasse` — Wähle deine Klasse aus der Autocomplete-Liste
- `name` — Nur der Char-Name, ohne Server (z.B. `Arthas`)
- `server` — Dein Realm (z.B. `Blackhand`)
- `ilvl` — Dein aktuelles Item Level (z.B. `639`)

Du kannst mehrere Chars eintragen — einen pro `/char add` Aufruf.

---

## Char bearbeiten — `/char edit`

Wähle deinen Char aus der Autocomplete-Liste und fülle nur die Felder aus, die du ändern möchtest — der Rest bleibt unverändert.

Beispiel (nur ilvl aktualisieren):
```
/char edit char:Arthas-Blackhand ilvl:645
```

---

## Char löschen — `/char remove`

Wähle den Char aus der Autocomplete-Liste.

---

## Deine Chars anzeigen — `/char list`

Zeigt alle deine eingetragenen Chars auf einen Blick.

---

## Abwesenheit eintragen — `/absence add`

Öffnet ein Formular mit drei Feldern:

- **Von** — Startdatum im Format `TT.MM.JJJJ` (z.B. `15.06.2026`)
- **Bis** — Enddatum im Format `TT.MM.JJJJ` — **leer lassen, wenn du nur einen Tag abwesend bist**
- **Grund** — Optional (z.B. `Urlaub`, `Arzttermin`)

Nach dem Eintragen erscheint automatisch eine Meldung im Abwesenheits-Channel.

---

## Abwesenheiten der nächsten 7 Tage — `/absence list`

Zeigt alle Gildenmitglieder, die in den nächsten 7 Tagen abwesend sind. Nützlich vor Raids um schnell zu sehen, wer nicht da ist.

---

## Meine Abwesenheiten — `/absence mine`

Zeigt alle deine eigenen eingetragenen Abwesenheiten — auch zukünftige.

---

## Abwesenheit löschen — `/absence remove`

Wähle die Abwesenheit aus der Autocomplete-Liste.

---

## Tipps

- Bei allen Auswahlfeldern erscheint automatisch eine **Autocomplete-Liste** — einfach draufklicken statt manuell eintippen
- Trag **alle spielbaren Chars** ein, nicht nur deinen Main
- Halte dein **ilvl aktuell** — besonders nach neuen Patches oder Raids
- Plane Urlaub **weit im Voraus** ein — der Bot vergisst es nicht

---
---

# Für Admin & Council

---

## Roster anzeigen — `/roster view`

Zeigt alle eingetragenen Chars der gesamten Gilde, gruppiert nach Spieler.

Optional nach Klasse filtern:
```
/roster view klasse:Warrior
```

---

## Ankündigung senden — `/admin announce`

Öffnet ein Modal mit vorausgefülltem Text. Text nach Bedarf anpassen, dann Absenden — der Bot schickt die Nachricht an alle registrierten Player-Channels.

---

## Roster exportieren — `/admin export`

Schreibt den aktuellen Roster in das konfigurierte Google Sheet. Der Bot bestätigt, wie viele Spieler exportiert wurden.

---

## Abwesenheiten verwalten

### Alle bevorstehenden Abwesenheiten anzeigen
```
/admin absence-list
```

### Abwesenheiten eines bestimmten Spielers anzeigen
```
/admin absence-list user:@Spieler
```

### Abwesenheit löschen (z.B. Fehleintrag)
```
/admin absence-remove
```
Wähle die Abwesenheit aus der Autocomplete-Liste — zeigt Name, Zeitraum und Grund.

---

## Chars verwalten

### Char für einen Spieler eintragen
```
/admin char-add user:@Spieler klasse:Warrior name:Arthas server:Blackhand ilvl:639
```
Der Spieler erhält eine Benachrichtigung in seinem Player-Channel.

### Char eines Spielers bearbeiten
```
/admin char-edit user:@Spieler char:Arthas-Blackhand ilvl:645
```

### Char eines Spielers löschen
```
/admin char-remove user:@Spieler char:Arthas-Blackhand
```

### Alle Chars eines Spielers löschen (bei Gildenaustritt)
```
/admin remove-player user:@Spieler
```

---

## Setup

### Player-Channel registrieren
```
/setup player-channel user:@Spieler channel:#spieler-channel
```
Muss für jeden Raider und Trial einmalig durchgeführt werden.

### Log-Channel festlegen
```
/setup log-channel channel:#log-channel
```
Hier protokolliert der Bot alle Char-Änderungen (nur für Admins sichtbar).

### Abwesenheits-Channel festlegen
```
/setup absence-channel channel:#abwesenheiten
```
In diesem Channel postet der Bot automatisch, wenn jemand eine Abwesenheit einträgt.

### Setup-Übersicht
```
/setup overview
```
Zeigt, welche Mitglieder mit Council/Raidmember/Trial Rolle noch keinen registrierten Player-Channel haben.
