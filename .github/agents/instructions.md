# Allgemeine Anweisungen für Agenten

Diese Datei enthält verbindliche Richtlinien für alle Agenten, die an diesem Repository arbeiten.

## Tests

- Für jedes neue Feature müssen **Unit-Tests** und **UI-Tests** geschrieben werden.
- Unit-Tests prüfen die Geschäftslogik und API-Endpunkte isoliert.
- UI-Tests (End-to-End) prüfen die Benutzeroberfläche aus Nutzerperspektive.
- Tests müssen vor dem Merge der Änderungen grün sein.
- Bestehende Tests dürfen nicht ohne triftigen Grund entfernt oder geändert werden.

## UI-Design

- Die Benutzeroberfläche soll **reduziert, schnörkellos und funktional** sein.
- Keine unnötigen Animationen, dekorativen Elemente oder überflüssigen Abhängigkeiten.
- Klare Struktur, eindeutige Beschriftungen und kurze Ladezeiten haben Vorrang.
- Responsives Design wird erwartet; die Anwendung muss auf gängigen Bildschirmgrößen nutzbar sein.

## Security & Robustheit

- Alle Eingaben müssen serverseitig validiert und bereinigt werden.
- SQL-Injection, XSS und CSRF-Angriffe sind durch geeignete Maßnahmen zu verhindern.
- Keine Geheimnisse (Passwörter, API-Keys, Tokens) im Quellcode oder in Commits.
- Fehler müssen abgefangen und sicher behandelt werden; Stack-Traces dürfen nicht an den Client weitergegeben werden.
- Abhängigkeiten müssen vor der Aufnahme auf bekannte Sicherheitslücken geprüft werden.
- Änderungen müssen mit dem CodeQL-Checker auf Sicherheitsprobleme geprüft werden.

## Dokumentation

### manual.md
- Jedes umgesetzte Feature muss in `manual.md` dokumentiert werden.
- Die Dokumentation beschreibt die Funktion aus Nutzersicht: was das Feature tut, wie es bedient wird und welche Voraussetzungen gelten.

### requirements.md
- Die Anforderungen für jedes Feature müssen in `requirements.md` festgehalten werden.
- Format: Anforderungs-ID, Beschreibung, Akzeptanzkriterien.
- Anforderungen werden vor der Implementierung eingetragen und nach Abschluss als erfüllt markiert.
