# Claude AI Instruktioner for MINEO

Dette dokument indeholder kritiske regler for AI-assistenter der arbejder på MINEO-projektet.

## 🎯 Bruger-niveau
**Bjørn er meget uerfaren med programmering** - du skal ALTID:
- ✅ Levere **komplet, copy-paste klar kode** (aldrig uddrag eller "...")
- ✅ Angive **præcis filsti** for hver fil
- ✅ Give **trin-for-trin instruktioner** i ikke-teknisk sprog
- ✅ Forklare på **dansk**

## 🚫 Kritiske regler

### ALDRIG gør dette:
- ❌ Brug ALDRIG `TextField` fra MUI direkte
- ❌ Brug ALDRIG `Select` fra MUI direkte
- ❌ Brug ALDRIG inline styles eller custom CSS
- ❌ Opret ALDRIG nye styling-systemer
- ❌ Skriv ALDRIG engelske kommentarer i kode

### ALTID gør dette:
- ✅ Brug **StyledTextField** i stedet for TextField
- ✅ Brug **StyledDropdown** i stedet for Select
- ✅ Brug **StyledDateField** for alle datofelter
- ✅ Brug **ContentBox** for alle containere
- ✅ Skriv al kode og kommentarer på **dansk**
- ✅ Følg mappestrukturen nøje

## 📁 Filnavngivning
```
Komponenter:  PascalCase.jsx  → StyledTextField.jsx
Hooks:        camelCase.js    → useStorTabel.js
Utils:        camelCase.js    → dateUtils.js
Config:       camelCase.js    → dateRanges.js
```

## 🗂️ Import-rækkefølge
```javascript
// 1. React
import React, { useState } from 'react';

// 2. Third-party
import { Box, Typography } from '@mui/material';

// 3. Internal components
import StyledTextField from '../inputs/StyledTextField';

// 4. Config/Utils
import { MIN_SKADESDATO } from '../../config/dateRanges';
```

## 💬 Kommentar-standard

**VIGTIGT**: Følg disse regler konsekvent i HELE kodebasen.

### JSDoc-stil (til funktioner og komponenter)
Bruges til **al funktionsdokumentation** - giver IDE IntelliSense og auto-completion:

```javascript
/**
 * Beregner procesrente for en given periode
 *
 * @param {string} startDato - Startdato i format dd-mm-åååå
 * @param {string} slutDato - Slutdato i format dd-mm-åååå
 * @param {number} beloeb - Beløb i kr.
 * @returns {number} Beregnet rente i kr.
 */
const beregnRente = (startDato, slutDato, beloeb) => {
  // Implementation
};
```

**Regler for JSDoc:**
- Start med beskrivelse af hvad funktionen gør
- Brug `@param {type} navn - Beskrivelse` for alle parametre
- Brug `@returns {type} Beskrivelse` for returværdi
- Hold beskrivelser korte og præcise
- Brug dansk sprog i beskrivelser

### Inline kommentarer (til kode-logik)
Bruges til **forklaringer af kompleks logik** inden i funktioner:

```javascript
// Konverter dansk dato til ISO-format for validering
const isoDate = danishDate.split('-').reverse().join('-');

// Sikkerhed mod uendelig rekursion
if (depth > 10) return null;
```

**Regler for inline kommentarer:**
- Forklar **hvorfor**, ikke **hvad** (undgå redundante kommentarer)
- Placer kommentaren **lige over** den kode den beskriver
- Hold dem korte (max én linje når muligt)
- Brug kun når logikken ikke er selvforklarende

### ❌ Undgå disse typer kommentarer

**Forbudte kommentar-typer:**
```javascript
// ❌ Tidsbundne bemærkninger
// Denne linje er ny
// Tilføjet 2024-11-15

// ❌ Redundante kommentarer (gentager koden)
// Sæt værdi til 10
const value = 10;

// ❌ Udkommenteret kode (slet det!)
// const oldFunction = () => { ... };

// ❌ Overskrift-stil med linjer (brug JSDoc i stedet)
/** -----------------------------------------------------------
 *  Funktion: Håndter ændringer
 * ----------------------------------------------------------- */

// ❌ Emojis i kommentarer
// 🔥 VIGTIGT: Dette er...
```

### ✅ Gode kommentar-eksempler

```javascript
/**
 * Formaterer beløb til dansk format med tusindtalsseparator
 *
 * @param {number} amount - Beløb i kr.
 * @returns {string} Formateret beløb (fx "1.234,56")
 */
const formatAmount = (amount) => {
  // Rund til 2 decimaler før formatering
  const rounded = Math.round(amount * 100) / 100;

  // Brug dansk locale for tusindtalsseparator
  return rounded.toLocaleString('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};
```

### JSX-kommentarer
I JSX bruges `{/* ... */}` syntaks:

```javascript
return (
  <Box>
    {/* Hovedindhold */}
    <ContentBox>
      {/* Felt til skadesdato */}
      <StyledDateField
        label="Skadesdato"
        value={skadesdato}
      />
    </ContentBox>
  </Box>
);
```

## 🔑 Vigtige designbeslutninger

### Centraliserede komponenter
Alle UI-komponenter bruger de centraliserede versioner:
- `StyledTextField` - Basis tekstfelt (auto-trim, moderne design, floating error messages)
- `StyledDateField` - Intelligent dato-felt (dd-mm-åååå, auto-formatering)
- `StyledDropdown` - Dropdown (arver fra StyledTextField)
- `StyledIntegerField` - Heltal med min/max validering (tømmer 0-værdier)
- `StyledAmountField` - Beløbsfelt med dansk tusindtalsseparator og 2 decimaler
- `StyledPercentField` - Procentfelt med 2 decimaler
- `ContentBox` - Standardiserede containere (1000px bredde, 20px border-radius)

### Dato-konfiguration
Alt relateret til datoer bruger `src/config/dateRanges.js`:
```javascript
import { MIN_SKADESDATO, MAX_YEAR, TODAY } from '../../config/dateRanges';
```

**Årlig opdatering**:
1. Opdater `MAX_YEAR` i `dateRanges.js`
2. Tilføj nye rentesatser i `src/data/interestRates.js`
3. Tilføj nye lovregulerede satser i `src/data/regulationRates.js`

### Tab-navigation
`Container.jsx` fanger Tab/Shift+Tab og holder fokus inden for indholdsvinduet (cirkulær navigation).

### Floating error messages
Fejlmeddelelser bruger absolut positionering og påvirker ikke layout-højde.

## 📝 Component pattern
```javascript
const MyComponent = React.memo(({ prop1, prop2 }) => {
  const [state, setState] = React.useState('');

  return (
    <Box sx={{ padding: 3 }}>
      {/* Content */}
    </Box>
  );
});

MyComponent.displayName = 'MyComponent';

export default MyComponent;
```

## 🎨 Styling & Tema

### Centraliseret tema-system
**VIGTIGT**: Font, farver og skriftstørrelser er centraliseret til **kun 2 steder**:

1. **`src/index.css`** (Global CSS)
   - Font-face declarations for Ubuntu (Regular, Medium, Bold + Italic)
   - Global font: `* { font-family: 'Ubuntu', sans-serif; }`

2. **`src/App.jsx`** (MUI Theme) - **PRIMÆR KILDE**
   - Font: `fontFamily: 'Ubuntu, sans-serif'`
   - Farver: `text.primary`, `text.secondary`, `primary.main`
   - Skriftstørrelser: `h4`, `h5`, `h6`, `body1`, `body2`
   - **Dette er den ENESTE kilde til skriftstørrelser**

**VIGTIGT**: `src/styles/typography.css` indeholder CSS variables, men disse er **sekundære** og synkroniseret med MUI Theme. Hvis du skal ændre skriftstørrelser, gør det KUN i `src/App.jsx` MUI tema, og opdater derefter CSS variables til at matche.

### Brug tema-værdier i komponenter
```javascript
// ✅ RIGTIGT - Brug tema-værdier
<Typography variant="h6">Overskrift</Typography>
<Typography variant="body1">Normal tekst</Typography>
<Typography variant="body2" color="text.secondary">Lille tekst</Typography>
<Box sx={{ color: 'primary.main' }}>Blå tekst</Box>

// ❌ FORKERT - Hardcod ALDRIG font, farver eller størrelser
<Typography sx={{ fontFamily: 'Ubuntu', fontSize: '14px', color: 'rgba(0,0,0,0.87)' }}>
```

### Standard værdier
- **Font**: Ubuntu (Regular 400, Medium 500, Bold 700)
- **Farver**:
  - `text.primary`: rgba(0, 0, 0, 0.87)
  - `text.secondary`: rgba(0, 0, 0, 0.6)
  - `primary.main`: #1976d2
- **Skriftstørrelser**:
  - `h4`: 34px / 700 weight
  - `h5`: 24px / 500 weight
  - `h6`: 18px / 500 weight
  - `body1`: 14px
  - `body2`: 12px
- **Background**: #f8f9fa
- **Border radius**: 10px (felter), 20px (containere)

## 📚 Komplet dokumentation
Se `project_content.md` for:
- Detaljeret mappestruktur
- Komponentdokumentation
- Teknisk stack
- Designbeslutninger
- Roadmap

---

**Vigtigst**: Læs altid `project_content.md` først for fuld kontekst!
