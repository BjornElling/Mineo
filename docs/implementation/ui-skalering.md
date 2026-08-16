# Plan: kompakt sidemenu og afgrænset arbejdsfladeskalering

Status: **IMPLEMENTERET I KODE** 2026-08-16. Den automatiserede verifikation i §6 er gennemført;
manuel prøve på den konkrete browser/PWA-maskine er fortsat en releasekontrol. Planen erstatter den
tidligere retning, hvor hele Mineo-shellen skulle skaleres. Brugerbeslutningen gælder fortsat:
kompakt sidemenu, automatisk skalering og ingen manuel Mineo-indstilling. Menuscroll er kun et
sikkerhedsnet.

## 1. Afgørelse

**1366×768 kan forsvarligt omfattes, men kun som en konkret CSS-viewport-kontrakt:** mindst
**1358×620 CSS-px**, ved browserzoom 100 %. Det dækker den almindelige maksimerede browser eller
PWA på en 1366×768-skærm ved 100 % systemskalering. Det kan ikke loves ud fra den fysiske
skærmopløsning alene: 1366×768 ved eksempelvis 125 % Windows-skalering giver omkring 1093 CSS-px i
bredden og ligger uden for det forsvarlige område. Der skal da være almindelig vandret scroll i
arbejdsfladen; programmet må aldrig beskære indhold eller sænke skalaen under 85 %.

Den oprindelige plan er ikke forsvarlig som den stod:

- Den beregner den kompakte menu til 583 px, men den foreslåede variabelændring reducerer ikke
  hamburgerblokkens og dividernes lodrette afstand. Regnestykket kan derfor ikke føre til 583 px.
- Den skalerer hele MainLayout. Dermed rammes menu, overlays og alle faste elementer, selv om
  det kun er arbejdsfladens faste 1200-px-indhold, der skaber breddeproblemet. Det gør forskellen
  til MUI-portaler mærkbar ved 85 % og udvider geometririsikoen unødigt.
- Den forudsætter uden bevis, at scrollTop og rect-geometri skal normaliseres globalt. Det er kun
  sikkert at ændre, når en regressionstest viser en konkret mismatch i den valgte skaleringsrod.
- Den blander fysisk skærm, browservindue og Playwright-viewport. Kun den indre CSS-viewport er
  en stabil implementerings- og testgrænse.

Den nye retning skalerer kun main i Container; shell, menu og MUI-portaler forbliver i normal
størrelse. Det er den mindste ændring, der løser den faktiske flaskehals.

## 2. Verificeret baseline

En Chrome-prøve på den aktuelle app ved **1366×620 CSS-px** viser:

| Forhold | Måling |
|---|---:|
| Udfoldet sidemenu | 771 px indholdshøjde; Indstillinger og Om er klippet |
| Arbejdsfladens start | x = 274 px (250 menu + 24 containerpadding) |
| Indholdsboks uden skalering | x = 324–1524 px; vandret klippet |
| main ved zoom 0.85 | 850 px bred; indholdsboks 1020 px bred og slutter ved ca. x = 1337 |
| Console-fejl under prøven | ingen |

Prøven beviser ikke den færdige løsning. Den beviser derimod, at 85 % i den **afgrænsede**
arbejdsflade giver plads ved målet, mens den nuværende shell ikke gør. Alle browsermotorer skal
bestå den fulde verifikation i §6, før 1366-kontrakten kan blive gældende.

## 3. Målarkitektur

### 3.1 Kompakt menu er permanent og målt

Menuen bruger én samling CSS-variabler i layout.css; den normale, duplikerede sx-spacing fjernes.
Den kompakte profil er den fælles Mineo-menu, ikke en viewport-variant:

- toggle-padding-y: 4 px
- section-padding-y: 4 px
- button-height: 36 px
- button-gap: 2 px
- divider-margin-y: 4 px

Hamburgerknappen bevarer 44 px højde. Det giver den faktiske minimumshøjde:

    8 + 44 + 2 + 1 + (8 + 8 × 38) + 9 + (8 + 3 × 38) + 9 + (8 + 2 × 38) = 591 px

Menuens grupper ligger i én wrapper med flex: 1; min-height: 0; overflow-y: auto og overflow-x: hidden,
mens hamburgeren ligger udenfor. Scrollbaren vises derfor kun under 591 px, og hamburgeren kan altid
nåes. Ved den dækkede 620-px-højde må der ikke være intern menuscroll.

### 3.2 Skalér kun arbejdsfladen

Container får en navngiven main med data-mineo-content-scale-root og
zoom: var(--mineo-content-scale, 1). Container selv, MainLayout, root, html og body skal **ikke**
zoomes.

Det bevarer følgende i normalt koordinat- og størrelsesrum:

- sidemenu, shellhøjde og dens tastaturnavigation;
- MUI Popover, Menu, Select, datepickere, dialoger og tooltips, som portaleres til body;
- globale notices og faste shellhandlinger.

Zoom vælges frem for transform: scale, fordi transform ændrer containing block for fixed-børn og
efterlader et fuldstørrelse-layout. CSS zoom er understøttet af de browsermotorer, Mineo tester, men
ingen browser antages ens: målingen og E2E-gaten er autoriteten.

Skalering er **ikke** responsivt reflow: intet ombrydes, flyttes eller skjules. Det er en eksplicit,
kvantiseret størrelse på den ene faste arbejdsflade. Kontrakten skal beskrive den tilladte undtagelse
før kodeændringen lander; media queries og MUI-breakpoints er fortsat forbudt uden for den eksisterende
allowlist.

### 3.3 Skaleringspolitik

Skalaen er ren runtime-afledning, ikke brugerdata og ikke en indstilling. Den beregnes alene fra
window.innerWidth og ændres på resize med rAF-debounce. Højde indgår ikke: den normale arbejdsflade
scroller lodret, og menuen har sit selvstændige sikkerhedsnet.

- Skalatrin: 1, 0.95, 0.9 og 0.85.
- Fast venstre bredde: 274 px (250 px menu + 24 px Container-padding).
- Fast indholdsudstrækning: 1250 px (50 px main-padding + 1200 px indholdsboks).
- Scrollbarreserve: 20 px.

Vælg det største trin, hvor fast venstre bredde + fast indholdsudstrækning × skala +
scrollbarreserve er mindre end eller lig med innerWidth. Det giver 0,95 ved 1536 px, 1 ved 1920 px
og 0,85 ved 1366 px. Under 1358 px fastholdes 0,85; Containers eksisterende vandrette scroll gør
resten nåbart. Hysterese må kun forsinke skift *op* til et større trin. Fald til et trin, der er
nødvendigt for at undgå beskæring, sker straks.

Konstanterne må ikke kopieres til head-script og hook. Eksportér én serialiserbar policy-konfiguration
fra uiScale.ts; både det synkrone bootstrap-script og runtime resolveren læser samme data. En
parity-test skal dække de fælles grænser.

### 3.4 Geometri og virtualisering

Skaleringsroden ligger under scrollværten. Derfor må der ikke på forhånd ændres global scrolllogik.
Før en produktionsændring tilføjes browserregressionstests for:

- scrollTargetIntoView ved et mål i den zoomede main;
- VirtualizedDisplayTable i scrollMode ancestor ved top, midte og bund;
- sticky headers, position fixed-børn under main og fokusrestore.

VirtualizedDisplayTable sammenholder rect-afstande med den logiske rowHeight; den forventes at behøve
målestoksnormalisering fra den nærmeste content-scale-rod. Implementér kun denne isolerede rettelse,
når den røde test bekræfter den. Hvis scrollTargetIntoViews scrollmål allerede er i Containers visuelle
scrollrum, må den forblive uændret.

En DOM-helper måles på selve skaleringsroden (rect.width / offsetWidth) og returnerer 1 i jsdom eller
ved ugyldig geometri. Den må ikke gætte ud fra den valgte policyværdi; browseren er autoriteten.

## 4. Implementeringsrækkefølge

1. Ret testens viewport-præmis: 1536×864 i Playwright er en indre CSS-viewport, ikke en fysisk
   skærm. Tilføj projekterne 1536×730 og 1366×620 i alle fire browsermotorer. Gør shellassertions
   viewport-relative.
2. Tilføj den røde menu-test ved 1366×620, og indfør den målte kompakte menu inkl. wrapperens
   sikkerhedsnet. Assertér, at alle menupunkter er synlige, fokuserbare og uden intern scroll ved
   620 px; under 591 px assertéres scrollwrapperens nåbarhed.
3. Indfør uiScale.ts, bootstrap-parity-test og useContentUiScale. Bootstrap sætter kun
   --mineo-content-scale før første paint; main er den eneste forbruger.
4. Tilføj skaleringen til main og E2E-tests for trin 1/0,95/0,9/0,85 samt gulvet 0,85. En
   vinduesresize må ikke ændre afsluttet input, åben draft eller fokus uden brugerhandling.
5. Udfør geometriauditten i §3.4. Ret kun de beviste mismatch, med regressionstest pr. rettelse.
6. Afprøv ContentBoxReportDialog og html2canvas på den zoomede flade. Hvis output afviger, skal
   capture have en lokal, try/finally-beskyttet neutralisering af **kun** content-scale-roden og en
   billedregressionstest, før funktionen frigives.
7. Opdatér app-shell-kontrakten med den snævre tilladelse for arbejdsfladeskalering og dens
   portal-/scrollgrænser. Opdatér den relevante layoutkontrakt og AST-værnet samtidig. Værnet dækker
   nu allerede både max/min-width og max/min-height.

## 5. Acceptkriterier og stopregler

### Krav for 1366×768-støtte

- Ved 1366×620, browserzoom 100 %: menuen er fuldt nåbar uden scroll; ingen vandret beskæring af
  1200-px-indholdet; 85 %-trinnet er aktivt.
- Ved 1536×730: menuen er fuldt nåbar uden scroll, og arbejdsfladen bruger højst den nødvendige
  nedskalering.
- Ved 1920×1080: skalaen er 1.
- Ved indre bredde under 1358: skalaen falder aldrig under 0,85; den eksisterende vandrette scroll
  er synlig og funktionel. Dette er et bevidst stop for læsbarhed, ikke en skjult mobilvariant.
- Chrome, Edge, Firefox og WebKit består popupplacering, keyboard/fokus, virtualiseret tabel,
  html2canvas og ingen console.error eller ukontrolleret page-fejl på 1366×620 og 1536×730.

### Stopregler

Udvidelsen må ikke frigives som understøttelse af 1366×768, hvis ét af følgende består:

- 85 % giver uacceptabelt uskarpe rammer eller ulæselig tekst på en standard 1,25-DPR-skærm;
- en portal, popup, capture eller virtualiseret tabel ikke kan bringes i korrekt, testet tilstand
  uden global speciallogik;
- browserens faktiske indre viewport på brugerens 1366×768-opsætning er under 1358 px bred.

I de tilfælde er slutmålet stadig realistisk for 1536 px og opad, men ikke forsvarligt ved den
pågældende 1366-konfiguration. Løsningen er ikke at gå under 85 %; den korrekte fallback er den
nåbare, vandret scrollbare arbejdsflade.

## 6. Verifikation før handoff

1. Unit: skaleringspolicy, hysteresens retning, bootstrap/runtime-paritet og DOM-målestokshelper.
2. Unit + browser: virtualisering og scroll/fokus med en faktisk zoomet content-rod.
3. E2E i alle fire projekter ved 1366×620 og 1536×730: login, menu, popup/datepicker/select,
   keyboardnavigation, table-scroll, dokumentgate og console/page-fejl. Inspicér desktop-screenshots.
4. Manuel prøve i både browserfane og installeret PWA på den konkrete maskine: mål innerWidth,
   innerHeight, devicePixelRatio og browserzoom; prøv Om, Gem/Hent, en dropdown, datepicker og lang
   kontroltabel.
5. Kør relevant typecheck, lint, fuld Vitest og den berørte E2E-suite efter den implementerede
   risikoflade.

## 7. Rettelse foretaget under reviewet

Arkitekturværnet mod viewport-responsiv styling dækkede kun bredde. Det tillod dermed en skjult
max-height-variant. Værnet og app-shell-kontrakten dækker nu begge viewportakser; det ændrer ikke
synlig adfærd.
