# Teammanager

## Rollen
- Portal-Admin
- Vereins-Admin
- Trainer
- Vereins-Mitglied
- Spieler

### Portal-Admin
- kann Vereine verwalten => Sieht als einzige Rolle die Vereinsverwaltung
- kann User zu einem Verein einladen und bei der Einladung auch schon eine Rolle festlege.

### Vereins-Admin
- hat als einzige Rolle den Zugriff auf die Teamverwaltung
- kann hier Sportarten verwalten
- kann hier Teams verwalten
- Teams sind immer eine Sportart zugeordnet
- kann User in den Verein einladen und bei der Einladung direkt eine Rolle zuweisen (Rolle<= Vereins-Admin)
- kann den Teams Trainer zuweisen
- kann Orte in der Orteverwaltung verwalten

### Trainer
- die Trainerrolle ist immer einem Team zugewiesen
- ein User kann für mehrere Teams Trainer sein
- er kann vorhande Spieler in sein Team einladen
- er kann Speiele und Trainings anlegen
- er kann Spieler anlegen und diese einem Vereins-Mitglied zur Verwaltung zuordnen => Für Kinder

### Vereins-Mitglied
- ist die Basisrolle für jede Einladung
- ein Mitglied kann selbst Spieler sein
- ein Mitglied kann aber auch nur Spieler verwalten
- bekommt die benachrichtigungen für die Spieler die er verwaltet
- muss für die Spieler die er verwaltet zu den Spielen und Trainings zu und absagen

### Spieler
- Können normale Mitglieder sein
- können aber auch User sein, die noch keinen eigenen Login haben und von einem Vereins-Mitglied verwaltet werden

## Entitäten
- Verein
- Sportart
- Team
- Ort (Spielstätte)
- Spiel
- Training

### Verein
- ist der Mandant

### Sportart
- davon kann es n pro Verein geben
- diese kann vom Vereinsadmin verwalte werden
- besteht nur aus einem Text

### Team
- jedes Team hat n Trainer
- jedes Team hat n Spieler
- jedes Team ist einer Sportart zugeordnet
- jedes Team hat einen Namen

### Ort
- Orte können nur von Vereinsadmins verwaltet werden in der Orteverwaltung
- Orte sind pro Verein global
- jeder Ort hat einen
  - Namen
  - eine Adresse mit PLZ, Straße, Hausnummer und Ort
  - einen Link zum Ort
  - einen Link zum Ort auf googleMaps "GoogleMapsLink"
 
### Spiel
- jedes Spiel ist genau einem Team zugeordnet
- das Spiel kann vom Trainer eines Teams angelegt werden
- nach dem Anlegen werden alle Spieler der Manschaft zu dem Spiel eingeladen und müssen zu oder absagen
- das Spiel hat einen Ort der aus den Orten des Vereins gewählt werden kann oder alternativ auch ein mehrzeiliger Freitext sein kann
- das spiel hat eine Zeit für "Anpfiff"
- das Spiel hat eine Zeit für "Treffen"
- das Spiel hat ein Freitextfeld für "Infos"
- das Spiel erbt die Sportart vom Team

### Training
- das Training hat eine Sportart
- das Training kann n Teams einer Sportart zugeordnet werden
- jeders Teammitglied wird zum Training eingeladen und muss zu oder absagen
- 
