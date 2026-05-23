# Keyboard Navigation Test-tjekliste

**Status:** Manuel QA-procedure, ikke normativ kontrakt
**Formål:** Manuel verifikation af keyboard-navigation kontrakt
**Udføres:** Efter ændringer i Container.tsx eller Styled* input-komponenter
**Reference:** `src/contracts/keyboard-navigation.md`

---

## Test-miljø

- [ ] Start applikation: `npm run dev`
- [ ] Åbn browser DevTools (F12)
- [ ] Naviger til Erstatningsopgørelse-siden
- [ ] Ingen console errors ved sideload

---

## 1. Tab-navigation (fremad)

### Stamdata-sektion (øverst)

- [ ] Start i første felt (Nummer)
- [ ] Tab til næste felt (evt. ledsagetekst)
- [ ] **Verificer:** Ingen blå markering af tekst
- [ ] **Verificer:** Cursor indsættes i feltet (ikke selection)
- [ ] Tab gennem alle felter i rækkefølge:
  - [ ] Nummer
  - [ ] Evt. ledsagetekst
  - [ ] Dato felt (skadedato eller lign.)
  - [ ] Dropdown (arbejdssituation)
  - [ ] **Verificer dropdown:** Ingen markering i dropdown-felt

### Numeric felter

- [ ] Tab til første numeric felt (procent, beløb, eller lign.)
- [ ] **Verificer:** Ingen markering af tallet
- [ ] **Verificer:** Cursor placeres (ikke selection)
- [ ] Tab til næste numeric felt
- [ ] **Verificer:** Samme adfærd (ingen selection)

### Datofelter (fra/til par)

- [ ] Tab til "fra"-datofelt
- [ ] **Verificer:** Ingen markering af datoen
- [ ] Tab til "til"-datofelt
- [ ] **Verificer:** Ingen markering af datoen
- [ ] **Verificer:** Konsistent adfærd mellem begge felter

### Sidste felt (cirkulær navigation)

- [ ] Tab til sidste felt på siden
- [ ] Tab én gang til
- [ ] **Verificer:** Fokus hopper til første felt (cirkulær)
- [ ] **Verificer:** Ingen markering i første felt

---

## 2. Shift+Tab-navigation (baglæns)

- [ ] Start i et midterste felt
- [ ] Shift+Tab til forrige felt
- [ ] **Verificer:** Fokus flytter baglæns
- [ ] **Verificer:** Ingen markering af indhold
- [ ] Shift+Tab helt til første felt
- [ ] Shift+Tab én gang til fra første felt
- [ ] **Verificer:** Fokus hopper til sidste felt (cirkulær)
- [ ] **Verificer:** Ingen markering i sidste felt

---

## 3. Enter-navigation

### Almindelige felter

- [ ] Fokusér på et tekstfelt
- [ ] Tryk Enter
- [ ] **Verificer:** Fokus flytter til næste felt (som Tab)
- [ ] **Verificer:** Ingen markering i næste felt
- [ ] Tryk Shift+Enter
- [ ] **Verificer:** Fokus flytter til forrige felt
- [ ] **Verificer:** Ingen markering i forrige felt

### Dropdown (popup-widget undtagelse)

- [ ] Fokusér på dropdown (arbejdssituation eller lign.)
- [ ] Tryk Enter
- [ ] **Verificer:** Dropdown åbner (menu vises)
- [ ] **Verificer:** Fokus forbliver på dropdown
- [ ] **Verificer:** Container intercepter IKKE Enter

### Textarea (newline undtagelse)

Hvis siden har en textarea:

- [ ] Fokusér på textarea
- [ ] Tryk Enter
- [ ] **Verificer:** Newline indsættes (ikke fokus-flytning)
- [ ] **Verificer:** Fokus forbliver i textarea

### Radiobutton (selection undtagelse)

- [ ] Fokusér en ikke-valgt radiobutton i en gruppe
- [ ] Tryk Enter
- [ ] **Verificer:** Den fokuserede radiobutton bliver valgt
- [ ] **Verificer:** Fokus forbliver på radiobutton (ingen fokus-flytning)
- [ ] Tryk `ArrowRight`
- [ ] **Verificer:** Næste radiobutton i gruppen bliver valgt og får fokus
- [ ] Stå på sidste radiobutton i gruppen og tryk `ArrowRight`
- [ ] **Verificer:** Første radiobutton i gruppen bliver valgt og får fokus
- [ ] Stå på første radiobutton i gruppen og tryk `ArrowLeft`
- [ ] **Verificer:** Sidste radiobutton i gruppen bliver valgt og får fokus

---

## 4. Museklik (Container må IKKE interceptere)

### Første klik på felt

- [ ] Klik på et felt der ikke har fokus
- [ ] **Verificer:** Feltet får fokus
- [ ] **Verificer:** Ingen markering (kun fokus)
- [ ] **Verificer:** Cursor indsættes

### Dropdown første klik

- [ ] Klik på dropdown der ikke har fokus
- [ ] **Verificer:** Dropdown åbner ved første klik
- [ ] **Verificer:** Menu vises

### Efterfølgende klik

- [ ] Klik på et felt der allerede har fokus
- [ ] **Verificer:** Cursor placeres ved klik-position
- [ ] **Verificer:** Ingen utilsigtet selection

---

## 4b. Piletast-navigation (uden for tabeller)

- [ ] Fokusér et felt i en række med flere felter (editor lukket/readOnly-tilstand)
- [ ] Tryk `ArrowRight`
- [ ] **Verificer:** Fokus går til næste felt i samme række
- [ ] Tryk `ArrowLeft`
- [ ] **Verificer:** Fokus går til forrige felt i samme række
- [ ] Stå på sidste felt i rækken og tryk `ArrowRight`
- [ ] **Verificer:** Wrap til første felt i samme række
- [ ] Stå på første felt i rækken og tryk `ArrowLeft`
- [ ] **Verificer:** Wrap til sidste felt i samme række

- [ ] Fokusér et felt i en midter-række og tryk `ArrowDown`
- [ ] **Verificer:** Fokus går til første felt i rækken under
- [ ] Hvis rækken under starter med en tabel: **Verificer:** Fokus går til første relevante tabelcelle
- [ ] Fokusér et felt i nederste række og tryk `ArrowDown`
- [ ] **Verificer:** Wrap til første felt i øverste række
- [ ] Fokusér et felt i øverste række og tryk `ArrowUp`
- [ ] **Verificer:** Wrap til sidste felt i nederste række
- [ ] Hvis rækken over/slutdestinationen er en tabel: **Verificer:** Fokus går til sidste relevante tabelcelle

- [ ] Fokusér åbent dropdown (menu vist) og brug piletaster
- [ ] **Verificer:** Menu-navigation håndteres af dropdown (Container intercepter ikke)
- [ ] Fokusér input med åben editor (caret synlig) og brug piletaster
- [ ] **Verificer:** Container intercepter ikke (eksisterende editor/caret-adfærd bevares)

---

## 5. Edge cases

### Tomme felter

- [ ] Tab til et tomt felt
- [ ] **Verificer:** Kun fokus (ingen selection)
- [ ] **Verificer:** Ingen fejl i console

### ReadOnly felter

Hvis siden har readOnly felter:

- [ ] Tab til readOnly felt
- [ ] **Verificer:** Fokus gives (hvis fokusbart)
- [ ] **Verificer:** Ingen selection

### Disabled felter

- [ ] **Verificer:** Disabled felter springes over i Tab-rækkefølge
- [ ] **Verificer:** Ingen fokus på disabled felter

### Felter med lange værdier

- [ ] Tab til et felt med lang tekst (fx lang ledsagetekst)
- [ ] **Verificer:** Ingen markering af teksten
- [ ] **Verificer:** Cursor indsættes i slutningen

---

## 6. Cross-cutting (hvis relevant)

### Tabel med Excel-navigation

Hvis siden har en tabel med pil-navigation (fx årsløn-tabel):

- [ ] Tab ind i tabellen
- [ ] **Verificer:** Fokus gives til første celle
- [ ] Brug piltaster (op/ned/venstre/højre) inde i tabellen
- [ ] **Verificer:** Pil-navigation fungerer (ikke dobbelt hop)
- [ ] Stå i øverste tabelrække og tryk `ArrowUp`
- [ ] **Verificer:** Fokus går til feltet over tabellen, hvis der findes et relevant felt
- [ ] Stå i nederste tabelrække og tryk `ArrowDown`
- [ ] **Verificer:** Fokus går til feltet under tabellen, hvis der findes et relevant felt
- [ ] Stå på venstre/højre rækkekant og tryk `ArrowLeft`/`ArrowRight`
- [ ] **Verificer:** Fokus bliver i tabelnavigationen og slipper ikke ud til siden
- [ ] Tab ud af tabellen
- [ ] **Verificer:** Fokus går til næste felt efter tabellen

---

## 7. Visuel inspektion

### Ingen blå markering

Visuelt gennemgå alle felt-typer:

- [ ] StyledTextField: Ingen blå markering ved Tab
- [ ] StyledDropdown: Ingen blå markering ved Tab
- [ ] StyledDateField: Ingen blå markering ved Tab
- [ ] StyledPercentField: Ingen blå markering ved Tab
- [ ] StyledIntegerField: Ingen blå markering ved Tab
- [ ] StyledAmountField: Ingen blå markering ved Tab

### Fokus-indikator

- [ ] **Verificer:** Fokuserede felter har synlig fokus-ring (outline)
- [ ] **Verificer:** Fokus-ring er klar og tydelig

---

## 8. Regression checks

### Efter hver større ændring:

- [ ] Kør automatiske tests: `npm run test -- src/__tests__/components/layout/Container.test.tsx`
- [ ] **Verificer:** Alle tests består
- [ ] Gennemgå denne tjekliste manuelt
- [ ] Test på mindst to forskellige sider (Stamdata + Erstatningsopgørelse)

---

## Fejlrapportering

Hvis noget fejler, dokumentér:

1. **Hvad fejler:** (fx "Tab markerer tekst i dropdown")
2. **Hvor:** (hvilken side, hvilket felt)
3. **Gentagelig:** (kan fejlen reproduceres konsekvent?)
4. **Console errors:** (se browser DevTools)

Rapportér via projektets aftalte fejlkanal med præcis beskrivelse.

---

## Acceptkriterier (alt skal være opfyldt)

- [ ] Tab flytter fokus uden markering (alle felt-typer)
- [ ] Shift+Tab flytter fokus baglæns uden markering
- [ ] Enter flytter fokus som Tab (uden markering), undtagen radiofelter
- [ ] Shift+Enter flytter fokus baglæns uden markering
- [ ] Enter på dropdown åbner menu (ikke fokus-flytning)
- [ ] Enter i textarea giver newline (ikke fokus-flytning)
- [ ] Enter på radiobutton vælger fokuseret option
- [ ] ArrowRight/ArrowLeft på radiobutton flytter aktiv selection med wrap i gruppen
- [ ] Sidefelt ↔ tabel vertical navigation fungerer uden dobbelt hop
- [ ] Museklik giver fokus (Container intercepter IKKE)
- [ ] Cirkulær navigation fungerer (første ↔ sidste)
- [ ] Ingen console errors
- [ ] Automatiske tests består

Når alle kriterier er opfyldt, er keyboard-navigation kontrakten verificeret.
