# Bidrag til MINEO

Tak fordi du overvejer at bidrage til MINEO! 🎉

## 📋 Indholdsfortegnelse

- [Kodestandarder](#kodestandarder)
- [Udviklings-workflow](#udviklings-workflow)
- [Commit-beskeder](#commit-beskeder)
- [Pull Requests](#pull-requests)

## 🎨 Kodestandarder

### Filnavngivning
- **Komponenter**: PascalCase med `.jsx` extension → `StyledTextField.jsx`
- **Hooks**: camelCase med `.js` extension → `useStorTabel.js`
- **Utils**: camelCase med `.js` extension → `dateUtils.js`
- **Styles**: camelCase med `.css` extension → `typography.css`

### Sprog
- **Kode og variable**: Dansk
- **Kommentarer**: Dansk
- **UI-tekster**: Dansk
- **JSDoc**: Engelsk (valgfrit)

### Import-rækkefølge
```javascript
// 1. React
import React, { useState } from 'react';

// 2. Third-party libraries
import { Box, TextField } from '@mui/material';

// 3. Internal components
import StyledTextField from './StyledTextField';

// 4. Utilities og hooks
import { formatDate } from '../../utils/dateUtils';

// 5. Styles
import './styles.css';
```

### Komponenter

#### Funktionelle komponenter med hooks
```javascript
const MyComponent = ({ prop1, prop2 }) => {
  const [state, setState] = React.useState('');

  return (
    <div>
      {/* JSX */}
    </div>
  );
};

export default MyComponent;
```

#### Brug React.memo når relevant
```javascript
const ExpensiveComponent = React.memo(({ data }) => {
  // Render logic
});
```

### Styling

#### Brug centraliserede komponenter
- **ALWAYS** brug `StyledTextField` i stedet for Material-UI's `TextField`
- **ALWAYS** brug `StyledDropdown` for dropdowns
- **ALWAYS** brug `StyledDateField` for datoer
- **ALWAYS** brug `ContentBox` for containere

#### Undgå inline styles
```javascript
// ❌ Dårligt
<Box style={{ padding: '10px' }}>Content</Box>

// ✅ Godt
<Box sx={{ padding: '10px' }}>Content</Box>

// ✅ Bedre
<ContentBox>Content</ContentBox>
```

### State Management

#### Brug Zustand for global state
```javascript
import { useStore } from '../store';

const MyComponent = () => {
  const { value, setValue } = useStore();
  // ...
};
```

#### Lokal state for UI-specifikt
```javascript
const [isOpen, setIsOpen] = React.useState(false);
```

## 🔧 Udviklings-workflow

### 1. Fork og klon
```bash
git clone https://github.com/DIT-BRUGERNAVN/mineo.git
cd mineo
npm install
```

### 2. Opret en branch
```bash
git checkout -b feature/min-nye-feature
```

### 3. Udvikl
```bash
npm run dev
```

### 4. Test
- Test alle ændringer manuelt
- Tjek at eksisterende funktionalitet ikke er brudt
- Test i forskellige browsere hvis relevant

### 5. Commit
```bash
git add .
git commit -m "Tilføj ny feature: beskrivelse"
```

### 6. Push
```bash
git push origin feature/min-nye-feature
```

### 7. Opret Pull Request
- Gå til GitHub
- Klik "New Pull Request"
- Beskriv ændringerne tydeligt

## 💬 Commit-beskeder

### Format
```
Type: Kort beskrivelse (maks 50 tegn)

Længere beskrivelse hvis nødvendigt (wrapper ved 72 tegn)
```

### Typer
- **feat**: Ny feature
- **fix**: Bugfix
- **docs**: Dokumentation
- **style**: Formattering, manglende semicolons, etc.
- **refactor**: Kode-refaktorering
- **test**: Tilføj tests
- **chore**: Vedligeholdelse

### Eksempler
```
feat: Tilføj StyledDateField komponent

- Intelligent år-fortolkning
- Auto-formattering til dd-mm-åååå
- Validering inkl. skudår
```

```
fix: Ret fejl i dato-validering

Skudår blev ikke korrekt håndteret i februar.
```

## 🔍 Pull Requests

### Før du sender
- [ ] Koden følger projektets kodestandarder
- [ ] Alle nye features er testet
- [ ] Dokumentation er opdateret hvis relevant
- [ ] Commit-beskeder er klare og beskrivende

### PR-beskrivelse
Inkluder:
- **Hvad**: Hvad gør denne PR?
- **Hvorfor**: Hvorfor er denne ændring nødvendig?
- **Hvordan**: Hvordan er det implementeret?
- **Test**: Hvordan kan det testes?

### Eksempel
```markdown
## Hvad
Tilføjer intelligent dato-validering til StyledDateField

## Hvorfor
Brugere indtaster ofte datoer i forskellige formater.
Dette gør det nemmere ved at auto-formatere input.

## Hvordan
- Regex til at parse forskellige separatorer
- Intelligent år-fortolkning (1-2 cifre)
- Skudår-logik for februar

## Test
1. Åbn Stamdata-siden
2. Indtast "1-1-25" i skadesdato-feltet
3. Tab ud → skal blive til "01-01-2025"
```

## 🐛 Rapporter bugs

Brug GitHub Issues med følgende information:

- **Beskrivelse**: Hvad går galt?
- **Steps to reproduce**: Hvordan kan fejlen genskabes?
- **Forventet adfærd**: Hvad skulle der ske?
- **Actual behavior**: Hvad sker der i stedet?
- **Browser/OS**: Hvilken browser og OS?
- **Screenshots**: Hvis relevant

## ❓ Spørgsmål

Har du spørgsmål? Opret en GitHub Issue med label "question".

---

Tak for dit bidrag! 🙏
