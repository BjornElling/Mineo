import type { EetIssue } from './eetTypes';
import type { ErhvervsevnetabComposedValues } from '../../schemas/formSchemas';
import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import type { ISODateString } from '../../types/branded';
import { dateToISO, parseISODate } from '../../types/branded';
import { addMonths } from '../../utils/dateUtils';
import { forhoejetPensionsalderEvents } from '../../data/kapitalisering/forhoejetPensionsalderEvents';
import { getKapitaliseringsTabelData } from '../../data/kapitalisering/kapitaliseringsTabeller';
import { formatISOToDanish } from '../../utils/dateFormatting';
import { isoYear } from '../../utils/isoDateHelpers';
import { round0, round2, round3 } from '../../utils/roundingShortcuts';
import { SKAERING_2007_07_01 } from './eetSkaeringsdatoer';
import {
  calculateAgeYearsMonths,
  interpolateFactorBeyondTable,
  interpolateFactorWithinTable,
  resolveFactorTable,
  resolveKapitaliseringsbekendtgoerelseId,
  resolveKapitaliseringTabelvalg,
  resolveSaerfaktor,
} from './eetKapitaliseringOpslag';
import { resolveKapitaliseringAarsydelseBreakdown } from './eetKapitaliseringCalculation';
import {
  fromKroner,
  subtractMoneyOre,
  sumMoneyOre,
  toKroner,
  type MoneyOre,
} from '../money/money';
import { resolveStamdataDatoReference } from '../policies/stamdataCalculations';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Kapitalværdien af et erhvervsevnetab opgjort til folkepensionsalderen i én bestemt
 * bekendtgørelse, på en forhøjelses forhøjelsesdato. Begge sider (gammel/ny) i en
 * mer-erstatning har samme årsydelse; kun tabel, folkepensionsalder og faktor skifter.
 */
export type MerErstatningKapitalvaerdi = Readonly<{
  kapitaliseringsbekendtgoerelseLabel: string;
  folkepensionsalderLabel: string;
  kapitaliseringsfaktor: number;
  // round2(årsydelse × faktor). Ikke ceil0 som fane 3 — her er det differencen der er kravet,
  // og eksemplet viser kapitalværdierne med 2 decimaler.
  kapitalvaerdiOre: MoneyOre;
}>;

export type MerErstatningPensionsalderEvent = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  kapitaliseringsdato: ISODateString;
  kapitaliseringspct: number;
  forhoejelsesdato: ISODateString;
  // Satsår = kalenderåret 1 måned efter forhøjelsesdatoen.
  satsAar: number;
  gammelAlderLabel: string;
  nyAlderLabel: string;
  alderAar: number;
  alderMaaneder: number;
  faktorMaanedsAfhaengig: boolean;
  koenOpdelt: boolean;
  grundloenOre: MoneyOre;
  erstatningsniveauPct: number;
  amBidragPct: number;
  grundydelseOre: MoneyOre;
  grundydelse2024Ore: MoneyOre | null;
  opreguleringTil2024PctRounded4: number | null;
  aarsydelseGrundlagOre: MoneyOre;
  aarsydelseReguleringsPctRounded4: number | null;
  aarsydelseOre: MoneyOre;
  gammel: MerErstatningKapitalvaerdi;
  ny: MerErstatningKapitalvaerdi;
  // round0(ny.kapitalvaerdiOre − gammel.kapitalvaerdiOre), opgjort i kroner. Altid > 0.
  merErstatningOre: MoneyOre;
}>;

export type MerErstatningPensionsalderComputation = Readonly<{
  events: readonly MerErstatningPensionsalderEvent[];
  samletMerErstatningOre: MoneyOre;
}>;

// Input pr. kapitaliseret afgørelse. Værdierne hentes fra fane 3's computation, så
// grundløn, erstatningsniveau og AM-faktor er præcis dem fane 3 har anvendt.
export type MerErstatningKapitaliseretAfgoerelse = Readonly<{
  rowId: string;
  afgoerelsesdato: ISODateString;
  kapitaliseringsdato: ISODateString;
  kapitaliseringspct: number;
  grundloenOre: MoneyOre;
  erstatningsniveauPct: number;
  amBidragPct: number;
}>;

export type MerErstatningPensionsalderInput = Readonly<{
  kapitaliseringer: readonly MerErstatningKapitaliseretAfgoerelse[];
  beregningsdato: ISODateString;
  skadedato: ISODateString;
  skadestype?: Skadestype;
  fodselsdato: ISODateString;
  before2024Skade: boolean;
  koen: ErhvervsevnetabComposedValues['koen'];
}>;

const toIssue = (id: string, message: string): EetIssue => ({ id, severity: 'error', message });

// ─── Faktor-opslag for én bekendtgørelse på én dato ────────────────────────────

type FaktorOpslagResultat = Readonly<{
  kapitaliseringsbekendtgoerelseLabel: string;
  folkepensionsalderLabel: string;
  kapitaliseringsfaktor: number;
  koenOpdelt: boolean;
}>;

/**
 * Slår kapitaliseringsfaktor og bekendtgørelseslabel op for en bestemt opslagsdato.
 * Genbruger nøjagtig samme faktorregler som fane 3 og proformakapitaliseringen i fane 5:
 * tabelvalg, interpolation i tabel, ekstrapolation mod særfaktor, og direkte særfaktor
 * inden for 2-årsgrænsen før folkepension.
 *
 * Returnerer null (og pusher issue) hvis opslaget ikke kan gennemføres.
 */
const resolveFaktorForBekendtgoerelse = (
  args: Readonly<{
    opslagsdato: ISODateString;
    skadedato: ISODateString;
    skadestype?: Skadestype;
    fodselsdato: ISODateString;
    koen: ErhvervsevnetabComposedValues['koen'];
    faktorMaanedsAfhaengig: boolean;
    issuePrefix: string;
  }>,
  issues: EetIssue[]
): FaktorOpslagResultat | null => {
  const bekId = resolveKapitaliseringsbekendtgoerelseId(args.skadedato, args.opslagsdato);
  if (!bekId) {
    issues.push(toIssue(
      `${args.issuePrefix}-bekendtgoerelse-missing`,
      `Der findes ingen kapitaliseringsbekendtgørelse for ${formatISOToDanish(args.opslagsdato)}.`
    ));
    return null;
  }

  const tabeldata = getKapitaliseringsTabelData(bekId);
  if (!tabeldata) {
    issues.push(toIssue(
      `${args.issuePrefix}-bekendtgoerelse-missing`,
      `Kapitaliseringsdata mangler for ${bekId}.`
    ));
    return null;
  }

  const tabelvalg = resolveKapitaliseringTabelvalg(tabeldata, args.skadedato, args.fodselsdato, args.opslagsdato);
  if (!tabelvalg) {
    issues.push(toIssue(
      `${args.issuePrefix}-tabel-missing`,
      `Ingen kapitaliseringstabel i ${bekId} matcher ${resolveStamdataDatoReference(args.skadestype).labelLower} og fødselsdato.`
    ));
    return null;
  }

  // Alderen til faktoropslaget følger samme princip som fane 3: ved skade før 1.7.2007
  // bruges alder på opslagsdatoen, men faktoren er ikke månedsafhængig.
  const age = calculateAgeYearsMonths(args.fodselsdato, args.opslagsdato);
  if (!age) {
    issues.push(toIssue(`${args.issuePrefix}-faktor-unresolved`, 'Alder kan ikke beregnes for opslagsdatoen.'));
    return null;
  }

  const saerfaktor = resolveSaerfaktor(tabeldata, args.skadedato);
  const useDirectSaerfaktor = tabelvalg.folkepensionsalderMaaneder - age.totalMonths <= 24;
  const typeLabel = tabeldata.kapitaliseringsType === 'vejl' ? 'Vejl.' : 'Bkg.';
  const bekLabel = `${typeLabel} ${bekId}, tabel ${tabelvalg.tabel}`;

  if (useDirectSaerfaktor) {
    if (saerfaktor === null) {
      issues.push(toIssue(`${args.issuePrefix}-faktor-unresolved`, 'Særfaktor mangler.'));
      return null;
    }
    return {
      kapitaliseringsbekendtgoerelseLabel: bekLabel,
      folkepensionsalderLabel: tabelvalg.folkepensionsalderLabel,
      kapitaliseringsfaktor: round3(saerfaktor),
      koenOpdelt: false,
    };
  }

  const factorTableResult = resolveFactorTable(tabeldata, tabelvalg.tabel, args.koen);
  const factorRows = factorTableResult.rows;
  if (!factorRows || factorRows.length === 0) {
    if (factorTableResult.reason === 'missing-koen') {
      issues.push(toIssue('missing-koen', 'Ved kapitalisering før 1. marts 2015 skal køn angives.'));
    } else {
      issues.push(toIssue(`${args.issuePrefix}-tabel-missing`, `Ingen kapitaliseringsfaktorer for tabel ${tabelvalg.tabel}.`));
    }
    return null;
  }

  const minAge = factorRows[0]?.alder;
  if (minAge === undefined || age.years < minAge) {
    issues.push(toIssue(
      `${args.issuePrefix}-faktor-unresolved`,
      `Ingen kapitaliseringsfaktor for alder (${age.years} år, ${age.months} mdr.) — tabellen starter ved ${minAge} år.`
    ));
    return null;
  }

  let kapitaliseringsfaktor: number;
  const withinTable = interpolateFactorWithinTable(factorRows, age, args.faktorMaanedsAfhaengig);
  if (withinTable !== null) {
    kapitaliseringsfaktor = round3(withinTable);
  } else {
    if (saerfaktor === null) {
      issues.push(toIssue(`${args.issuePrefix}-faktor-unresolved`, 'Kapitaliseringsfaktor kan ikke beregnes, fordi særfaktor mangler.'));
      return null;
    }
    const beyondTable = interpolateFactorBeyondTable(
      factorRows,
      age,
      tabelvalg.folkepensionsalderMaaneder,
      saerfaktor,
      args.faktorMaanedsAfhaengig
    );
    if (beyondTable === null) {
      issues.push(toIssue(
        `${args.issuePrefix}-faktor-unresolved`,
        `Kapitaliseringsfaktor kan ikke beregnes for alder (${age.years} år, ${age.months} mdr.).`
      ));
      return null;
    }
    kapitaliseringsfaktor = round3(beyondTable);
  }

  return {
    kapitaliseringsbekendtgoerelseLabel: bekLabel,
    folkepensionsalderLabel: tabelvalg.folkepensionsalderLabel,
    kapitaliseringsfaktor,
    koenOpdelt: factorTableResult.koenOpdelt,
  };
};

// ─── Beregning ────────────────────────────────────────────────────────────────

/**
 * Beregner mer-erstatning ved forhøjet folkepensionsalder for alle kapitaliserede afgørelser.
 *
 * Reglen (jf. docs/domain/eet/mer-erstatning-pensionsalder.md):
 * For hver kapitaliseret afgørelse og hver folkepensionsalder-forhøjelse hvor
 *   1. forhøjelsesdato > kapitaliseringsdato, og
 *   2. forhøjelsesdato ≤ beregningsdato, og
 *   3. forhøjelsen hæver bekendtgørelsens tabel-folkepensionsalder (gammel faktor ≠ ny faktor/tabel),
 * beregnes mer-erstatningen som forskellen mellem kapitalværdien til den nye og den gamle
 * folkepensionsalder, begge opgjort på forhøjelsesdatoen med samme årsydelse (satsår = året
 * 1 måned efter forhøjelsesdatoen) og samme kapitaliseringsprocent som den faktiske kapitalisering.
 *
 * Flere forhøjelser for samme kapitalisering summeres trin-for-trin.
 */
export const computeMerErstatningPensionsalder = (
  input: MerErstatningPensionsalderInput,
  issues: EetIssue[]
): MerErstatningPensionsalderComputation | null => {
  const events: MerErstatningPensionsalderEvent[] = [];

  for (const kap of input.kapitaliseringer) {
    if (kap.kapitaliseringspct <= 0) continue;

    for (const event of forhoejetPensionsalderEvents) {
      // Betingelse 1: forhøjelsen ligger efter kapitaliseringen (datosammenligning, ikke kalenderår).
      if (event.forhoejelsesdato <= kap.kapitaliseringsdato) continue;
      // Betingelse 2: forhøjelsen er trådt i kraft senest på beregningsdatoen.
      if (event.forhoejelsesdato > input.beregningsdato) continue;

      const faktorMaanedsAfhaengig = input.skadedato >= SKAERING_2007_07_01;

      const gammelFaktor = resolveFaktorForBekendtgoerelse(
        {
          opslagsdato: event.opslagsdatoGammel,
          skadedato: input.skadedato,
          skadestype: input.skadestype,
          fodselsdato: input.fodselsdato,
          koen: input.koen,
          faktorMaanedsAfhaengig,
          issuePrefix: 'mer-erstatning-gammel',
        },
        issues
      );
      const nyFaktor = resolveFaktorForBekendtgoerelse(
        {
          opslagsdato: event.opslagsdatoNy,
          skadedato: input.skadedato,
          skadestype: input.skadestype,
          fodselsdato: input.fodselsdato,
          koen: input.koen,
          faktorMaanedsAfhaengig,
          issuePrefix: 'mer-erstatning-ny',
        },
        issues
      );
      if (!gammelFaktor || !nyFaktor) continue;

      // Betingelse 3: forhøjelsen skal faktisk hæve kapitalværdien. Hvis bekendtgørelserne
      // er identiske (samme faktor) er der ingen mer-erstatning, og forhøjelsen springes over.
      if (nyFaktor.kapitaliseringsfaktor <= gammelFaktor.kapitaliseringsfaktor) continue;

      // Satsår = kalenderåret 1 måned efter forhøjelsesdatoen (29-12-2015 → 29-01-2016 → 2016).
      const forhoejelsesDate = parseISODate(event.forhoejelsesdato);
      if (!forhoejelsesDate) continue;
      const satsDato = dateToISO(addMonths(forhoejelsesDate, 1));
      if (!satsDato) continue;
      const satsAar = isoYear(satsDato);

      const erstatningsniveau = kap.erstatningsniveauPct / 100;
      const amFaktor = (100 - kap.amBidragPct) / 100;

      const aarsydelseBreakdown = resolveKapitaliseringAarsydelseBreakdown(
        {
          grundloenOre: kap.grundloenOre,
          kapitaliseringspct: kap.kapitaliseringspct,
          erstatningsniveau,
          amFaktor,
          kapitaliseringsaar: satsAar,
          before2024Skade: input.before2024Skade,
        },
        issues
      );
      if (!aarsydelseBreakdown) continue;

      const age = calculateAgeYearsMonths(input.fodselsdato, event.forhoejelsesdato);
      if (!age) continue;

      const gammelKapitalvaerdiOre = fromKroner(round2(
        toKroner(aarsydelseBreakdown.aarsydelseOre) * gammelFaktor.kapitaliseringsfaktor
      ));
      const nyKapitalvaerdiOre = fromKroner(round2(
        toKroner(aarsydelseBreakdown.aarsydelseOre) * nyFaktor.kapitaliseringsfaktor
      ));
      const merErstatningOre = fromKroner(round0(toKroner(
        subtractMoneyOre(nyKapitalvaerdiOre, gammelKapitalvaerdiOre)
      )));
      if (merErstatningOre <= 0) continue;

      events.push({
        rowId: kap.rowId,
        afgoerelsesdato: kap.afgoerelsesdato,
        kapitaliseringsdato: kap.kapitaliseringsdato,
        kapitaliseringspct: kap.kapitaliseringspct,
        forhoejelsesdato: event.forhoejelsesdato,
        satsAar,
        gammelAlderLabel: event.gammelAlderLabel,
        nyAlderLabel: event.nyAlderLabel,
        alderAar: age.years,
        alderMaaneder: age.months,
        faktorMaanedsAfhaengig,
        koenOpdelt: gammelFaktor.koenOpdelt || nyFaktor.koenOpdelt,
        grundloenOre: kap.grundloenOre,
        erstatningsniveauPct: kap.erstatningsniveauPct,
        amBidragPct: kap.amBidragPct,
        grundydelseOre: aarsydelseBreakdown.grundydelseOre,
        grundydelse2024Ore: aarsydelseBreakdown.grundydelse2024Ore,
        opreguleringTil2024PctRounded4: aarsydelseBreakdown.opreguleringTil2024PctRounded4,
        aarsydelseGrundlagOre: aarsydelseBreakdown.aarsydelseGrundlagOre,
        aarsydelseReguleringsPctRounded4: aarsydelseBreakdown.aarsydelseReguleringsPctRounded4,
        aarsydelseOre: aarsydelseBreakdown.aarsydelseOre,
        gammel: {
          kapitaliseringsbekendtgoerelseLabel: gammelFaktor.kapitaliseringsbekendtgoerelseLabel,
          folkepensionsalderLabel: gammelFaktor.folkepensionsalderLabel,
          kapitaliseringsfaktor: gammelFaktor.kapitaliseringsfaktor,
          kapitalvaerdiOre: gammelKapitalvaerdiOre,
        },
        ny: {
          kapitaliseringsbekendtgoerelseLabel: nyFaktor.kapitaliseringsbekendtgoerelseLabel,
          folkepensionsalderLabel: nyFaktor.folkepensionsalderLabel,
          kapitaliseringsfaktor: nyFaktor.kapitaliseringsfaktor,
          kapitalvaerdiOre: nyKapitalvaerdiOre,
        },
        merErstatningOre,
      });
    }
  }

  if (events.length === 0) return null;

  const samletMerErstatningOre = sumMoneyOre(events.map((event) => event.merErstatningOre));
  return { events, samletMerErstatningOre };
};
