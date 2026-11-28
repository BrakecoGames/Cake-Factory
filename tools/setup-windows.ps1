<#
  Cake Factory - eenmalige inrichting van de gamemap op Windows (Brakeco Games mapindeling).

  Gebruik (PowerShell, vanuit de map waar dit script staat):
    powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1

  Wat het doet - het verwijdert of overschrijft NOOIT iets:
    1. maakt "01. Afbeeldingen" en "03. Bronmateriaal" aan in de gamemap
    2. haalt de code op in "02. Broncode", met de git-opslag BUITEN iCloud
       (C:\Users\<jij>\GitRepos\cake-factory.git; in 02. Broncode komt een .git-bestand dat ernaar wijst)
    3. zet node_modules buiten iCloud (junction naar GitRepos\cake-factory-node_modules) en installeert
    4. draait de tests en maakt het eerste versiemapje (npm run archive)
    5. toont losse bestanden in de gamemap, zodat je ze zelf in 01 of 03 kunt zetten

  Bestaat "02. Broncode" al (niet leeg), dan wordt stap 2 overgeslagen.
  Bestaat de git-opslag al, dan stopt het script zonder iets te veranderen.
#>
param(
  [string]$GameDir  = "$env:USERPROFILE\iCloudDrive\Brakeco Games\06. Cake Factory",
  [string]$GitRepos = "$env:USERPROFILE\GitRepos",
  [string]$RepoUrl  = "https://github.com/BrakecoGames/Cake-Factory.git",
  [string]$Branch   = "main"
)
$ErrorActionPreference = 'Stop'

function Need($cmd) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd is niet gevonden. Installeer het eerst." }
}
function Run($what) {
  # Native commands do not throw in Windows PowerShell 5.1: check the exit code ourselves.
  if ($LASTEXITCODE -ne 0) { throw "$what is mislukt (exitcode $LASTEXITCODE)." }
}
Need git; Need node; Need npm

# 1. folders
New-Item -ItemType Directory -Force -Path $GameDir | Out-Null
foreach ($d in @('01. Afbeeldingen', '03. Bronmateriaal')) {
  New-Item -ItemType Directory -Force -Path (Join-Path $GameDir $d) | Out-Null
}
New-Item -ItemType Directory -Force -Path $GitRepos | Out-Null

$src    = Join-Path $GameDir '02. Broncode'
$gitDir = Join-Path $GitRepos 'cake-factory.git'
$nmDir  = Join-Path $GitRepos 'cake-factory-node_modules'

# 2. code, git storage outside iCloud
$hasSrc = (Test-Path $src) -and ((Get-ChildItem -Force $src | Measure-Object).Count -gt 0)
if ($hasSrc) {
  Write-Host '"02. Broncode" bestaat al en is niet leeg - ophalen overgeslagen.' -ForegroundColor Yellow
} elseif (Test-Path $gitDir) {
  throw "$gitDir bestaat al. Verplaats of hernoem die map eerst; dit script overschrijft niets."
} else {
  git clone --branch $Branch --separate-git-dir "$gitDir" $RepoUrl "$src"; Run 'git clone'
}
Set-Location $src
git config user.name 'Brakeco Games'
git config user.email 'BrakecoGames@users.noreply.github.com'

# 3. node_modules outside iCloud
$nmLink = Join-Path $src 'node_modules'
if (-not (Test-Path $nmLink)) {
  New-Item -ItemType Directory -Force -Path $nmDir | Out-Null
  New-Item -ItemType Junction -Path $nmLink -Target $nmDir | Out-Null
  Write-Host "node_modules staat buiten iCloud: $nmDir" -ForegroundColor Green
} else {
  Write-Host 'node_modules bestaat al - niet aangepast.' -ForegroundColor Yellow
}
npm install --no-audit --no-fund; Run 'npm install'

# 4. tests + first archive
npm test; Run 'npm test'
if (Test-Path (Join-Path $src 'tools\archive.mjs')) {
  npm run archive; Run 'npm run archive'
} else {
  Write-Host "tools\archive.mjs staat nog niet op '$Branch' - archief overgeslagen." -ForegroundColor Yellow
}

# 5. loose items to sort by hand
$known = @('01. Afbeeldingen', '02. Broncode', '03. Bronmateriaal', 'Cake Factory.url')
$loose = Get-ChildItem -Force $GameDir | Where-Object { ($known -notcontains $_.Name) -and ($_.Name -notlike 'Cake Factory versie *') }
if ($loose) {
  Write-Host ''
  Write-Host 'Losse items in de gamemap (zelf naar 01. Afbeeldingen of 03. Bronmateriaal verplaatsen):' -ForegroundColor Cyan
  $loose | ForEach-Object { Write-Host "  $($_.Name)" }
}
Write-Host ''
Write-Host "Klaar: $GameDir" -ForegroundColor Green
