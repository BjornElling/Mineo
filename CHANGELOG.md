# Changelog

Alle væsentlige ændringer til MINEO dokumenteres i denne fil.

Formatet er baseret på [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
og dette projekt følger [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Grundlæggende projektstruktur
- MainLayout med SideMenu og Container
- Stamdata-side med intelligent datoindtastning
- StyledTextField - Centraliseret tekstfelt-komponent
- StyledDropdown - Dropdown med konsistent styling
- StyledDateField - Intelligent dato-felt med:
  - Auto-formatering til dd-mm-åååå
  - Accepterer flere separatorer (-, ., :, mellemrum)
  - Intelligent år-fortolkning (1-2 cifre)
  - Validering inkl. skudår og dato-ranges
  - Auto-padding af enkeltcifrede dag/måned ved separator
- ContentBox - Standardiserede white box containere
- Tab-navigation holder sig inden for indholdsvinduet (cirkulær)
- Centraliseret dato-konfiguration i `dateRanges.js`
- Typography.css med Ubuntu font og standardiserede tekst-styles
- Fejlmeddelelser svæver absolut uden at påvirke layout
- Rød kant på felter med fejl (også under indtastning)

### Changed
- Migreret fra Create React App til Vite for bedre performance
- Opdateret Material-UI til v7
- Alle felter bruger centraliserede komponenter (StyledTextField, etc.)

### Fixed
- Validering af 3-cifrede år sker nu kun ved blur, ikke under indtastning
- Fejlmeddelelser vises som én linje (nowrap)

## [0.1.0] - 2025-11-12

### Added
- Initial projekt setup
- Grundlæggende dokumentation (README, LICENSE, CONTRIBUTING)
- Vite build konfiguration
- Material-UI integration
- Ubuntu font integration
- Git repository struktur

---

## Version notation

- **MAJOR** version når der laves inkompatible API ændringer
- **MINOR** version når der tilføjes funktionalitet på en bagudkompatibel måde
- **PATCH** version når der laves bagudkompatible bugfixes

## Typer af ændringer

- **Added** - Nye features
- **Changed** - Ændringer i eksisterende funktionalitet
- **Deprecated** - Features der snart fjernes
- **Removed** - Fjernede features
- **Fixed** - Bugfixes
- **Security** - Sikkerhedsfixes
