# Machines opnieuw modelleren in Blender – voortgang

© 2026 Brakeco Games. Lees dit eerst na een onderbreking.

## Status
- **Machine 1 – siroopsproeier: KLAAR (4 rondes).** Wacht op akkoord van Remco voordat machine 2 begint.
- Volgende machines (na akkoord), in lijnvolgorde: Multi Station (middenvulling) → transportband (3–5 m)
  → Cake-O-Matic (top- en zij-icing) → Cake Station.

## Omgeving (hoe het hier draait)
- Er is geen map van Remco's pc gekoppeld, dus blender.exe op zijn pc is niet bereikbaar. Blender draait in
  de cloudsessie: **Blender 4.2.0 als Python-module** (`bpy` via PyPI) in `/opt/bpyenv`
  (`python3.11 -m venv /opt/bpyenv && /opt/bpyenv/bin/pip install bpy==4.2.0`).
  download.blender.org is geblokkeerd door het netwerkbeleid; PyPI niet.
- Eevee headless werkt met Mesa software-OpenGL: `apt-get install -y libegl1 libegl-mesa0 libgl1-mesa-dri`.
  (De melding "EGL_BAD_MATCH" is onschuldig; de render lukt.)
- Bouwen: `/opt/bpyenv/bin/python blender/<machine>.py -- --round <n>`
  (op Windows ook: `blender.exe --background --python blender/<machine>.py -- --round <n>`).
- Referentiefoto's: www.unifiller-europe.com is in deze sessie geblokkeerd. Er is een omgeving "Cake-Factory"
  met die host aangemaakt; een helpersessie (session_011xSMKxxtHHJk3SjwTW8pww) heeft de 9 foto's bekeken en
  beschreven. Deel 1 (siroopsproeier, complete lijn, Multistation, starter-lijn) is gelezen; deel 2
  (Cake-O-Matic tsi.jpg/tsi_inline.png, middenvulling, cl1.png, Cake Station) staat nog in die sessie.
  Lees die eerst voor machine 2+ (`list_events` op die sessie). Foto's niet committen (`reference/` staat in .gitignore).

## Bestanden
- `blender/lib.py` – gedeelde bouwstenen (box, cylinder, plate_yz, tube_path, helix, xform, set_origin, join),
  materialen, export, render-set (4 orthografische aanzichten, grijze achtergrond, studio-reflecties).
- `blender/syrup_sprayer.py` – siroopsproeier. Output `models/syrup_sprayer.glb`, `renders/syrup_sprayer_r<n>_*.png`.

## Afspraken per model
- Meters, Z omhoog in Blender, productstroom en "vooruit" = +Y (invoer −Y, uitvoer +Y), bedieningszijde = −X.
  (glTF-export zet dit om naar Y-omhoog; Blender +Y wordt glTF −Z.)
- Oorsprong: vloer, midden van het frame/band-voetprint. Eén root-empty met de machinenaam.
- Bewegende delen als aparte objecten met hun draaipunt op de juiste plek; de rest samengevoegd in `Body`.
- 2.000–8.000 driehoeken, eenvoudige PBR-materialen, geen logo's of teksten.

## Machine 1 – siroopsproeier (`SyrupSprayer`)
Objecten: `Body` (statisch), `Belt` (staafband, langs +Y), `Roller_In` / `Roller_Out` (draaien om X, pivot op de as),
`SprayHead` (beide pistolen, pivot op de brugstang, kan langs X schuiven), `Spray` (nevel, aan/uit).
Eindresultaat: 6.564 driehoeken, 1,89 × 1,35 × 1,68 m, bedhoogte 0,95 m, 18 materialen.

### Ronde 1 – eerste opzet uit eigen kennis (referenties nog niet beschikbaar)
Gesloten sproeikast met deur, vlakke band, sproeibalk met 5 spuitmonden, vat op het dak, paneel op een paal.
Kritiek: kadrering sneed het vat af; RVS las als mat grijs plastic; nevel massief oranje; slang dwars door het frame.

### Ronde 2 – opnieuw opgebouwd volgens de referentiebeschrijving
Na de fotobeschrijving bleek de opzet fout: echte sproeier is **open**. Nieuw: staafband (24 overlangse blauwe staven),
crèmekleurige gegroefde rollen Ø0,12 m, diepe RVS-bak (0,30 m), trapeziumwangen met brugstang (1,2 m),
2 sproeipistolen met gele spuitmondjes, ventielblokjes en luchtslangen, oranje productsensor, drukvat Ø0,30 × 0,45 m
met koepel/beugel/vlinderklep, filtervat, staande kast met schuine kap + touchscreen + schakelaars + hoofdschakelaar,
blauwe spiraalslang, noodstoppen op de bedhoeken, druiplade, frame op 0,25 m met schoor, blauwe zwenkwielen + stelvoeten.
Renders: automatische kadrering; studio-omgeving voor RVS-reflecties.
Kritiek: vatkoepel en touchscreen zweefden los (schaal/rotatie om de wereldoorsprong); RVS te donker;
nevel te massief; slangen als strakke draden; 7.396 driehoeken (te dicht bij de grens).

### Ronde 3 – fouten en materiaal
`xform()` draait/schaalt rond het eigen middelpunt → niets zweeft meer. Lichtere omgeving → RVS glanst.
Nevel doorschijnend licht. Siroopslangen hangen door (parabool). Minder driehoeken (6.404).
Kritiek: schoor kruist de druiplade; zijbak te egaal; kastkap licht wit op; overnamelip en verstelknop ontbreken.

### Ronde 4 – afwerking
Schoor naar het open vak bij de uitvoer; gezette randen en blanco typeplaatje op de bak; satijnen kastkap;
overnamelip aan de invoer; verstelknop naast de kast; draaipunten van rollen/sproeikop op de juiste plek.
GLB opnieuw ingeladen en gecontroleerd (namen, schaal, oorsprong, pivots).
Restpunt (bewust zo gelaten): in het vooraanzicht (vanaf de bedieningszijde) loopt de stroom van rechts naar links.

## Volgende stap
Wachten op akkoord van Remco. Daarna: deel 2 van de fotobeschrijvingen lezen en machine 2 (Multi Station) bouwen
met `blender/multi_station.py`, dezelfde werkwijze (min. 3, max. 8 rondes).
