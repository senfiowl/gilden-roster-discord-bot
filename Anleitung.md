# Roster Bot — Anleitung

Mit dem Roster Bot kannst du deine WoW-Chars direkt in Discord verwalten. So haben wir immer einen aktuellen Überblick über alle verfügbaren Chars der Gilde.

---

# Für Raidmember & Trial

> Alle Commands funktionieren **nur in deinem eigenen Player-Channel**.

---

## Char eintragen

Mit `/char add` trägst du einen neuen Char ein.

**Pflichtfelder:**
- `klasse` — Wähle deine Klasse aus der Liste
- `name` — Nur der Char-Name, ohne Server (z.B. `Arthas`)
- `server` — Dein Realm (z.B. `Blackhand`)
- `ilvl` — Dein aktuelles Item Level (z.B. `639`)

**Beispiel:**
```
/char add klasse:Warrior name:Arthas server:Blackhand ilvl:639
```

Du kannst mehrere Chars eintragen — einen pro `/char add` Aufruf.

---

## Char bearbeiten

Mit `/char edit` kannst du einen bestehenden Char aktualisieren, z.B. wenn sich dein ilvl verändert hat.

- Wähle deinen Char aus der Autocomplete-Liste
- Fülle nur die Felder aus, die du ändern möchtest — der Rest bleibt unverändert

**Beispiel** (nur ilvl aktualisieren):
```
/char edit char:Arthas-Blackhand ilvl:645
```

---

## Char löschen

Mit `/char remove` kannst du einen Char entfernen.

```
/char remove char:Arthas-Blackhand
```

---

## Deine Chars anzeigen

Mit `/char list` siehst du alle deine eingetragenen Chars auf einen Blick.

```
/char list
```

---

## Tipps

- Bei `char`, `klasse` und ähnlichen Feldern erscheint automatisch eine **Autocomplete-Liste** — einfach drauf klicken statt manuell eintippen
- Bitte trag **alle deine spielbaren Chars** ein, nicht nur deinen Main
- Halte dein **ilvl aktuell** — besonders nach neuen Patches oder Raids
- Fehlermeldungen sind nur für dich sichtbar

---
---

# Für Admin & Council

---

## Roster anzeigen

Mit `/roster view` siehst du alle eingetragenen Chars der gesamten Gilde, gruppiert nach Spieler.

```
/roster view
```

Optional nach Klasse filtern:
```
/roster view klasse:Warrior
```

---

## Ankündigung senden

Mit `/admin announce` schickt der Bot automatisch eine Nachricht mit Anleitung in alle registrierten Player-Channels und fordert die Spieler auf, ihre Chars einzutragen.

```
/admin announce
```

Nach dem Ausführen zeigt der Bot wie viele Channels erfolgreich erreicht wurden.

---

## Char für einen Spieler eintragen

Mit `/admin char-add` kannst du einen Char für ein Mitglied eintragen, ohne dass dieses selbst aktiv sein muss.

```
/admin char-add user:@Spieler klasse:Warrior name:Arthas server:Blackhand ilvl:639
```

Der Spieler erhält automatisch eine Benachrichtigung in seinem Player-Channel.

---

## Char eines Spielers bearbeiten

Mit `/admin char-edit` kannst du den Char eines Spielers anpassen. Wähle zuerst den Spieler, dann erscheint dessen Char-Liste in der Autocomplete-Auswahl.

```
/admin char-edit user:@Spieler char:Arthas-Blackhand ilvl:645
```

---

## Char eines Spielers löschen

Mit `/admin char-remove` kannst du einen einzelnen Char eines Spielers entfernen.

```
/admin char-remove user:@Spieler char:Arthas-Blackhand
```

---

## Alle Chars eines Spielers löschen

Mit `/admin remove-player` werden alle Chars eines Spielers auf einmal entfernt, z.B. wenn jemand die Gilde verlässt.

```
/admin remove-player user:@Spieler
```

Der Spieler erhält eine Benachrichtigung in seinem Player-Channel, und alle gelöschten Chars werden im Log-Channel protokolliert.

---

## Setup — Player-Channel registrieren

Damit ein Mitglied `/char`-Commands nutzen kann, muss sein Player-Channel einmalig registriert werden.

```
/setup player-channel user:@Spieler channel:#spieler-channel
```

---

## Setup — Übersicht

Mit `/setup overview` siehst du den Registrierungsstatus aller Mitglieder mit Council/Raidmember/Trial Rolle auf einen Blick.

```
/setup overview
```

Mitglieder ohne registrierten Player-Channel werden gesondert aufgelistet.

---

## Setup — Log-Channel festlegen

Legt den Channel fest, in dem der Bot alle Char-Änderungen protokolliert.

```
/setup log-channel channel:#log-channel
```
