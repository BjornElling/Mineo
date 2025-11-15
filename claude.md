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

## 🎨 Styling
- **Font**: Ubuntu (Regular 400, Medium 500, Bold 700)
- **Background**: #f8f9fa
- **White boxes**: #ffffff
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
