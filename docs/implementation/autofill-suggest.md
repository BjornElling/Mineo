# Implementeringsplan: Autofill-suggest i StandardGridTable

Status: **PLANLAGT** – arbejdet er ikke begyndt. Der findes ingen `autofillSuggest*`-moduler i koden.

> **Gendannet 2026-08-27.** Planen beskriver et fremtidigt udviklingsprojekt og er derfor ikke
> dokumentation af den aktuelle programadfærd. Den må ikke slettes, før arbejdet er gennemført
> eller planen udtrykkeligt forkastes.

## Formål

Autofill-suggest skal være en inline ghost-text-funktion i StandardGridTable. Når en kolonne indeholder
et genkendeligt mønster i mindst to udfyldte rækker, vises en nedtonet suggest-værdi i næste tomme celle
i kolonnen – eller oven i det brugeren skriver, hvis cellen ikke er tom. Brugeren accepterer med Enter;
al anden navigation forbliver uændret.

Funktionen implementeres udelukkende i StandardGridTable. LooseGridTable-kompatibilitet designes ind fra
starten, men aktiveres ikke i første omgang.

## Nøglebeslutninger

| Spørgsmål | Beslutning |
|---|---|
| Scope | Kun StandardGridTable i første omgang |
| Understøttede inputtyper | Dato, heltal, beløb, år, uge, procent og tekst |
| Minimumsrækker for aktivering | 2 udfyldte rækker i samme kolonne |
| Aktiveringstidspunkt | Straks ved fokus, opdateres dynamisk mens brugeren skriver |
| Ghost-tekst | Inline efter det brugeren har skrevet |
| Aktivering | Opt-out pr. default – alle understøttede felttyper får suggest |
| Kolonnekoblinger | Deklareres eksplicit pr. tabel via `columnLinks`-prop |
| Enter-adfærd | Accepter suggest hvis aktiv; ellers navigér ned som hidtil |
| Fokus efter accept | Cellen beholder fokus |
| LooseGridTable | Ikke aktiveret i første omgang; arkitekturen designes til fremtidig integration |

## Mønstergenkendelse

Mønstergenkendelse sker altid ud fra de to seneste udfyldte rækker i kolonnen, ikke nødvendigvis de øverste.
Det giver det mest relevante mønster og undgår, at gamle data dominerer.

Understøttede mønstre:

- Dato: første eller sidste dag i måneden, fast dag med månedsskift, konstant interval og ens datoer.
- Heltal: konstant stigning, konstant fald og ens værdier.
- Måned: næste måned med wrap fra 12 til 1.
- År koblet til måned: årstallet øges ved wrap fra december til januar.
- Selvstændigt år: samme logik som heltal, begrænset til 1900–2100.
- Uge: næste uge i formatet `WW/ÅÅÅÅ`, herunder årsskift.
- Beløb og procent: ens værdi; stigning kun ved et dokumenteret årsskifte via en koblet kolonne.
- Tekst: gentagelse af samme tekst.

Hvis intet mønster genkendes, vises ingen suggest. Udtryksværdier viser den numeriske værdi og ikke det
oprindelige udtryk.

## Kolonnekoblinger

Koblinger defineres som en prop på StandardGridTable og senere eventuelt StandardLooseTable:

```typescript
type ColumnLink =
  | { kind: 'month-year'; monthColIndex: number; yearColIndex: number }
  | { kind: 'amount-date'; amountColIndex: number; dateColIndex: number }
  | { kind: 'amount-month-year'; amountColIndex: number; monthColIndex: number; yearColIndex: number };
```

Koblinger bruges udelukkende af mønstergenkendelsen. De må ikke påvirke rendering, navigation eller
validering.

## Visuel udformning

Hver celle med suggest renderes med en relativ container. Oven på inputfeltet placeres et absolut
positioneret span, der viser brugerens tekst efterfulgt af den foreslåede rest og et lille `ENTER`-mærke.
Inputfeltet beholder alle pointer-events og sin normale tastaturadfærd.

## Arkitektur og dataflow

Planen for den første implementering er:

```text
StandardGridTable
  → leverer tabeldata og columnLinks via AutofillSuggestContext
Inputfelt
  → kalder useAutofillSuggest for den aktuelle celle
  → modtager SuggestResult eller null fra den rene engine
  → viser AutofillGhostOverlay ved aktiv suggest
  → committer suggest-værdien ved Enter gennem den eksisterende feltmotor
```

Mulige moduler er `autofillSuggestTypes.ts`, `autofillSuggestEngine.ts`, `useAutofillSuggest.ts` og
`AutofillGhostOverlay.tsx` under `src/components/tables/autofillSuggest/`. De skal følge den aktuelle
inputarkitektur og må ikke genindføre slettede draft- eller persistence-API'er.

## Enter og øvrig navigation

Enter-interceptering skal ske tæt på inputkomponenten. Når en suggest er aktiv, committer komponenten
værdien og stopper eventets propagation, så den generelle tabelnavigation ikke flytter fokus nedad.
Uden suggest er den eksisterende Enter-navigation uændret. Tab forkaster suggest og navigerer som hidtil.

## Implementeringstrin

1. Implementér og test den rene mønstergenkendelse uden React.
2. Tilføj context og hook uden synlig UI-adfærdsændring.
3. Kobl engine til tabeldata og test projektionen.
4. Tilføj ghost-overlay og visning i de understøttede felttyper.
5. Tilføj Enter-accept, fokusbevarelse og regressionsdækning for almindelig navigation.

## Testplan

Engine-tests skal dække alle mønstre, årsskift, måned-wrap, uge 52/53, ugyldige eller uens mønstre og
beløb uden dokumenteret årsskifte. Integrations- og browser-tests skal kontrollere visning, fokus,
Enter-accept og Tab-navigation samt fravær af runtimefejl.

## Fremtidig udvidelse til LooseGridTable

Context, engine, hook og overlay bør være uafhængige af tabeltypen. Aktivering i LooseGridTable kræver
senere kun den relevante prop og context-provider, når projektet prioriteres.

## Afgrænsninger

- Dropdownfelter understøttes ikke.
- Suggest følger tabelrækkefølgen og tager ikke højde for en anden sortering eller filtrering end DOM-rækkefølgen.
- Suggest vises ikke i låste celler.
- Der gemmes ingen suggest-historik eller brugerpræferencer.
- Der indføres ingen serverkald, telemetri eller nye runtime-afhængigheder.
