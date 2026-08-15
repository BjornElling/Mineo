# `docs/implementation/` — planer for arbejde, der IKKE er udført

Denne mappe har præcis ét formål: at samle **implementeringsplaner for arbejde, der endnu ikke er
begyndt eller er ufærdigt**. En plan her er en åben hensigt, ikke dokumentation af programmet.

## Reglen

1. **Kun ikke-udført arbejde.** Hver plan bærer en statuslinje umiddelbart efter titlen:
   `Status: **PLANLAGT**` eller `Status: **UDSKUDT**` (evt. med dato og en kort tilføjelse).
2. **En implementeret plan bliver ikke liggende.** Når arbejdet er færdigt, flyttes det varige indhold
   — invarianter, forkastede alternativer, bevidste konsekvenser — ind i den relevante kontrakt i
   `src/contracts/` eller et dokument i `docs/architecture/`, og **planfilen slettes**. En plan, der
   beskriver noget, koden allerede gør, er en dublet af kontrakten og bliver før eller siden usand.
3. **Planer ligger her, ikke løst i `docs/`.** `docs/`-roden er til stående dokumenter (arbejdsliste,
   faste arbejdsinstrukser), ikke til tidsbegrænsede planer.

## Hvorfor mappen har en README og et værn

Begge fejlretninger er sket i praksis:

- **En plan blev slettet, mens den stadig var uindfriet.** Dokumentationsoprydningen efter
  draft/commit-omlægningen (`83b1de11`, 2026-07-31) fjernede hele denne mappe, fordi den var fuld af
  planer for *afsluttet* arbejde. Med i faldet gik `autofill-suggest.md`, hvis arbejde aldrig var
  begyndt. Den blev savnet og gendannet 2026-08-14.
- **En plan blev liggende, længe efter den var indfriet.** `docs/plan-opdateringsmodel.md` stod med
  `Status: IMPLEMENTERET` og duplikerede `app-shell-contract.md` §2.7–2.8. Ingen mekanisme gjorde
  opmærksom på det; den blev opdaget ved en tilfældig gennemgang og slettet 2026-08-14, efter at det
  ene, kontrakten manglede (det forkastede browser/PWA-alternativ), var flyttet dertil.

Statuslinjen er derfor **håndhævet**, ikke blot beskrevet:
`src/__tests__/quality/implementationPlanFolder.test.ts` gør det rødt, hvis en plan her mangler sin
statuslinje, hvis en plan erklærer sig `IMPLEMENTERET` (så er den udtjent — absorbér og slet), eller
hvis en `plan-*.md` lægges løst i `docs/`-roden.

Reglens formål er ikke ryddelighed for ryddelighedens skyld. En mappe, hvor færdige og ufærdige planer
blandes, tvinger den næste oprydning til at gætte — og et gæt er præcis det, der kostede
`autofill-suggest.md` første gang.
