import { resolveFravalgtStoreBededagstillaegAdvarsel } from '../loen/storeBededagstillaeg';
import type { ISODateString } from '../../types/branded';
import { erStoreBededagstillaegRelevant, kanDerVaereKravPaaStoreBededagstillaeg } from '../loen/storeBededagstillaeg';
import { isoToDanish, dateToISO, isISODateString } from '../../types/branded';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type { DependencySpec, EoRowModel, EoRowStatus } from './eoRowTypes';
import type { FieldIssue } from '../../inputCore/inputIssue';
import { isOffentligOverenskomstId } from '../../data/overenskomstRates';
import { resolveKildeReguleringsIntervalIso } from '../erstatningsopgoerelse/helpers/reguleringKildeCoverage';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveAnvendtReguleringsdato } from '../erstatningsopgoerelse/helpers/eoSharedUtils';
import {
  MANUEL_ANGIVET_SUPPLEMENT_FELTER,
  hasFinitePct,
  isManuelAngivetRowAktiv,
  isManuelAngivetRowDatoUdfyldt,
  isManuelProcentsatsRowAktiv,
  isManuelProcentsatsRowKomplet,
} from '../erstatningsopgoerelse/helpers/manuelReguleringRowPredicates';
import { resolveReguleringskildeNavn, resolveValgtReguleringDisplay } from '../erstatningsopgoerelse/helpers/loenudviklingDisplay';
import { resolveAnvendtReguleringsdatoReferenceText } from '../erstatningsopgoerelse/helpers/eoDateReferenceText';
import {
  resolveAnvendtReguleringsdatoForAnsaettelsesforhold,
  resolveSatserHeadingForAnsaettelsesforhold,
} from '../erstatningsopgoerelse/helpers/satserHeading';
import {
  erDatoUdenOverenskomstSatser,
  formatLoenraekkerUdenOverenskomstSatserBesked,
  formatReguleringsdatoUdenOverenskomstSatserBesked,
  resolvePrivatOverenskomstDaekning,
} from '../loen/overenskomstSatser';
import { hasIndtastetLoenoplysninger } from '../erstatningsopgoerelse/helpers/loenoplysningerInput';
import { TILLAEG_ANGIVES_SOM } from '../../types/loen';
import { buildIndkomstSectionStatuses, buildOffentligeYdelserStatusRows } from './eoRowIndkomstModel';
import { buildLoenindkomstTableLines } from './eoRowLoenindkomstTableLines';
import { resolveNegativeIndkomstkilder } from '../erstatningsopgoerelse/validation/negativeIndkomstkilder';
import { getToday } from '../../config/dateRanges';
import { parseAarsloenRowInterval } from '../aarsloen/aarsloenRowInterval';
import { DEFAULT_EO_ROW_POLICY, type EoRowPolicy } from '../../settings/sourceSettings';
import type { ErstatningsopgoerelseValues, ReguleringsRange } from './eoRowShared';
import { formatStatusMessage, calculateElapsedWholeMonths, buildReguleringsMangelMessage } from './eoRowShared';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds, resolveMidlertidigEetDato } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import { erMidlertidigtEetYdelsestype } from '../../data/ydelsestyper';
import { eoAngivetLoenFields, eoEmploymentFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import {
  eoOffentligeYdelserFraDatoField,
  eoOffentligeYdelserTillaegField,
  eoOffentligeYdelserTilDatoField,
  eoOffentligeYdelserYdelseField,
  eoOffentligeYdelserYdelsestypeField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { FieldAddress } from '../../inputCore/fieldAddress';
import type { OffentligeYdelserTableColumnKey } from '../../types/table';
import { buildTafRanges, resolveTafBoundaryDatesInSkadetPeriode } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import { STORE_BEDEDAG_START } from '../../data/indskudteLoentillaeg';
import { resolveManualRegulationIssue } from './eoManualRegulationIssue';
import {
  formatManualRegulationRowName,
  manualRegulationFormPrefix,
  resolveManualRegulationWarnings,
} from '../erstatningsopgoerelse/manualRegulationIssues';
import {
  resolveAnciennitetstillaegEfterTafAdvarsler,
  resolveAnciennitetstillaegMangel,
} from '../erstatningsopgoerelse/anciennitetstillaegRules';
import { resolveForhoejetGrundloenAdvarsler } from '../erstatningsopgoerelse/forhoejetGrundloenRules';
import {
  formatReguleringsdatoFoerKildeBesked,
  formatTafStartFoerKildeBesked,
  formatTafStartFoerManuelReguleringsdatoBesked,
} from '../erstatningsopgoerelse/loenudviklingReguleringsdatoIssues';
import {
  MANUEL_PROCENTSATS_UDEN_SATSER_BESKED,
  OVERENSKOMST_SKAL_SLAAS_TIL_BESKED,
} from '../erstatningsopgoerelse/validation/loenudviklingReguleringsdato';

/** Ydelsescellens feltadresse – linket fra en ydelseslinje fører til netop cellen (BB-291). */
const offentligeYdelserCellAddress = (rowId: string, colKey: OffentligeYdelserTableColumnKey): FieldAddress => {
  switch (colKey) {
    case 'fraDato': return eoOffentligeYdelserFraDatoField.bind(rowId).address;
    case 'tilDato': return eoOffentligeYdelserTilDatoField.bind(rowId).address;
    case 'ydelse': return eoOffentligeYdelserYdelseField.bind(rowId).address;
    case 'tillaeg': return eoOffentligeYdelserTillaegField.bind(rowId).address;
    case 'ydelsestype': return eoOffentligeYdelserYdelsestypeField.bind(rowId).address;
  }
};

/**
 * Er der midlertidigt EET blandt de offentlige ydelser? Enten indsættes det fra Erhvervsevnetab-siden
 * (togglen erstatter da de manuelle rækker helt, jf. domain-boundary-contract §10), eller der er en manuel
 * række med et beløb. Ydelsestypen slås op gennem `resolveYdelsestype`, fordi ældre filer kan bære den
 * viste label i stedet for nøglen.
 */
const harMidlertidigtEetYdelser = (values: ErstatningsopgoerelseValues): boolean => {
  if (values.midlertidigtEetFraEetSiden === 'Ja') return true;
  return (values.offentligeYdelserRows ?? []).some((row) => {
    if (!erMidlertidigtEetYdelsestype(row.ydelsestype)) return false;
    const ydelseBeloeb = amountValueToNumber(row.ydelse) ?? 0;
    const tillaegBeloeb = amountValueToNumber(row.tillaeg) ?? 0;
    return ydelseBeloeb + tillaegBeloeb > 0;
  });
};

/** Sidste dag med TAF-krav efter alle afskæringer – samme clamping som motoren. */
const resolveSidsteTafKravDato = (
  values: ErstatningsopgoerelseValues,
  skadedatoISO: ISODateString | undefined
): ISODateString | undefined => {
  const tafBounds = resolveTafConstraintBounds(values, { skadedatoISO });
  let sidste: ISODateString | undefined = undefined;
  for (const periode of values.tafPerioder ?? []) {
    const valid = getValidTafRange(periode);
    if (!valid) continue;
    const clamped = clampTafRange(valid, tafBounds);
    if (!clamped) continue;
    if (!sidste || clamped.til > sidste) sidste = clamped.til;
  }
  return sidste;
};

/**
 * Konsistensen mellem afgørelsen om midlertidigt EET (AES-afgørelser) og ydelsen midlertidigt EET
 * (Offentlige ydelser) – i begge retninger.
 *
 * **Mønsteret:** en truffet afgørelse er en OPLYSNING, som altid står på papiret og aldrig blokerer. Det,
 * afgørelsen normalt medfører for beregningen – her en løbende ydelse, der skal fradrages i TAF – er en
 * FORVENTNING, programmet kun kan påpege. Uoverensstemmelsen er derfor altid en ikke-blokerende advarsel:
 * retten til ydelsen kan være bortfaldet siden afgørelsen, og så er det rigtigt, at ydelsen ikke står der
 * (udviklerafgørelse 2026-09-24, BB-240). Gør aldrig disse rækker til `error`.
 *
 * Afgørelsens dato læses som oplysning (`resolveMidlertidigEetDato`) – uden 2011-grænsen og uden klagen,
 * som hører til afskæringen af TAF. Med afskæringsprædikatet var advarslen slukket for alle skader fra
 * 16. juni 2011, netop dér, hvor TAF løber videre og ydelsen skal fradrages (M-34). For en skade før 2011
 * afskærer afgørelsen selv TAF, så «TAF efter datoen» forekommer kun ved en verserende klage – det klarer
 * clampingen i `resolveSidsteTafKravDato` uden en særregel her.
 */
export const buildEoMidlertidigtEetKonsistensRows = (
  values: ErstatningsopgoerelseValues,
  skadedatoISO: ISODateString | undefined
): EoRowModel[] => {
  const harYdelser = harMidlertidigtEetYdelser(values);

  if (values.midlertidigtEETAfgorelse !== 'Ja') {
    // Med togglen slået til siger snapshottets EET-linje, om der hentes noget (BB-372); denne linje gælder kun
    // ydelser, brugeren selv har tastet. Før udløste togglen alene den, også når intet var indtastet eller hentet.
    if (values.midlertidigtEetFraEetSiden === 'Ja') return [];
    return harYdelser
      ? [{
        id: 'midlertidigtEetKonsistens.ydelerUdenAfgorelse',
        label: 'Advarsel',
        displayValue: 'Advarsel (Der er indtastet midlertidige EET-ydelser, men ikke angivet en afgørelse)',
        status: 'warning',
        summaryDisplay: 'messageOnly',
      }]
      : [];
  }

  if (harYdelser) return [];
  const afgoerelseDato = resolveMidlertidigEetDato(values);
  if (!afgoerelseDato) return [];
  const sidsteTafKravDato = resolveSidsteTafKravDato(values, skadedatoISO);
  // Ingen TAF efter afgørelsens dato → intet at fradrage.
  if (!sidsteTafKravDato || sidsteTafKravDato < afgoerelseDato) return [];

  return [
    {
      id: 'midlertidigtEetKonsistens.afgorelseUdenYdelser',
      label: 'Advarsel',
      displayValue: 'Advarsel (Der er angivet en midlertidig EET-afgørelse men ikke indtastet ydelser)',
      status: 'warning',
      summaryDisplay: 'messageOnly',
    },
  ];
};


/**
 * Programmet har ikke den valgte private overenskomsts satser på en dato, kortet skal bruge (BB-275).
 *
 * - Ligger datoen, satserne slås op på, før overenskomstens første satsperiode, kan beregningsgrundlaget ikke
 *   regnes: rød, blokerende linje (udviklerafgørelse 2026-10-06). Er datoen den særlige fra-dato, bærer feltet
 *   selv den røde ring og linjen, og rækken her springes over.
 * - Ligger kun lønrækker før dækningen, regnes deres tillæg uden overenskomstens satser: gul, ikke-blokerende
 *   linje (udviklerafgørelse 2026-10-06).
 *
 * Begge kræver procent-tilstand og indtastede lønoplysninger: uden dem bruges satserne ikke.
 */
const buildOverenskomstSatsDaekningRows = (
  values: ErstatningsopgoerelseValues,
  employment: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
  skadedato: ISODateString | undefined,
  skadestype: 'Arbejdsulykke' | 'Erhvervssygdom' | undefined,
  saerligDatoHarFeltfejl: boolean,
): EoRowModel[] => {
  if (employment.tillaegAngivesSom === TILLAEG_ANGIVES_SOM.BELOEB) return [];
  if (!hasIndtastetLoenoplysninger(employment.indtaegtsoplysningerTableData ?? [])) return [];
  const daekning = resolvePrivatOverenskomstDaekning(employment);
  if (daekning === null) return [];

  const anvendtReguleringsdato = resolveAnvendtReguleringsdatoForAnsaettelsesforhold({
    values,
    ansaettelsesforhold: employment,
    skadedato,
  });
  const reguleringsdatoUdenSatser = values.beregnesUdFra === 'Beregningsperiode'
    && anvendtReguleringsdato !== undefined
    && erDatoUdenOverenskomstSatser(daekning, anvendtReguleringsdato);
  if (reguleringsdatoUdenSatser) {
    if (saerligDatoHarFeltfejl) return [];
    const message = formatReguleringsdatoUdenOverenskomstSatserBesked(daekning);
    return [{
      id: `loenindkomst.${employment.id}.overenskomstSatserMangler`,
      employmentId: employment.id,
      label: resolveSatserHeadingForAnsaettelsesforhold({ values, ansaettelsesforhold: employment, skadedato, skadestype }),
      displayValue: formatStatusMessage('error', message),
      status: 'error',
      message,
      focusTarget: { kind: 'fieldAddress', address: eoEmploymentFields.overenskomstId.bind(employment.id).address },
    }];
  }

  const harLoenraekkerFoerDaekning = (employment.indtaegtsoplysningerTableData ?? []).some((row) => {
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    const start = interval ? dateToISO(interval.start) : undefined;
    return start !== undefined && erDatoUdenOverenskomstSatser(daekning, start);
  });
  if (!harLoenraekkerFoerDaekning) return [];
  const message = formatLoenraekkerUdenOverenskomstSatserBesked(daekning);
  return [{
    id: `loenindkomst.${employment.id}.loenraekkerFoerOverenskomstSatser`,
    employmentId: employment.id,
    label: 'Advarsel',
    displayValue: `Advarsel (${message})`,
    status: 'warning',
    summaryDisplay: 'messageOnly',
    summaryText: message,
    focusTarget: { kind: 'fieldAddress', address: eoEmploymentFields.overenskomstId.bind(employment.id).address },
  }];
};

export const buildEoIndkomstRows = (
  values: ErstatningsopgoerelseValues,
  skadedato: ISODateString | undefined,
  // Ubrugt siden BB-307: de manuelle tabellers røde celler læses nu pr. celle fra `manualReguleringFieldIssues`.
  // Positionen bevares, så kaldestederne ikke flytter argumenter.
  _manualReguleringInputErrors: Readonly<Record<string, true>> = {},
  rowPolicy: EoRowPolicy = DEFAULT_EO_ROW_POLICY,
  skadestype?: 'Arbejdsulykke' | 'Erhvervssygdom',
  /** De manuelle tabellers røde celler pr. ejer (ansættelsesforholdets id eller den angivne løns id). */
  manualReguleringFieldIssues: Readonly<Record<string, readonly FieldIssue[]>> = {},
  loenindkomstKortFieldIssues: Readonly<Record<string, readonly FieldIssue[]>> = {},
  loenindkomstTableCellIssues: Readonly<Record<string, readonly FieldIssue[]>> = {},
  /** Den angivne løns egne felter med en rød værdi (BB-306). */
  angivetLoenFieldIssues: readonly FieldIssue[] = [],
): EoRowModel[] => {
  const today = getToday();
  const rows: EoRowModel[] = [];
  const allowIncompleteOverenskomst = rowPolicy.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden;
  const overenskomstUdloebMaanederGraense = rowPolicy.allowReguleringMedUdloebMedMaaneder;
  const tafBoundaryDates = resolveTafBoundaryDatesInSkadetPeriode(values);

  const sections = buildIndkomstSectionStatuses(values, loenindkomstKortFieldIssues);
  // Et ansættelsesforhold med samlet negativ løn i en periode spærrer (BB-290, `negativeIndkomstkilder.ts`).
  const negativeIndkomstkilder = resolveNegativeIndkomstkilder(values, skadedato);
  sections.forEach((section) => {
    const employment = (values.loenindkomstAnsaettelsesforhold ?? []).find((item) => item.id === section.id);
    const kortFieldIssues = loenindkomstKortFieldIssues[section.id] ?? [];
    const harFeltfejl = (field: string): boolean =>
      kortFieldIssues.some((issue) => issue.field.address.field === field);
    const sidsteArbejdsdag =
      employment?.ansaettelsesforholdOphoert === true
        ? employment.sidsteArbejdsdag
        : undefined;
    const loenperiode = employment?.loenperiode;
    const harLoenEfterOphoer =
      Boolean(sidsteArbejdsdag)
      && Boolean(loenperiode)
      && (employment?.indtaegtsoplysningerTableData ?? []).some((row) => {
        if (!sidsteArbejdsdag || !loenperiode) return false;
        const interval = parseAarsloenRowInterval(row, loenperiode);
        if (!interval) return false;
        const intervalEndIso = dateToISO(interval.end);
        if (!intervalEndIso) return false;
        return intervalEndIso > sidsteArbejdsdag;
      });

    rows.push({
      id: `loenindkomst.${section.id}.arbejdsstedNavn`,
      employmentId: section.id,
      label: 'Navn på arbejdssted',
      displayValue: section.arbejdsstedNavnDisplay,
      status: section.arbejdsstedNavnStatus,
    });

    // Linjen hedder som satsafsnittets overskrift på skærmen, og beskeden er feltets egen regeltekst (BB-284).
    // Før stod der fast «Satser på skadedatoen» og «Forkert værdi indtastet i …» – en overskrift, skærmen ikke
    // viste, og en fejl uden den regel, feltet forklarede i sin tooltip.
    rows.push({
      id: `loenindkomst.${section.id}.satserSkadestidspunkt`,
      employmentId: section.id,
      label: employment === undefined
        ? 'Satser'
        : resolveSatserHeadingForAnsaettelsesforhold({ values, ansaettelsesforhold: employment, skadedato, skadestype }),
      displayValue: section.satserStatus === 'ok' ? 'Ja' : formatStatusMessage(section.satserStatus, section.satserMessage),
      status: section.satserStatus,
    });

    // Kortets egne felter med en rød eller gul værdi får hver sin linje med feltets navn og link (BB-277). Før
    // nåede fx en pensionssats på 150 kun boksen gennem sikkerhedsnettet – uden feltnavn og link – og forsvandt,
    // så snart en anden fejl stod i boksen.
    kortFieldIssues.forEach((issue) => {
      const status: EoRowStatus = issue.severity === 'error' ? 'error' : 'warning';
      rows.push({
        id: `loenindkomst.${section.id}.felt.${issue.field.address.field}`,
        employmentId: section.id,
        label: issue.field.descriptor.label,
        displayValue: formatStatusMessage(status, issue.message),
        status,
        message: issue.message,
        focusTarget: { kind: 'fieldAddress', address: issue.field.address },
      });
    });

    negativeIndkomstkilder
      .filter((fund) => fund.source.kind === 'employer' && fund.source.id === section.id)
      .forEach((fund) => {
        rows.push({
          id: `loenindkomst.${section.id}.negativSamletLoen.${fund.periode}`,
          employmentId: section.id,
          label: 'Lønoplysninger',
          displayValue: formatStatusMessage('error', fund.message),
          status: 'error',
          message: fund.message,
          summaryDisplay: 'messageOnly',
          summaryText: fund.message,
          focusTarget: { kind: 'rowId', rowId: section.id },
        });
      });

    if (employment !== undefined) {
      rows.push(...buildOverenskomstSatsDaekningRows(values, employment, skadedato, skadestype, harFeltfejl('saerligFraDatoRegulering')));
    }

    // Én linje pr. lønrække med en fejl eller advarsel, med rækkens navn, cellens egen tekst og link til cellen
    // (BB-291). Uden linjer står den samlede «Ja»-række, som inspektionen viser.
    const tableLines = employment === undefined
      ? []
      : buildLoenindkomstTableLines(values, employment, loenindkomstTableCellIssues[section.id] ?? [], skadedato, today);
    if (tableLines.length === 0) {
      rows.push({
        id: `loenindkomst.${section.id}.loenoplysninger`,
        employmentId: section.id,
        label: 'Alle lønoplysninger indtastet korrekt',
        displayValue: 'Ja',
        status: 'ok',
        summaryDisplay: 'messageOnly',
      });
    }
    tableLines.forEach((line) => {
      rows.push({
        id: `loenindkomst.${section.id}.loenoplysninger.${line.key}`,
        employmentId: section.id,
        label: 'Lønoplysninger',
        displayValue: formatStatusMessage(line.status, line.message),
        status: line.status,
        message: line.message,
        summaryDisplay: 'messageOnly',
        summaryText: line.message,
        focusTarget: { kind: 'fieldAddress', address: line.focusAddress },
      });
    });

    // En RØD dato læses som tom af readeren; den har sin egen linje ovenfor og er ikke «ikke indtastet» (BB-277).
    if (employment?.ansaettelsesforholdOphoert === true && !sidsteArbejdsdag && !harFeltfejl('sidsteArbejdsdag')) {
      const message = 'Det angives, at skadelidte er opsagt, men sidste dag i ansættelsesforholdet er ikke indtastet';
      rows.push({
        id: `loenindkomst.${section.id}.sidsteArbejdsdagMangler`,
        employmentId: section.id,
        label: 'Advarsel',
        displayValue: `Advarsel (${message})`,
        status: 'warning',
        summaryDisplay: 'messageOnly',
        summaryText: message,
        focusTarget: {
          kind: 'fieldAddress',
          address: eoEmploymentFields.sidsteArbejdsdag.bind(section.id).address,
        },
      });
    }

    if (harLoenEfterOphoer && sidsteArbejdsdag) {
      rows.push({
        id: `loenindkomst.${section.id}.loenEfterOphoer`,
        employmentId: section.id,
        label: 'Advarsel',
        displayValue: `Advarsel (Der er angivet løn efter sidste dag i ansættelsesforholdet (${isoToDanish(sidsteArbejdsdag)}). Kontrollér om dette er korrekt.)`,
        status: 'warning',
        summaryDisplay: 'messageOnly',
      });
    }
  });

  const loenudviklingsKilde = resolveLoenudviklingKilde(values);

  // Advarslen kræver både en relevant knap og en TAF-periode fra tillæggets virkningsdato.
  const tafDatoFraStoreBededag = buildTafRanges(values, { skadedatoISO: skadedato })
    .find((range) => range.til >= STORE_BEDEDAG_START)?.til;

  loenudviklingsKilde.forEach((ansaettelsesforhold) => {
    const erBeregningsperiode = values.beregnesUdFra === 'Beregningsperiode';
    const loenudviklingRowPrefix = erBeregningsperiode
      ? `loenindkomst.${ansaettelsesforhold.id}.regulering`
      : `taf.beregningsgrundlag.loenudvikling.${ansaettelsesforhold.id}`;

    // BEVIDST før enhver early return herunder: advarslen er uafhængig af, om reguleringen er
    // færdigopsat (udviklerbeslutning 2026-09-13). Den skal kunne ses, også mens ansættelsesforholdet
    // har en blokerende reguleringsfejl – ellers kan brugeren nå at rette fejlen og downloade uden
    // nogensinde at have set advarslen.
    //
    // Ved angivet dagsløn er der aldrig krav på tillægget, og dagsløn slår det fra som standard; en advarsel
    // ville påtale programmets eget, korrekte valg (BB-267, se `kanDerVaereKravPaaStoreBededagstillaeg`).
    const storeBededagFravalgtAdvarsel = resolveFravalgtStoreBededagstillaegAdvarsel(
      tafDatoFraStoreBededag, ansaettelsesforhold,
    );
    if (
      storeBededagFravalgtAdvarsel !== undefined
      && erStoreBededagstillaegRelevant({
        beregnesUdFra: values.beregnesUdFra,
        loenPaaHelligdage: ansaettelsesforhold.loenPaaHelligdage,
        reguleringsform: ansaettelsesforhold.loenudviklingBeregningsgrundlag,
        reguleringsdato: ansaettelsesforhold.saerligFraDatoRegulering ?? values.tafBeregningsperiodeTil,
        tillaegAngivesSom: ansaettelsesforhold.tillaegAngivesSom,
      })
      && kanDerVaereKravPaaStoreBededagstillaeg(values.beregnesUdFra, ansaettelsesforhold.loenPaaHelligdage)
    ) {
      rows.push({
        id: erBeregningsperiode
          ? `loenindkomst.${ansaettelsesforhold.id}.storeBededagstillaegFravalgt`
          : `taf.beregningsgrundlag.loenudvikling.${ansaettelsesforhold.id}.storeBededagstillaegFravalgt`,
        ...(erBeregningsperiode ? { employmentId: ansaettelsesforhold.id } : {}),
        label: 'Advarsel',
        displayValue: `Advarsel (${storeBededagFravalgtAdvarsel})`,
        status: 'warning',
        summaryDisplay: 'messageOnly',
      });
    }

    const loenudviklingBasis = ansaettelsesforhold.loenudviklingBeregningsgrundlag;
    const ownerFieldIssues = erBeregningsperiode
      ? loenindkomstKortFieldIssues[ansaettelsesforhold.id] ?? []
      : angivetLoenFieldIssues;
    const harFeltfejl = (field: string): boolean =>
      ownerFieldIssues.some((issue) => issue.field.address.field === field);
    const feltRowId = (field: string): string => erBeregningsperiode
      ? `loenindkomst.${ansaettelsesforhold.id}.felt.${field}`
      : `${loenudviklingRowPrefix}.felt.${field}`;
    const ownerFieldAddress = (field: keyof typeof eoAngivetLoenFields & keyof typeof eoEmploymentFields) =>
      erBeregningsperiode
        ? eoEmploymentFields[field].bind(ansaettelsesforhold.id).address
        : eoAngivetLoenFields[field].bind().address;
    const employmentIdProp = erBeregningsperiode ? { employmentId: ansaettelsesforhold.id } : {};

    // Den angivne løns egne felter med en rød værdi får hver sin linje med feltets navn og link – som
    // ansættelsesforholdets kortfelter (BB-277). Før nåede de kun boksen gennem sikkerhedsnettet, og kun når intet
    // andet stod der; en rød løntrin under angivet løn blev i stedet meldt som «Løntrin er ikke angivet» (BB-306).
    if (!erBeregningsperiode) {
      angivetLoenFieldIssues.forEach((issue) => {
        const issueStatus: EoRowStatus = issue.severity === 'error' ? 'error' : 'warning';
        rows.push({
          id: feltRowId(issue.field.address.field),
          label: issue.field.descriptor.label,
          displayValue: formatStatusMessage(issueStatus, issue.message),
          status: issueStatus,
          message: issue.message,
          focusTarget: { kind: 'fieldAddress', address: issue.field.address },
        });
      });
    }

    // «Valgt regulering». Beskederne bruger feltets eget navn (BB-316): før stod der «Regulering er sat til 'KRL',
    // men ingen KRL-satstabel er valgt» om et felt, der hedder «Satstabel».
    const valgt = ((): Readonly<{ message: string; focusAddress: FieldAddress }> | undefined => {
      if (!loenudviklingBasis) {
        return { message: 'Lønudvikling er ikke angivet', focusAddress: ownerFieldAddress('loenudviklingBeregningsgrundlag') };
      }
      if (loenudviklingBasis === 'Overenskomst' && erBeregningsperiode && !ansaettelsesforhold.harOverenskomst) {
        // Kortets overenskomst er slået fra, men lønudviklingen bygger på den. Linket fører til knappen, ikke til
        // det skjulte valg (BB-316).
        return {
          message: OVERENSKOMST_SKAL_SLAAS_TIL_BESKED,
          focusAddress: eoEmploymentFields.harOverenskomst.bind(ansaettelsesforhold.id).address,
        };
      }
      if (loenudviklingBasis === 'Overenskomst' && !ansaettelsesforhold.overenskomstId) {
        return { message: 'Overenskomst er ikke valgt', focusAddress: ownerFieldAddress('overenskomstId') };
      }
      if (loenudviklingBasis === 'Statistik' && !ansaettelsesforhold.loenudviklingStatistikModel) {
        return { message: 'Statistisk beregningsmodel er ikke valgt', focusAddress: ownerFieldAddress('loenudviklingStatistikModel') };
      }
      if (loenudviklingBasis === 'KRL satstabel' && !ansaettelsesforhold.loenudviklingKRLSatstabel) {
        return { message: 'Satstabel er ikke valgt', focusAddress: ownerFieldAddress('loenudviklingKRLSatstabel') };
      }
      return undefined;
    })();

    const valgtReguleringRowId = `${loenudviklingRowPrefix}.valgt`;
    rows.push({
      id: valgtReguleringRowId,
      ...employmentIdProp,
      label: 'Valgt regulering',
      displayValue: valgt === undefined ? 'Ja' : formatStatusMessage('error', valgt.message),
      status: valgt === undefined ? 'ok' : 'error',
      ...(valgt === undefined ? {} : {
        message: valgt.message,
        summaryText: valgt.message,
        focusTarget: { kind: 'fieldAddress' as const, address: valgt.focusAddress },
      }),
    });
    if (valgt !== undefined) {
      return;
    }

    rows.push({
      id: `${loenudviklingRowPrefix}.navn`,
      label: 'Navn på reguleringsform',
      displayValue: resolveValgtReguleringDisplay(ansaettelsesforhold),
      status: 'ok',
      dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
    });

    if (
      loenudviklingBasis === 'Overenskomst' &&
      ansaettelsesforhold.overenskomstId &&
      isOffentligOverenskomstId(ansaettelsesforhold.overenskomstId)
    ) {
      const offentligtRowId = `${loenudviklingRowPrefix}.offentligLoenoplysninger`;
      const trinValue = ansaettelsesforhold.offentligLoenTrin;
      const gruppeValue = ansaettelsesforhold.offentligLoenGruppe;
      // Et rødt løntrin eller en rød gruppe har sin egen linje med feltets tekst; readeren giver dem som tomme her,
      // så de må ikke også meldes som «ikke angivet». Begge mangler meldes på én gang (BB-316).
      const trinFejl = harFeltfejl('offentligLoenTrin');
      const gruppeFejl = harFeltfejl('offentligLoenGruppe');
      const manglerTrin = !trinFejl && typeof trinValue !== 'number';
      const manglerGruppe = !gruppeFejl && typeof gruppeValue !== 'number';
      const offentligMessage = manglerTrin && manglerGruppe
        ? 'Løntrin og gruppe er ikke angivet'
        : manglerTrin
          ? 'Løntrin er ikke angivet'
          : manglerGruppe
            ? 'Gruppe er ikke angivet'
            : undefined;
      const offentligStatus: EoRowStatus = offentligMessage !== undefined || trinFejl || gruppeFejl ? 'error' : 'ok';

      rows.push({
        id: offentligtRowId,
        ...employmentIdProp,
        label: 'KL-/RLTN-oplysninger',
        displayValue: offentligStatus === 'ok'
          ? `${ansaettelsesforhold.offentligLoenType}, løntrin ${String(trinValue)}, gruppe ${String(gruppeValue)}`
          : formatStatusMessage('error', offentligMessage ?? 'Ugyldig indtastning'),
        status: offentligStatus,
        ...(offentligMessage === undefined ? {} : {
          message: offentligMessage,
          summaryText: offentligMessage,
          focusTarget: {
            kind: 'fieldAddress' as const,
            address: ownerFieldAddress(manglerTrin ? 'offentligLoenTrin' : 'offentligLoenGruppe'),
          },
        }),
        // Uden en egen mangel er rækken kun rød, fordi et felt er rødt – og det felts linje er årsagen.
        dependsOn: [
          { kind: 'id', id: valgtReguleringRowId },
          ...(offentligMessage === undefined && trinFejl ? [{ kind: 'id' as const, id: feltRowId('offentligLoenTrin') }] : []),
          ...(offentligMessage === undefined && gruppeFejl ? [{ kind: 'id' as const, id: feltRowId('offentligLoenGruppe') }] : []),
        ],
      });

      // En forhøjet grundløn over selve trinlønnen er gul (BB-313): typisk et månedsbeløb angivet pr. time.
      resolveForhoejetGrundloenAdvarsler(values, { skadedato })
        .filter((advarsel) => advarsel.ownerKey === ansaettelsesforhold.id)
        .forEach((advarsel) => {
          const cell = advarsel.cells[0];
          rows.push({
            id: `${loenudviklingRowPrefix}.forhoejetGrundloen`,
            ...employmentIdProp,
            label: 'Advarsel',
            displayValue: `Advarsel (${advarsel.summaryMessage})`,
            status: 'warning',
            summaryDisplay: 'messageOnly',
            summaryText: advarsel.summaryMessage,
            ...(cell === undefined ? {} : { focusTarget: { kind: 'fieldAddress' as const, address: cell.address } }),
            dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
          });
        });
    }

    // Anciennitetstillægget: slået til uden dato eller sats spærrer (BB-304), og en dato efter erstatningsperioden
    // advarer (BB-305). Feltrelevansen giver et skjult tillæg som slået fra.
    const anciennitetMangel = resolveAnciennitetstillaegMangel(values, ansaettelsesforhold);
    if (anciennitetMangel !== undefined) {
      rows.push({
        id: `${loenudviklingRowPrefix}.anciennitetstillaeg`,
        ...employmentIdProp,
        label: 'Anciennitetstillæg',
        displayValue: formatStatusMessage('error', anciennitetMangel.message),
        status: 'error',
        message: anciennitetMangel.message,
        summaryText: anciennitetMangel.message,
        focusTarget: { kind: 'fieldAddress', address: anciennitetMangel.focusAddress },
        dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
      });
    }
    resolveAnciennitetstillaegEfterTafAdvarsler(values, tafBoundaryDates.last)
      .filter((advarsel) => advarsel.ownerKey === ansaettelsesforhold.id)
      .forEach((advarsel) => {
        const cell = advarsel.cells[0];
        rows.push({
          id: `${loenudviklingRowPrefix}.anciennitetstillaegEfterTaf`,
          ...employmentIdProp,
          label: 'Advarsel',
          displayValue: `Advarsel (${advarsel.summaryMessage})`,
          status: 'warning',
          summaryDisplay: 'messageOnly',
          summaryText: advarsel.summaryMessage,
          ...(cell === undefined ? {} : { focusTarget: { kind: 'fieldAddress' as const, address: cell.address } }),
          dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
        });
      });

    const anvendtReguleringsdato = resolveAnvendtReguleringsdato({
      beregnesUdFra: values.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
      saerligFraDatoRegulering: isISODateString(ansaettelsesforhold.saerligFraDatoRegulering) ? ansaettelsesforhold.saerligFraDatoRegulering : undefined,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      skadedato,
    });
    const anvendtReguleringsdatoReferenceText = resolveAnvendtReguleringsdatoReferenceText({
      anvendtReguleringsdato,
      skadedato,
      skadestype,
      beregnesUdFra: values.beregnesUdFra,
      beregningsperiodeTil: values.tafBeregningsperiodeTil,
      saerligFraDatoRegulering: isISODateString(ansaettelsesforhold.saerligFraDatoRegulering) ? ansaettelsesforhold.saerligFraDatoRegulering : undefined,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(values),
    });

    const erManuel = loenudviklingBasis === 'Manuelt angivet' || loenudviklingBasis === 'Manuel procentsats';
    const alleVaerdierRowId = `${loenudviklingRowPrefix}.alleVaerdier`;

    // De manuelle tabeller: én linje pr. rød celle med rækkens navn og cellens egen tekst og link – på begge flader
    // (BB-307, BB-308, form som BB-291). Før stod kun den første røde celle som «Manuel regulering: Dato», og på EO
    // oplysninger slet ingen; brugeren så i stedet følgen («'Reguleringsværdi på slut-dato …' er ikke angivet»).
    const manuelCelleRowIds: string[] = [];
    if (erManuel) {
      const aktivTabel = loenudviklingBasis === 'Manuel procentsats'
        ? 'loenudviklingManuelProcentsatsTableData'
        : 'loenudviklingManuelTableData';
      const tabelRows: readonly Readonly<{ id: string; dato?: ISODateString | undefined }>[] = loenudviklingBasis === 'Manuel procentsats'
        ? ansaettelsesforhold.loenudviklingManuelProcentsatsTableData ?? []
        : ansaettelsesforhold.loenudviklingManuelTableData ?? [];
      const prefix = manualRegulationFormPrefix(loenudviklingBasis);
      (manualReguleringFieldIssues[ansaettelsesforhold.id] ?? [])
        .filter((issue) => issue.field.address.path.some((segment) => segment.kind === 'entity' && segment.collection === aktivTabel))
        .forEach((issue) => {
          const rowSegment = issue.field.address.path.find(
            (segment): segment is Extract<typeof segment, { kind: 'entity' }> =>
              segment.kind === 'entity' && segment.collection === aktivTabel
          );
          const rowIndex = tabelRows.findIndex((row) => row.id === rowSegment?.entityId);
          const tabelRow = rowIndex < 0 ? undefined : tabelRows[rowIndex];
          // En rød dato giver ikke et brugbart navn til rækken; da bruges dens plads i tabellen.
          const rowName = formatManualRegulationRowName(
            issue.field.address.field === 'dato' ? undefined : tabelRow,
            Math.max(rowIndex, 0),
          );
          const linje = `${prefix}, ${rowName}: ${issue.message}`;
          const id = `${loenudviklingRowPrefix}.manuelCelle.${rowSegment?.entityId ?? String(manuelCelleRowIds.length)}.${issue.field.address.field}`;
          manuelCelleRowIds.push(id);
          rows.push({
            id,
            ...employmentIdProp,
            label: `${prefix}, ${rowName}`,
            displayValue: formatStatusMessage('error', issue.message),
            status: 'error',
            message: issue.message,
            summaryText: linje,
            focusTarget: { kind: 'fieldAddress', address: issue.field.address },
            dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
          });
        });
    }

    const alleReguleringsvaerdierRow = (() => {
      if (loenudviklingBasis === 'Ingen') {
        return { displayValue: 'Ingen', status: 'ok' as EoRowStatus, focusTarget: undefined };
      }
      if (!erManuel) {
        return { displayValue: 'Ja', status: 'ok' as EoRowStatus, focusTarget: undefined };
      }

      // En rød celle har sin egen linje ovenfor; denne række er da kun den samlede status og undertrykkes af den.
      if (manuelCelleRowIds.length > 0) {
        return {
          displayValue: formatStatusMessage('error', 'Ugyldig indtastning'),
          status: 'error' as EoRowStatus,
          focusTarget: undefined,
        };
      }

      const manualIssue = resolveManualRegulationIssue(
        ansaettelsesforhold,
        loenudviklingBasis,
        erBeregningsperiode,
      );

      if (loenudviklingBasis === 'Manuel procentsats') {
        const procentsatsRows = (ansaettelsesforhold.loenudviklingManuelProcentsatsTableData ?? []).slice(1);
        const aktiveRows = procentsatsRows.filter(isManuelProcentsatsRowAktiv);
        // En procentsats-tabel uden en eneste sats regnes som 0 %, mens papiret skriver «tillagt efterfølgende
        // lønstigninger». Brugeren har valgt en reguleringsform og glemt satserne (BB-303).
        if (aktiveRows.length === 0) {
          return {
            displayValue: 'Nej',
            message: manualIssue?.message ?? MANUEL_PROCENTSATS_UDEN_SATSER_BESKED,
            focusTarget: manualIssue?.focusTarget,
            status: 'error' as EoRowStatus,
          };
        }
        const ok = aktiveRows.every(isManuelProcentsatsRowKomplet);
        return {
          displayValue: ok ? 'Ja' : 'Nej',
          message: ok ? undefined : manualIssue?.message ?? 'Værdier mangler at blive udfyldt for manuel regulering',
          focusTarget: ok ? undefined : manualIssue?.focusTarget,
          status: ok ? 'ok' : 'error' as EoRowStatus,
        };
      }

      const manuelRows = ansaettelsesforhold.loenudviklingManuelTableData ?? [];

      const aktiveRows = manuelRows.filter(isManuelAngivetRowAktiv);

      if (aktiveRows.length === 0) {
        return {
          displayValue: 'Nej',
          message: manualIssue?.message ?? 'Værdier mangler at blive udfyldt for manuel regulering',
          focusTarget: manualIssue?.focusTarget,
          status: 'error' as EoRowStatus,
        };
      }

      const grundloenOk = aktiveRows.every((row) => row.grundloen !== undefined);

      // Basisrækken (index 0) har låst dato (= reguleringsdatoen); dato-kravet gælder kun de
      // efterfølgende rækker. Uden dato dropper motoren ellers rækken stille, og reguleringen
      // udebliver uden synlig fejl. Spejler validatorens tilsvarende krav.
      const datoOk = manuelRows
        .slice(1)
        .filter((row) => aktiveRows.includes(row))
        .every(isManuelAngivetRowDatoUdfyldt);

      // Supplement-konsistens: bruges et tillæg (feriepenge/SH-SO/fritvalg/AG-pension) på nogle
      // aktive rækker, kræves det udfyldt på ALLE aktive rækker – ellers markeres rækken rød.
      // BEVIDST strengere end validatoren og motoren (som tolker et blankt tillæg som 0 / base-
      // fallback): udviklerens beslutning 2026-07-04 (regulering-review G13-1) er, at et tomt tillæg
      // ikke må falde stille tilbage til basissatsen uden en synlig markering. Fjern ikke dette som
      // "unødig" streng-hed – asymmetrien er tilsigtet, ikke drift.
      const usedSupplements = MANUEL_ANGIVET_SUPPLEMENT_FELTER.filter((field) =>
        aktiveRows.some((row) => hasFinitePct(row[field]))
      );
      const supplementsOk = usedSupplements.every((field) =>
        aktiveRows.every((row) => hasFinitePct(row[field]))
      );

      const ok = grundloenOk && supplementsOk && datoOk;
      return {
        displayValue: ok ? 'Ja' : 'Nej',
        message: ok ? undefined : manualIssue?.message ?? 'Værdier mangler at blive udfyldt for manuel regulering',
        focusTarget: ok ? undefined : manualIssue?.focusTarget,
        status: ok ? 'ok' : 'error' as EoRowStatus,
      };
    })();

    if (loenudviklingBasis !== 'Ingen') {
      rows.push({
        id: alleVaerdierRowId,
        ...employmentIdProp,
        label: 'Alle reguleringsværdier udfyldt',
        displayValue: alleReguleringsvaerdierRow.displayValue,
        message: alleReguleringsvaerdierRow.message,
        summaryDisplay: alleReguleringsvaerdierRow.status === 'error' && !!alleReguleringsvaerdierRow.message
          ? 'messageOnly'
          : undefined,
        status: alleReguleringsvaerdierRow.status,
        focusTarget: alleReguleringsvaerdierRow.focusTarget,
        dependsOn: [
          { kind: 'id', id: valgtReguleringRowId },
          ...manuelCelleRowIds.map((id) => ({ kind: 'id' as const, id })),
        ],
      });
    }

    // De manuelle tabellers gule advarsler (BB-302, BB-313) – samme domæneregel som fladens gule ring.
    if (erManuel) {
      resolveManualRegulationWarnings(values, { skadedato }, tafBoundaryDates.last, overenskomstUdloebMaanederGraense)
        .filter((advarsel) => advarsel.ownerKey === ansaettelsesforhold.id)
        .forEach((advarsel) => {
          const cell = advarsel.cells[0];
          rows.push({
            id: `${loenudviklingRowPrefix}.manuelAdvarsel.${advarsel.kind}.${advarsel.rowId}`,
            ...employmentIdProp,
            label: 'Advarsel',
            displayValue: `Advarsel (${advarsel.summaryMessage})`,
            status: 'warning',
            summaryDisplay: 'messageOnly',
            summaryText: advarsel.summaryMessage,
            ...(cell === undefined ? {} : { focusTarget: { kind: 'fieldAddress' as const, address: cell.address } }),
            // Udløbet er først meningsfuldt, når tabellen er udfyldt; de øvrige gælder den enkelte celle.
            dependsOn: [{ kind: 'id', id: advarsel.kind === 'udloeb' ? alleVaerdierRowId : valgtReguleringRowId }],
          });
        });
    }

    const showReguleringDetails =
      alleReguleringsvaerdierRow.status === 'ok' &&
      alleReguleringsvaerdierRow.displayValue === 'Ja';

    if (!showReguleringDetails || !loenudviklingBasis || loenudviklingBasis === 'Ingen') {
      return;
    }

    const reguleringsRange = (() => {
      // Interval-baserede kilder (Overenskomst/Statistik/KRL/KL) deler én autoritativ coverage-opslag
      // – samme kilde-`fraDato`/`tilDato` som note-laget (reguleringsPresentation) og validatoren
      // bruger – så start/slut-dækning og note ikke kan komme i utakt.
      const kildeInterval = resolveKildeReguleringsIntervalIso(ansaettelsesforhold);
      if (kildeInterval) {
        return { min: kildeInterval.fraIso, max: kildeInterval.tilIso };
      }
      if (erManuel) {
        // En manuel tabel gælder, til næste række ændrer den: der er intet kildeudløb at måle mod. At den ikke er
        // ændret i lang tid, er en gul advarsel ovenfor, ikke en manglende reguleringsværdi (BB-302).
        return { min: anvendtReguleringsdato, max: tafBoundaryDates.last ?? anvendtReguleringsdato };
      }
      return {} as ReguleringsRange;
    })();

    // Kontrolrækkerne nedenfor er kontroltabellens. Et problem, de finder, meldes i «Fejl og advarsler» af det felt,
    // brugeren skal ændre – reguleringsgrundlagets dækning på «Lønudvikling beregnes ud fra» (eller den særlige
    // fra-dato) og en manglende dato ved sit eget felt. Rækkerne afhænger derfor af de linjer og står kun selv i
    // boksen, hvis ingen af dem gør – da med en sætning i brugerens sprog, ikke rækkens interne navn (BB-306).
    const kildeNavn = resolveReguleringskildeNavn(ansaettelsesforhold);
    const grundlagFocus = { kind: 'fieldAddress' as const, address: ownerFieldAddress('loenudviklingBeregningsgrundlag') };
    const daekningDependsOn: DependencySpec[] = [
      { kind: 'id', id: alleVaerdierRowId },
      { kind: 'id', id: feltRowId('loenudviklingBeregningsgrundlag') },
      { kind: 'id', id: feltRowId('saerligFraDatoRegulering') },
      // En privat overenskomst uden satser på reguleringsdatoen meldes af kortets satslinje (BB-306).
      ...(erBeregningsperiode ? [{ kind: 'id' as const, id: `loenindkomst.${ansaettelsesforhold.id}.overenskomstSatserMangler` }] : []),
      // En manglende reguleringsdato skyldes en manglende skadedato, beregningsperiode eller angivet dato.
      { kind: 'id', id: 'stamdata.skadedato' },
      { kind: 'id', id: 'taf.beregningsgrundlag.beregningsperiode' },
      { kind: 'id', id: 'taf.beregningsgrundlag.angivetLoenOpreguleresFraDato' },
    ];

    const reguleringsvaerdiRowStatus = (() => {
      if (!anvendtReguleringsdato) {
        return { displayValue: '-', status: 'error' as EoRowStatus, summaryText: 'Reguleringsdatoen kan ikke fastlægges – udfyld datoen, lønnen gælder fra' };
      }
      if (!reguleringsRange.min) {
        return { displayValue: 'Nej', status: 'error' as EoRowStatus, summaryText: undefined };
      }
      if (anvendtReguleringsdato < reguleringsRange.min) {
        return {
          displayValue: `Nej (først fra ${isoToDanish(reguleringsRange.min) ?? reguleringsRange.min})`,
          status: 'error' as EoRowStatus,
          summaryText: formatReguleringsdatoFoerKildeBesked(kildeNavn, anvendtReguleringsdato, reguleringsRange.min),
        };
      }
      return { displayValue: 'Ja', status: 'ok' as EoRowStatus, summaryText: undefined };
    })();

    const startDateRowStatus = (() => {
      const tafStartIso = tafBoundaryDates.first;
      if (!tafStartIso || !reguleringsRange.min) return { displayValue: '-', status: 'error' as EoRowStatus, summaryText: undefined };
      if (reguleringsRange.min <= tafStartIso) return { displayValue: 'Ja', status: 'ok' as EoRowStatus, summaryText: undefined };
      return {
        displayValue: `Nej (først fra ${isoToDanish(reguleringsRange.min) ?? reguleringsRange.min})`,
        status: 'error' as EoRowStatus,
        summaryText: erManuel
          ? formatTafStartFoerManuelReguleringsdatoBesked(reguleringsRange.min)
          : formatTafStartFoerKildeBesked(kildeNavn, reguleringsRange.min),
      };
    })();

    const endDateRowStatus = (() => {
      const tafEndIso = tafBoundaryDates.last;
      if (!tafEndIso || !reguleringsRange.max) return { displayValue: '-', status: 'error' as EoRowStatus, summaryText: undefined };
      if (reguleringsRange.max >= tafEndIso) return { displayValue: 'Ja', status: 'ok' as EoRowStatus, summaryText: undefined };

      const maanederSidenUdloeb = calculateElapsedWholeMonths(reguleringsRange.max, tafEndIso);
      if (maanederSidenUdloeb < overenskomstUdloebMaanederGraense) {
        // Grace-vinduet er BEVIDST form-agnostisk: en TAF-slutdato kort efter sidste sats vises 'ok',
        // fordi de carry-forward-former (overenskomst/KRL/KL/statistik-DST) legitimt viderefører sidste
        // sats inden for vinduet. For former der ALDRIG carry-forwarder (statistik ASL: motoren kaster
        // efter sidste indeksår) er denne 'ok' en display-tolerance – den autoritative, blokerende fejl
        // for det tilfælde leveres af validatoren (`validateLoenudviklingDataCoverage` → "ASL-maks-sats
        // mangler for {år}", testet i regulering-4). Nettoresultatet er derfor fail-closed (download
        // blokeres med synlig fejl); rækkens 'ok' er en bevidst, sikker asymmetri, ikke tavs
        // under-regulering.
        return {
          displayValue: `(< ${overenskomstUdloebMaanederGraense} måneder)`,
          status: 'ok' as EoRowStatus,
          summaryText: undefined,
        };
      }

      const tilDisplay = isoToDanish(reguleringsRange.max) ?? reguleringsRange.max;
      return {
        displayValue: `Nej (kun indtil ${tilDisplay})`,
        status: allowIncompleteOverenskomst ? 'warning' as EoRowStatus : 'error' as EoRowStatus,
        summaryText: `Der er ikke reguleringsværdier for hele TAF-perioden – ${kildeNavn} dækker kun til og med ${tilDisplay}. `
          + 'Vælg en anden reguleringsform',
      };
    })();
    const harTafDatointerval = Boolean(tafBoundaryDates.first && tafBoundaryDates.last);

    const kontrolRaekke = (
      id: string,
      label: string,
      rowStatus: Readonly<{ displayValue: string; status: EoRowStatus; summaryText: string | undefined }>,
      extraDependsOn: readonly DependencySpec[] = [],
    ): EoRowModel => ({
      id,
      ...employmentIdProp,
      label,
      displayValue: rowStatus.displayValue,
      status: rowStatus.status,
      message: buildReguleringsMangelMessage(rowStatus.status, rowStatus.displayValue),
      ...(rowStatus.status === 'ok' ? {} : {
        summaryText: rowStatus.summaryText ?? 'Reguleringsgrundlaget dækker ikke reguleringsdatoen – vælg en anden reguleringsform',
        focusTarget: grundlagFocus,
      }),
      dependsOn: [...daekningDependsOn, ...extraDependsOn],
    });

    const reguleringsvaerdiRowId = `${loenudviklingRowPrefix}.reguleringsvaerdi`;
    rows.push(kontrolRaekke(
      reguleringsvaerdiRowId,
      `Reguleringsværdi på ${anvendtReguleringsdatoReferenceText} for TAF`,
      reguleringsvaerdiRowStatus,
    ));

    if (harTafDatointerval) {
      rows.push(kontrolRaekke(
        `${loenudviklingRowPrefix}.startvaerdi`,
        'Reguleringsværdi på start-dato for TAF',
        startDateRowStatus,
        // Ligger reguleringsdatoen før første sats, gør TAF-starten det også; én linje er nok.
        [{ kind: 'id', id: reguleringsvaerdiRowId }],
      ));

      // Samlet, ikke-blokerende advarsel når reguleringskilden ikke dækker hele TAF-perioden, men
      // hullet er tolereret (start/slut-status er 'warning', ikke blokerende 'error').
      const daekningStartWarning = startDateRowStatus.status === 'warning';
      const daekningSlutWarning = endDateRowStatus.status === 'warning';
      const daekningAdvarselRowId = `${loenudviklingRowPrefix}.daekningAdvarsel`;
      if (daekningStartWarning || daekningSlutWarning) {
        const startDato = reguleringsRange.min ? (isoToDanish(reguleringsRange.min) ?? reguleringsRange.min) : undefined;
        const slutDato = reguleringsRange.max ? (isoToDanish(reguleringsRange.max) ?? reguleringsRange.max) : undefined;
        const detaljer = [
          daekningStartWarning && startDato ? `først fra ${startDato}` : undefined,
          daekningSlutWarning && slutDato ? `kun til og med ${slutDato}` : undefined,
        ].filter((part): part is string => Boolean(part));
        if (detaljer.length > 0) {
          rows.push({
            id: daekningAdvarselRowId,
            ...employmentIdProp,
            label: 'Advarsel',
            displayValue: `Advarsel (Der er ikke reguleringsværdier for hele TAF-perioden – ${detaljer.join(' og ')}.)`,
            status: 'warning',
            summaryDisplay: 'messageOnly',
            focusTarget: grundlagFocus,
            dependsOn: [{ kind: 'id', id: alleVaerdierRowId }],
          });
        }
      }

      rows.push(kontrolRaekke(
        `${loenudviklingRowPrefix}.slutvaerdi`,
        'Reguleringsværdi på slut-dato for TAF',
        endDateRowStatus,
        // Den samlede advarsel ovenfor siger det samme, når hullet er tolereret (indstillingen).
        [{ kind: 'id', id: daekningAdvarselRowId }],
      ));
    }
  });

  return rows;
};

export const buildEoOffentligeYdelserRows = (
  values: ErstatningsopgoerelseValues,
  skadedatoISO?: ISODateString,
  cellIssues: readonly FieldIssue[] = []
): EoRowModel[] => {
  const rows: EoRowModel[] = [];
  const statusRows = buildOffentligeYdelserStatusRows(values.offentligeYdelserRows ?? [], cellIssues, values);

  statusRows.forEach((row) => {
    rows.push({
      id: `offentligeYdelser.${row.id}`,
      label: row.label,
      displayValue: row.status === 'ok' ? 'ok' : formatStatusMessage(row.status, row.message),
      status: row.status,
      summaryDisplay: row.summaryDisplay ?? 'default',
      // Statusrækkens id er en GRUPPENØGLE pr. ydelsestype og findes ikke i DOM. Modellen har båret den
      // ydelsesrække, beskeden stammer fra, hele vejen hertil, så linket kan forankres til netop den
      // række i tabellen frem for kun at skifte fane.
      ...(row.status === 'ok' ? {} : { message: row.message, summaryText: row.message }),
      ...(row.sourceRowId === undefined
        ? {}
        : {
          focusTarget: row.focusColKey === undefined
            ? { kind: 'rowId' as const, rowId: row.sourceRowId }
            : { kind: 'fieldAddress' as const, address: offentligeYdelserCellAddress(row.sourceRowId, row.focusColKey) },
        }),
    });
  });

  resolveNegativeIndkomstkilder(values, skadedatoISO)
    .forEach((fund) => {
      if (fund.source.kind !== 'benefit') return;
      rows.push({
        id: `offentligeYdelser.negativSamletYdelse.${fund.source.typeKey}.${fund.periode}`,
        label: fund.source.label,
        displayValue: formatStatusMessage('error', fund.message),
        status: 'error',
        message: fund.message,
        summaryDisplay: 'messageOnly',
        summaryText: fund.message,
        focusTarget: { kind: 'collectionField', template: eoOffentligeYdelserYdelseField.template },
      });
    });

  rows.push(...buildEoMidlertidigtEetKonsistensRows(values, skadedatoISO));

  return rows;
};
