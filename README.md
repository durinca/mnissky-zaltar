# Mníšsky žaltár

Mobilná webová aplikácia (PWA) pre modlitbu hodín podľa **Mníšskeho týždenného žaltára** (slovenčina + latinčina).
Funguje offline, inštaluje sa na plochu telefónu a nepotrebuje server.

*A mobile-first, offline-capable PWA for praying the hours from the Slovak monastic weekly psalter.*

## Čo vie

- výber dňa (šípky, kalendár) a hodinky: Invitatórium, Posvätné čítanie, Ranné chvály, Tercia, Sexta, Nona, Vešpery, Kompletórium – po 16:30 sa ponúkne večerná hodinka, v sobotu I. vešpery nedele
- liturgický kalendár: obdobie (cez rok, advent, vianočné, pôstne, veľkonočné), číslo nedele, cyklus A/B/C, týždeň žaltára (I–IV)
- sezónne varianty antifón (advent, vianoce, pôst, veľká noc), v pôste sa vynecháva „Aleluja“
- vlastné časti nedieľ v období cez rok (modlitba, antifóny na Benediktus/Magnifikat podľa cyklu)
- výber variantov (čítania I–IV, prosby, modlitby, hymny, alternatívne chválospevy)
- latinský text hymnov a formúl (voliteľne), tmavý režim, veľkosť písma, „nechať obrazovku zapnutú“
- čítanie nahlas (Web Speech API, `sk-SK`)
- plne offline po prvom otvorení (service worker)

Vlastné časti sviatkov a slávností (ktoré v žaltári nie sú) aplikácia nedopĺňa – zobrazí upozornenie.

## Vývoj

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # kalendár, zostavenie hodinky, kontrola dát
npm run build      # -> dist/
npm run preview
```

### Dáta

Texty sa z Word dokumentu vyťahujú skriptom `tools/extract.mjs` do `public/data/*.json`
(`day-0..6.json` = nedeľa..sobota, `ordinary.json` = nedele cez rok, `festa.json` = žalmy na slávnosti):

```bash
node tools/extract.mjs "cesta/k/Mnissky zaltar_v2.docx"
```

Skript rozpozná hodinky, žalmy, antifóny (vrátane sezónnych `A./Vi./P./Ve. O.`), hymny (SK/LA), čítania, prosby a modlitby.
Pôvodný `.docx` sa do repozitára nepridáva. Po oprave dokumentu stačí skript spustiť znova.

Ďalšie nástroje: `tools/dump.mjs <deň>` (prehľad štruktúry), `tools/smoke.mjs` (headless Chrome – otvorí každú hodinku),
`tools/make-icons.mjs` (ikony).

### Nasadenie

Push do `main` spustí GitHub Action (`.github/workflows/pages.yml`) → GitHub Pages.
