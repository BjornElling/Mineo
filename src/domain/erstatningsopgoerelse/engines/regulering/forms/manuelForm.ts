import type { ISODateString } from '../../../../../types/branded';
import { amountValueToNumber } from '../../../../../utils/expressionAmount';
import { LOEN_PAA_HELLIGDAGE } from '../../../../../types/loen';
import { STORE_BEDEDAG_START, STORE_BEDEDAG_PCT } from '../../../../../data/indskudteLoentillaeg';
import { hasIndtastetLoenoplysninger } from '../../../helpers/loenoplysningerInput';
import { computePackageValuePct, parsePercentInput, resolveFeriePctForFormula, roundReguleringDeltaPct } from '../../reguleringFormulaUtils';
import { findLatestByDateInSortedList } from '../../reguleringSeriesLookup';
import { assertUniform, buildSegmentsFromStartDates } from '../reguleringFormPrimitives';
import type {
  FormKonsoliderContext,
  KildeReguleringsInterval,
  KonsolideretLoenudvikling,
  LoenreguleringsSegment,
  LoenudviklingManualRow,
  ReguleringForm,
  ReguleringResultat,
  ResolvedStrategi,
} from '../reguleringForm';

// Pct-/ferie-parsing deler nu de KANONISKE parsere (parsePercentInput / resolveFeriePctForFormula i
// reguleringFormulaUtils), som præsentationens manuelle indeks-tabel også bruger — så motor og
// visning kan ikke drive fra hinanden (samme "vist = beregnet"-garanti som R2 giver de migrerede
// former, her opnået ved delt primitiv frem for et forløb, da 'Manuelt angivet' ikke bærer en
// periodeserie). De tidligere lokale kopier (parseManualPercentToPct/resolveManualFeriePctPct) var
// byte-identiske med de kanoniske for alt daværende schema-gyldigt input. Efter schemaernes
// konvergens til syntaksautoritet er range-valideringen afledt, men den delte parser er fortsat
// den eneste vej, så motor og præsentation ikke kan drive fra hinanden.

const normalizeManualRows = (rows: readonly LoenudviklingManualRow[]): string => {
  const normalized = rows.map((row) => ({
    dato: row.dato ?? '',
    grundloen: amountValueToNumber(row.grundloen) ?? null,
    feriepenge: row.feriepenge ?? '',
    shSoSats: row.shSoSats ?? '',
    fritvalg: row.fritvalg ?? '',
    agPension: row.agPension ?? '',
  }));
  return JSON.stringify(normalized);
};

const konsolider = (ctx: FormKonsoliderContext): ResolvedStrategi => {
  const { active, angivetLoen, anvendtReguleringsdato, tafRanges, kraeverFeriePctVedBeregningsperiode, activeMedSynligeSatserOgLoenoplysninger } = ctx;
  assertUniform(active, (af) => normalizeManualRows(af.loenudviklingManuelTableData ?? []), 'manuelle reguleringsraekker');
  if (!angivetLoen) {
    if (activeMedSynligeSatserOgLoenoplysninger.length > 1) {
      assertUniform(
        activeMedSynligeSatserOgLoenoplysninger,
        (af) => (typeof af.feriePct === 'number' ? af.feriePct : null),
        'feriepct'
      );
    }
  }

  const label = active[0].loenudviklingManuelNavn?.trim() || 'Manuelt angivet';

  if (kraeverFeriePctVedBeregningsperiode && active.some((af) =>
    af.tillaegAngivesSom !== 'beloeb' && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []) && typeof af.feriePct !== 'number'
  )) {
    throw new Error('Loenudvikling kan ikke beregnes: feriepct mangler');
  }
  const feriePct = typeof active[0].feriePct === 'number' ? active[0].feriePct : 0;
  return {
    strategi: 'manual',
    label,
    konsolideret: {
      strategi: 'manual',
      label,
      reguleringsdato: anvendtReguleringsdato,
      loenPaaHelligdage: active[0].loenPaaHelligdage ?? '',
      feriePct,
      manualRows: active[0].loenudviklingManuelTableData ?? [],
      tafRanges,
    },
  };
};

const byggResultat = (
  konsolideret: KonsolideretLoenudvikling
): ReguleringResultat => {
  if (konsolideret.strategi !== 'manual') {
    throw new Error('Loenudvikling kan ikke beregnes: manuel strategi mangler');
  }
  const manualRows = konsolideret.manualRows;
  const baseRow = manualRows[0];
  if (!baseRow) {
    throw new Error('Loenudvikling kan ikke beregnes: manuelle reguleringsraekker mangler');
  }
  const baseComponents = {
    grundloen: amountValueToNumber(baseRow.grundloen) ?? 0,
    feriePct: resolveFeriePctForFormula(baseRow.feriepenge, konsolideret.feriePct),
    shSoPct: parsePercentInput(baseRow.shSoSats),
    fritvalgPct: parsePercentInput(baseRow.fritvalg),
    pensionPct: parsePercentInput(baseRow.agPension),
  };
  const resolveStoreBededagPctForManualDate = (iso: ISODateString | undefined): number =>
    konsolideret.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG && iso && iso >= STORE_BEDEDAG_START
      ? STORE_BEDEDAG_PCT
      : 0;

  const basePackage = computePackageValuePct({
    ...baseComponents,
    storeBededagPct: resolveStoreBededagPctForManualDate(konsolideret.reguleringsdato),
  });
  if (!Number.isFinite(basePackage) || basePackage <= 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel basispakke');
  }

  const datedRows = manualRows
    .slice(1)
    .map((row) => {
      const startIso = row.dato;
      if (!startIso) return null;
      // Rækker dateret før reguleringsdatoen indgår ikke i reguleringen (basisrækken
      // repræsenterer allerede lønniveauet pr. reguleringsdatoen). De rapporteres som en
      // ikke-blokerende advarsel i række-evalueringen (eoRowIndkomstRows). Rækker dateret
      // præcis på reguleringsdatoen er tilladt og gælder fra reguleringsdatoen.
      if (konsolideret.reguleringsdato && startIso < konsolideret.reguleringsdato) return null;
      const components = {
        grundloen: amountValueToNumber(row.grundloen) ?? 0,
        feriePct: resolveFeriePctForFormula(row.feriepenge, konsolideret.feriePct),
        shSoPct: parsePercentInput(row.shSoSats),
        fritvalgPct: parsePercentInput(row.fritvalg),
        pensionPct: parsePercentInput(row.agPension),
      };
      const packageValue = computePackageValuePct({
        ...components,
        // Store Bededag korrigeres pr. faktisk TAF-segment i hasStoreBededagSegmenter-grenen nedenfor.
        storeBededagPct: 0,
      });
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel pakkevaerdi');
      }
      return { startIso, packageValue, components };
    })
    .filter((row): row is Readonly<{
      startIso: ISODateString;
      packageValue: number;
      components: Readonly<{ grundloen: number; feriePct: number; shSoPct: number; fritvalgPct: number; pensionPct: number }>;
    }> => Boolean(row))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const hasStoreBededagSegmenter =
    konsolideret.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG &&
    konsolideret.tafRanges.some((range) => range.til >= STORE_BEDEDAG_START);

  const segments: LoenreguleringsSegment[] = [];
  for (const range of konsolideret.tafRanges) {
    const starts = new Set<ISODateString>();
    for (const row of datedRows) {
      if (row.startIso > range.fra && row.startIso <= range.til) starts.add(row.startIso);
    }
    if (hasStoreBededagSegmenter && range.fra < STORE_BEDEDAG_START && range.til >= STORE_BEDEDAG_START) {
      starts.add(STORE_BEDEDAG_START);
    }
    for (const segment of buildSegmentsFromStartDates(range, starts)) {
      const segmentRow = findLatestByDateInSortedList(datedRows, segment.fra, 'manual:segment');
      const packageValue = hasStoreBededagSegmenter
        ? computePackageValuePct({
            ...(segmentRow ? segmentRow.components : baseComponents),
            storeBededagPct: resolveStoreBededagPctForManualDate(segment.fra),
          })
        : (segmentRow ? segmentRow.packageValue : basePackage);
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel segmentvaerdi');
      }
      segments.push({
        ...segment,
        deltaPct: roundReguleringDeltaPct((packageValue / basePackage - 1) * 100),
      });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen manuelle segmenter');
  }
  // 'Manuelt angivet' emitterer bevidst INTET `forloeb`: præsentationen re-deriverer forløbet af de indtastede
  // rækker via display-parserne, så et emitteret forløb ville være en anden kilde til samme visning.
  return { segmenter: segments };
};

// De manuelle modeller har intet kilde-interval — dækningen afhænger af reguleringsdatoen og
// de indtastede rækker (håndteres lokalt af row-gaten).
const coverageInterval = (): KildeReguleringsInterval | undefined => undefined;

export const manuelForm: ReguleringForm = {
  id: 'Manuelt angivet',
  strategi: 'manual',
  konsolider,
  byggResultat,
  coverageInterval,
};
