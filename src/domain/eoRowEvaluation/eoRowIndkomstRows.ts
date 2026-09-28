import type { ISODateString } from '../../types/branded';
import { isoToDanish, dateToISO, isISODateString } from '../../types/branded';
import { amountValueToNumber } from '../../utils/expressionAmount';
import type { EoRowModel, EoRowStatus } from './eoRowTypes';
import type { FieldIssue } from '../../inputCore/inputIssue';
import { isOffentligOverenskomstId } from '../../data/overenskomstRates';
import { resolveKildeReguleringsIntervalIso } from '../erstatningsopgoerelse/helpers/reguleringKildeCoverage';
import { resolveOffentligLoenTypeFromLabel, toLoentrin } from '../../data/offentligLoenTypes';
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
import { resolveValgtReguleringDisplay } from '../erstatningsopgoerelse/helpers/loenudviklingDisplay';
import {
  resolveAnvendtReguleringsdatoReferenceText,
  resolveSkadeEllerAnmeldelsesdatoReference,
} from '../erstatningsopgoerelse/helpers/eoDateReferenceText';
import { buildIndkomstSectionStatuses, buildOffentligeYdelserStatusRows } from './eoRowIndkomstModel';
import { parseAarsloenRowInterval } from '../aarsloen/aarsloenRowInterval';
import { DEFAULT_EO_ROW_POLICY, type EoRowPolicy } from '../../settings/sourceSettings';
import type { ErstatningsopgoerelseValues, ReguleringsRange } from './eoRowShared';
import { formatStatusMessage, getRangeForManualRegulering, calculateElapsedWholeMonths, buildReguleringsMangelMessage } from './eoRowShared';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds, resolveMidlertidigEetDato } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import { resolveYdelsestype } from '../../data/ydelsestyper';
import { eoEmploymentFields } from '../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { buildTafRanges } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import { STORE_BEDEDAG_START } from '../../data/indskudteLoentillaeg';
import { resolveManualRegulationIssue } from './eoManualRegulationIssue';

const resolveLoenindkomstTableInputIssue = (
  issues: Readonly<Record<string, FieldIssue>> | undefined,
  employmentId: string,
): FieldIssue | undefined => issues?.[employmentId];

/**
 * Advarslen om et fravalgt Store Bededagstillæg (ordlyd godkendt af udvikleren).
 *
 * Den bor i række-kanalen og IKKE i `erstatningsopgoerelseValidator`: «Fejl og advarsler» på
 * EO-beregningsfanen fodres udelukkende af `collectAllEoRows`, så en `severity: 'warning'` fra
 * validatoren blev aldrig vist for brugeren.
 */
const STORE_BEDEDAGSTILLAEG_FRAVALGT_ADVARSEL =
  'Der vil sædvanligvis være krav på Store Bededagstillæg fra 1. januar 2024 ved almindelig løn på helligdage.';

/**
 * Er der midlertidigt EET blandt de offentlige ydelser? Enten indsættes det fra Erhvervsevnetab-siden
 * (togglen erstatter da de manuelle rækker helt, jf. domain-boundary-contract §10), eller der er en manuel
 * række med et beløb. Ydelsestypen slås op gennem `resolveYdelsestype`, fordi ældre filer kan bære den
 * viste label i stedet for nøglen.
 */
const harMidlertidigtEetYdelser = (values: ErstatningsopgoerelseValues): boolean => {
  if (values.midlertidigtEetFraEetSiden === 'Ja') return true;
  return (values.offentligeYdelserRows ?? []).some((row) => {
    if (resolveYdelsestype(row.ydelsestype ?? '')?.key !== 'midlertidigt_eet') return false;
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

const resolveTafBoundaryDatesInSkadetPeriode = (
  values: ErstatningsopgoerelseValues
): Readonly<{ first?: ISODateString; last?: ISODateString }> => {
  const periodeTil = isISODateString(values.vedroererPeriodeTil) ? values.vedroererPeriodeTil : undefined;
  if (!periodeTil) return {};
  const periodeFra = isISODateString(values.vedroererPeriodeFra) ? values.vedroererPeriodeFra : undefined;
  const periodRange = periodeFra && periodeFra <= periodeTil ? { fra: periodeFra, til: periodeTil } : null;

  let first: ISODateString | undefined;
  let last: ISODateString | undefined;

  for (const row of values.tafPerioder ?? []) {
    if (!isISODateString(row.fra) || !isISODateString(row.til)) continue;
    if (row.fra > row.til) continue;

    if (periodRange) {
      if (row.til < periodRange.fra || row.fra > periodRange.til) continue;
      const firstCandidate = row.fra < periodRange.fra ? periodRange.fra : row.fra;
      const lastCandidate = row.til > periodRange.til ? periodRange.til : row.til;
      if (!first || firstCandidate < first) first = firstCandidate;
      if (!last || lastCandidate > last) last = lastCandidate;
      continue;
    }

    if (!first || row.fra < first) first = row.fra;
    if (!last || row.til > last) last = row.til;
  }

  return { first, last };
};

export const buildEoIndkomstRows = (
  values: ErstatningsopgoerelseValues,
  skadedato: ISODateString | undefined,
  manualReguleringInputErrors: Readonly<Record<string, true>> = {},
  rowPolicy: EoRowPolicy = DEFAULT_EO_ROW_POLICY,
  skadestype?: 'Arbejdsulykke' | 'Erhvervssygdom',
  loenindkomstTableInputIssues?: Readonly<Record<string, FieldIssue>>,
): EoRowModel[] => {
  const rows: EoRowModel[] = [];
  const allowIncompleteOverenskomst = rowPolicy.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden;
  const overenskomstUdloebMaanederGraense = rowPolicy.allowReguleringMedUdloebMedMaaneder;
  const tafBoundaryDates = resolveTafBoundaryDatesInSkadetPeriode(values);
  const skadeEllerAnmeldelsesdato = resolveSkadeEllerAnmeldelsesdatoReference(skadestype);

  const sections = buildIndkomstSectionStatuses(values);
  sections.forEach((section) => {
    const employment = (values.loenindkomstAnsaettelsesforhold ?? []).find((item) => item.id === section.id);
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

    rows.push({
      id: `loenindkomst.${section.id}.satserSkadestidspunkt`,
      employmentId: section.id,
      label: `Satser på ${skadeEllerAnmeldelsesdato.labelLower}`,
      displayValue: section.satserStatus === 'ok' ? 'Ja' : formatStatusMessage(section.satserStatus, section.satserMessage),
      status: section.satserStatus,
    });

    rows.push({
      id: `loenindkomst.${section.id}.loenoplysninger`,
      employmentId: section.id,
      label: 'Alle lønoplysninger indtastet korrekt',
      displayValue: section.tableStatus === 'ok' ? 'Ja' : formatStatusMessage(section.tableStatus, section.tableMessage),
      status: section.tableStatus,
      summaryDisplay: 'messageOnly',
    });

    if (employment?.ansaettelsesforholdOphoert === true && !sidsteArbejdsdag) {
      const message = 'Det angives, at skadelidte er opsagt, men sidste arbejdsdag er ikke indtastet';
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
        displayValue: `Advarsel (Der er angivet løn efter sidste arbejdsdag (${isoToDanish(sidsteArbejdsdag)}). Kontrollér om dette er korrekt.)`,
        status: 'warning',
        summaryDisplay: 'messageOnly',
      });
    }
  });

  const loenudviklingsKilde = resolveLoenudviklingKilde(values);

  // Store Bededagstillægget indgår i lønpakken fra 1. januar 2024, uanset reguleringsform. Advarslen
  // er derfor kun tidsafgrænset: den vises, når en (færdigclampet) TAF-periode når ind i 2024.
  const harTafPeriodeFraStoreBededag = buildTafRanges(values, { skadedatoISO: skadedato })
    .some((range) => range.til >= STORE_BEDEDAG_START);

  loenudviklingsKilde.forEach((ansaettelsesforhold) => {
    const erBeregningsperiode = values.beregnesUdFra === 'Beregningsperiode';
    const loenudviklingRowPrefix = erBeregningsperiode
      ? `loenindkomst.${ansaettelsesforhold.id}.regulering`
      : `taf.beregningsgrundlag.loenudvikling.${ansaettelsesforhold.id}`;

    // BEVIDST før enhver early return herunder: advarslen er uafhængig af, om reguleringen er
    // færdigopsat (udviklerbeslutning 2026-09-13). Den skal kunne ses, også mens ansættelsesforholdet
    // har en blokerende reguleringsfejl – ellers kan brugeren nå at rette fejlen og downloade uden
    // nogensinde at have set advarslen.
    if (
      harTafPeriodeFraStoreBededag
      && ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn'
      && ansaettelsesforhold.beregnStoreBededagstillaeg !== true
    ) {
      rows.push({
        id: erBeregningsperiode
          ? `loenindkomst.${ansaettelsesforhold.id}.storeBededagstillaegFravalgt`
          : `taf.beregningsgrundlag.loenudvikling.${ansaettelsesforhold.id}.storeBededagstillaegFravalgt`,
        ...(erBeregningsperiode ? { employmentId: ansaettelsesforhold.id } : {}),
        label: 'Advarsel',
        displayValue: `Advarsel (${STORE_BEDEDAGSTILLAEG_FRAVALGT_ADVARSEL})`,
        status: 'warning',
        summaryDisplay: 'messageOnly',
      });
    }

    const loenudviklingBasis = ansaettelsesforhold.loenudviklingBeregningsgrundlag;
    let status: EoRowStatus = 'ok';
    let message = '-';

    if (!loenudviklingBasis) {
      status = 'error';
      message = 'Lønudvikling beregnes ud fra er ikke valgt';
    } else if (loenudviklingBasis === 'Overenskomst' && !ansaettelsesforhold.overenskomstId) {
      status = 'error';
      message = 'Overenskomst er ikke valgt';
    } else if (loenudviklingBasis === 'Statistik' && !ansaettelsesforhold.loenudviklingStatistikModel) {
      status = 'error';
      message = 'Statistisk beregningsmodel er ikke valgt';
    } else if (loenudviklingBasis === 'KRL satstabel' && !ansaettelsesforhold.loenudviklingKRLSatstabel) {
      status = 'error';
      message = 'KRL satstabel er ikke valgt';
    }

    const valgtReguleringRowId = `${loenudviklingRowPrefix}.valgt`;
    rows.push({
      id: valgtReguleringRowId,
      label: 'Valgt regulering',
      displayValue: status === 'ok' ? 'Ja' : formatStatusMessage(status, message),
      status,
      message: status === 'ok' ? undefined : message,
    });
    const harGyldigValgtRegulering = status === 'ok';
    if (!harGyldigValgtRegulering) {
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
      const typeLabel = ansaettelsesforhold.offentligLoenType;
      const trinValue = ansaettelsesforhold.offentligLoenTrin;
      const gruppeValue = ansaettelsesforhold.offentligLoenGruppe;

      let offentligStatus: EoRowStatus = 'ok';
      let offentligMessage = '';

      if (!typeLabel || !resolveOffentligLoenTypeFromLabel(typeLabel)) {
        offentligStatus = 'error';
        offentligMessage = 'Ansættelse er ikke valgt';
      } else if (typeof trinValue !== 'number') {
        offentligStatus = 'error';
        offentligMessage = 'Løntrin er ikke angivet';
      } else {
        try {
          toLoentrin(trinValue);
        } catch {
          offentligStatus = 'error';
          offentligMessage = 'Løntrin skal være mellem 1 og 55';
        }
      }

      if (offentligStatus === 'ok') {
        if (typeof gruppeValue !== 'number') {
          offentligStatus = 'error';
          offentligMessage = 'Gruppe er ikke valgt';
        } else if (gruppeValue < 0 || gruppeValue > 4) {
          offentligStatus = 'error';
          offentligMessage = 'Gruppe skal være mellem 0 og 4';
        }
      }

      const offentligDisplayValue =
        offentligStatus === 'ok'
          ? `${typeLabel}, løntrin ${String(trinValue)}, gruppe ${String(gruppeValue)}`
          : formatStatusMessage('error', offentligMessage);

      rows.push({
        id: offentligtRowId,
        label: 'KL-/RLTN-oplysninger',
        displayValue: offentligDisplayValue,
        status: offentligStatus,
        dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
      });
    }

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

    const alleReguleringsvaerdierRow = (() => {
      if (loenudviklingBasis === 'Ingen') {
        return { displayValue: 'Ingen', status: 'ok' as EoRowStatus, focusTarget: undefined };
      }
      if (!loenudviklingBasis) {
        return { displayValue: 'Nej', status: 'error' as EoRowStatus, focusTarget: undefined };
      }
      if (loenudviklingBasis !== 'Manuelt angivet' && loenudviklingBasis !== 'Manuel procentsats') {
        return { displayValue: 'Ja', status: 'ok' as EoRowStatus, focusTarget: undefined };
      }

      const manualIssue = resolveManualRegulationIssue(
        ansaettelsesforhold,
        loenudviklingBasis,
        erBeregningsperiode,
      );
      const inputIssue = erBeregningsperiode
        ? resolveLoenindkomstTableInputIssue(loenindkomstTableInputIssues, ansaettelsesforhold.id)
        : undefined;
      const inputIssueFocusTarget = inputIssue
        ? { kind: 'fieldAddress' as const, address: inputIssue.field.address }
        : undefined;
      const focusTarget = inputIssueFocusTarget ?? manualIssue?.focusTarget;
      const manualIssueMessage = inputIssue
        ? `Manuel regulering: ${inputIssue.field.descriptor.label}`
        : manualIssue?.message ?? 'Værdier mangler at blive udfyldt for manuel regulering';

      if (manualReguleringInputErrors[ansaettelsesforhold.id]) {
        return {
          displayValue: formatStatusMessage('error', 'Ugyldig indtastning'),
          message: manualIssueMessage,
          focusTarget,
          status: 'error' as EoRowStatus,
        };
      }

      if (loenudviklingBasis === 'Manuel procentsats') {
        const procentsatsRows = (ansaettelsesforhold.loenudviklingManuelProcentsatsTableData ?? []).slice(1);
        const aktiveRows = procentsatsRows.filter(isManuelProcentsatsRowAktiv);
        const ok = aktiveRows.every(isManuelProcentsatsRowKomplet);
        return {
          displayValue: ok ? 'Ja' : 'Nej',
          message: ok ? undefined : manualIssue?.message ?? 'Værdier mangler at blive udfyldt for manuel regulering',
          focusTarget: ok ? undefined : focusTarget,
          status: ok ? 'ok' : 'error' as EoRowStatus,
        };
      }

      const manuelRows = ansaettelsesforhold.loenudviklingManuelTableData ?? [];

      const aktiveRows = manuelRows.filter(isManuelAngivetRowAktiv);

      if (aktiveRows.length === 0) {
        return {
          displayValue: 'Nej',
          message: manualIssue?.message ?? 'Værdier mangler at blive udfyldt for manuel regulering',
          focusTarget,
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
        focusTarget: ok ? undefined : focusTarget,
        status: ok ? 'ok' : 'error' as EoRowStatus,
      };
    })();

    if (loenudviklingBasis !== 'Ingen') {
      rows.push({
        id: `${loenudviklingRowPrefix}.alleVaerdier`,
        label: 'Alle reguleringsværdier udfyldt',
        displayValue: alleReguleringsvaerdierRow.displayValue,
        message: alleReguleringsvaerdierRow.message,
        summaryDisplay: alleReguleringsvaerdierRow.status === 'error' && !!alleReguleringsvaerdierRow.message
          ? 'messageOnly'
          : undefined,
        status: alleReguleringsvaerdierRow.status,
        focusTarget: alleReguleringsvaerdierRow.focusTarget,
        dependsOn: [{ kind: 'id', id: valgtReguleringRowId }],
      });
    }

    const showReguleringDetails =
      harGyldigValgtRegulering &&
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
      if (loenudviklingBasis === 'Manuelt angivet') {
        return getRangeForManualRegulering(anvendtReguleringsdato, ansaettelsesforhold.loenudviklingManuelTableData ?? []);
      }
      if (loenudviklingBasis === 'Manuel procentsats') {
        return {
          min: anvendtReguleringsdato,
          max: tafBoundaryDates.last ?? anvendtReguleringsdato,
        };
      }
      return {} as ReguleringsRange;
    })();

    const reguleringsvaerdiRowStatus = (() => {
      if (!anvendtReguleringsdato) return { displayValue: '-', status: 'error' as EoRowStatus };
      if (!reguleringsRange.min) {
        return {
          displayValue: 'Nej',
          status: allowIncompleteOverenskomst ? 'warning' as EoRowStatus : 'error' as EoRowStatus,
        };
      }
      if (anvendtReguleringsdato < reguleringsRange.min) {
        return {
          displayValue: `Nej (først fra ${isoToDanish(reguleringsRange.min) ?? reguleringsRange.min})`,
          status: allowIncompleteOverenskomst ? 'warning' as EoRowStatus : 'error' as EoRowStatus,
        };
      }
      return { displayValue: 'Ja', status: 'ok' as EoRowStatus };
    })();

    const startDateRowStatus = (() => {
      const tafStartIso = tafBoundaryDates.first;
      if (!tafStartIso || !reguleringsRange.min) return { displayValue: '-', status: 'error' as EoRowStatus };
      if (reguleringsRange.min <= tafStartIso) return { displayValue: 'Ja', status: 'ok' as EoRowStatus };
      return {
        displayValue: `Nej (først fra ${isoToDanish(reguleringsRange.min) ?? reguleringsRange.min})`,
        status: allowIncompleteOverenskomst ? 'warning' as EoRowStatus : 'error' as EoRowStatus,
      };
    })();

    const endDateRowStatus = (() => {
      const tafEndIso = tafBoundaryDates.last;
      if (!tafEndIso || !reguleringsRange.max) return { displayValue: '-', status: 'error' as EoRowStatus };
      if (reguleringsRange.max >= tafEndIso) return { displayValue: 'Ja', status: 'ok' as EoRowStatus };

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
        };
      }

      return {
        displayValue: `Nej (kun indtil ${isoToDanish(reguleringsRange.max) ?? reguleringsRange.max})`,
        status: allowIncompleteOverenskomst ? 'warning' as EoRowStatus : 'error' as EoRowStatus,
      };
    })();
    const harTafDatointerval = Boolean(tafBoundaryDates.first && tafBoundaryDates.last);

    rows.push({
      id: `${loenudviklingRowPrefix}.reguleringsvaerdi`,
      label: `Reguleringsværdi på ${anvendtReguleringsdatoReferenceText} for TAF`,
      displayValue: reguleringsvaerdiRowStatus.displayValue,
      status: reguleringsvaerdiRowStatus.status,
      message: buildReguleringsMangelMessage(
        reguleringsvaerdiRowStatus.status,
        reguleringsvaerdiRowStatus.displayValue
      ),
      dependsOn: [{ kind: 'id', id: `${loenudviklingRowPrefix}.alleVaerdier` }],
    });

    if (harTafDatointerval) {
      rows.push({
        id: `${loenudviklingRowPrefix}.startvaerdi`,
        label: 'Reguleringsværdi på start-dato for TAF',
        displayValue: startDateRowStatus.displayValue,
        status: startDateRowStatus.status,
        message: buildReguleringsMangelMessage(
          startDateRowStatus.status,
          startDateRowStatus.displayValue
        ),
        dependsOn: [{ kind: 'id', id: `${loenudviklingRowPrefix}.alleVaerdier` }],
      });

      rows.push({
        id: `${loenudviklingRowPrefix}.slutvaerdi`,
        label: 'Reguleringsværdi på slut-dato for TAF',
        displayValue: endDateRowStatus.displayValue,
        status: endDateRowStatus.status,
        message: buildReguleringsMangelMessage(
          endDateRowStatus.status,
          endDateRowStatus.displayValue
        ),
        dependsOn: [{ kind: 'id', id: `${loenudviklingRowPrefix}.alleVaerdier` }],
      });

      // Samlet, ikke-blokerende advarsel når reguleringskilden ikke dækker hele TAF-perioden, men
      // hullet er tolereret (start/slut-status er 'warning', ikke blokerende 'error'). De tekniske
      // start/slut-rækker ovenfor bevares; denne række giver den samlede, brugervendte formulering.
      const daekningStartWarning = startDateRowStatus.status === 'warning';
      const daekningSlutWarning = endDateRowStatus.status === 'warning';
      if (daekningStartWarning || daekningSlutWarning) {
        const startDato = reguleringsRange.min ? (isoToDanish(reguleringsRange.min) ?? reguleringsRange.min) : undefined;
        const slutDato = reguleringsRange.max ? (isoToDanish(reguleringsRange.max) ?? reguleringsRange.max) : undefined;
        const detaljer = [
          daekningStartWarning && startDato ? `først fra ${startDato}` : undefined,
          daekningSlutWarning && slutDato ? `kun til og med ${slutDato}` : undefined,
        ].filter((part): part is string => Boolean(part));
        if (detaljer.length > 0) {
          rows.push({
            id: `${loenudviklingRowPrefix}.daekningAdvarsel`,
            label: 'Advarsel',
            displayValue: `Advarsel (Der er ikke reguleringsværdier for hele TAF-perioden – ${detaljer.join(' og ')}.)`,
            status: 'warning',
            summaryDisplay: 'messageOnly',
            dependsOn: [{ kind: 'id', id: `${loenudviklingRowPrefix}.alleVaerdier` }],
          });
        }
      }
    }
  });

  return rows;
};

export const buildEoOffentligeYdelserRows = (
  values: ErstatningsopgoerelseValues,
  skadedatoISO?: ISODateString
): EoRowModel[] => {
  const rows: EoRowModel[] = [];
  const statusRows = buildOffentligeYdelserStatusRows(values.offentligeYdelserRows ?? []);

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
      ...(row.sourceRowId === undefined
        ? {}
        : { focusTarget: { kind: 'rowId' as const, rowId: row.sourceRowId } }),
    });
  });

  rows.push(...buildEoMidlertidigtEetKonsistensRows(values, skadedatoISO));

  return rows;
};
