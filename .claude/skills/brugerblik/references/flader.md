# Fladerækkefølge

Rækkefølgen går fra de mindste og enkleste flader til de største og mest sammensatte.

**Hvorfor.** De fleste uhensigtsmæssigheder er ikke enestående – de er ét udslag af en vane, der
går igen overalt i programmet. På en lille flade er vanen let at få øje på, let at bedømme og let
at beskrive, fordi der ikke er noget at forveksle den med. Bliver den fundet og afklaret dér, kan
de store flader senere gennemgås med et færdigt sæt principper i hånden i stedet for at genopdage
det samme mønster ti gange under ti forskellige navne. Den omvendte rækkefølge ville betyde, at det
sværeste blev bedømt først – på det tidspunkt, hvor mindst var afklaret.

Rækkefølgen følges, medmindre brugeren peger på en bestemt flade. Den kan justeres, hvis en flade
viser sig at være væsentligt større eller mindre end antaget; en justering noteres i `STATUS.md`.

## Rækkefølgen

| # | Flade | Rute / placering | Bemærkning |
|---|---|---|---|
| 1 | Stamdata | `/stamdata` | 7 felter, to sektioner, ingen faner. Fladen alt andet afhænger af. |
| 2 | Om | `/mineo` | Næsten ren visning. Godt sted at bedømme tekst, links og tilbagevenden. |
| 3 | Indstillinger | `/indstillinger` | Få valg, men de virker på hele programmet. |
| 4 | Satser | `/satser` | Opslag/visning uden indtastning. Læsbarhed og genfinding. |
| 5 | MinProcesrente | selvstændig app | Lille, offentlig flade med egen indgang og egne forudsætninger. |
| 6 | Global shell | sidemenu, login, Gem/Hent/Slet alt, overlays, undo/redo | Tværgående. Tages her, når de små sider har vist, hvad der er normalt. |
| 7 | Varige mén | `/varigemen` (pr. fane) | Første flade med reelle beregninger og afhængighed af Stamdata. |
| 8 | Renteberegning | `/renteberegning` (pr. fane) | Perioder, datoer og rentesatser. |
| 9 | Årslønsberegning | `/aarsloen` | Første flade med en større indtastningstabel. |
| 10 | Forsørgertab | `/forsoergertab` | Mange indbyrdes afhængige forudsætninger. |
| 11 | Erhvervsevnetab | `/erhvervsevnetab` (pr. fane) | Stor. Tages fane for fane. |
| 12 | Erstatningsopgørelse | `/erstatningsopgoerelse` (pr. fane) | Programmets største flade. Én fane pr. kørsel: EO-oplysninger, Lønindkomst, Offentlige ydelser, Beregning, EO-kontrol, Kontroltabel. |

## Deling af store flader

Har en flade faner, er **én fane = én kørsel**. Er en enkelt fane stadig for stor til en tæt
gennemgang, deles den i afsnit efter sidens egne sektioner (`ContentBox`/`section-header`), og
`STATUS.md` fører hvert afsnit som sin egen række.

En flade er først `Gennemgået`, når alle dens faner og afsnit er det.
