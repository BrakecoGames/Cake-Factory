# Cake Factory – Sweet Automation (Brakeco Games)

HTML5 / Three.js factory-automation tycoon for CrazyGames and Poki. See README.md for the code.

## Afspraken
- Antwoord in het Nederlands.
- Maak een git-herstelpunt vóór grote wijzigingen.
- Test met `npm test` en met Playwright op desktop en mobiel (portrait én landscape, 960×540 CrazyGames-frame).
- Bewaar savegames (format v4, alle nieuwe velden optioneel); `tests/fixtures/` bevat een oude save als regressietest.
- Behoud de CrazyGames SDK-integratie (`src/platforms/CrazyGamesAdapter.js`) en de performance.
- Uploaden (versie ophogen, committen, naar `main` pushen, live controleren) alleen als de gebruiker "upload"/"uploaden" zegt.
- Na elke push naar `main`: `npm run archive` (maakt het versiemapje in de gamemap).
- Verslagen in `docs/rapporten/`, voortgang van lopend werk in `docs/voortgang/`.
- Nooit wachtwoorden of tokens invoeren; het e-mailadres van de gebruiker is privé.

## Versie
`package.json` `version` en `GAME_VERSION` in `src/core/Config.js` moeten gelijk zijn (`npm run archive` controleert dat).

## Mapindeling (geldt voor alle Brakeco-games)
Op de pc: `C:\Users\Remco\iCloudDrive\Brakeco Games\06. Cake Factory\`

```
06. Cake Factory\
  01. Afbeeldingen\                          artwork, screenshots, promo
  02. Broncode\                              deze repository (git-werkmap)
  03. Bronmateriaal\                         referenties, ruwe assets, notities
  Cake Factory versie <YYYY-MM-DD> v<versie>\  per upload: CrazyGames-zip + versie.txt (npm run archive)
  Cake Factory.url                           snelkoppeling naar https://brakecogames.github.io/Cake-Factory/
```

- De git-opslag staat buiten iCloud: `C:\Users\Remco\GitRepos\cake-factory.git`; in `02. Broncode` staat een `.git`-bestand dat ernaar wijst (iCloud beschadigt git-opslag).
- `node_modules` staat ook buiten iCloud (`C:\Users\Remco\GitRepos\cake-factory-node_modules`) en is als junction gekoppeld in `02. Broncode`.
- Eenmalig inrichten op Windows: `tools/setup-windows.ps1` (zie de uitleg bovenin dat script).
