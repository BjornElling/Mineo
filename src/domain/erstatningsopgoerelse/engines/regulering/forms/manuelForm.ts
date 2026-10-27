import { buildReguleringsbevis } from '../reguleringsbevis';
import type { IsoRange } from '../../../helpers/indtaegtPerioder';
import type { ISODateString } from '../../../../../types/branded';
import { amountValueToNumber } from '../../../../../utils/expressionAmount';
import { STORE_BEDEDAG_START } from '../../../../../data/indskudteLoentillaeg';
import {
  harValgtStoreBededagstillaeg,
  resolveStoreBededagstillaegPct,
} from '../../../../loen/storeBededagstillaeg';
import { hasIndtastetLoenoplysninger } from '../../../helpers/loenoplysningerInput';
import { computePackageValuePct, parsePercentInput, resolveFeriePctForFormula } from '../../reguleringFormulaUtils';
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

// Beregningsgrundlag og formelkomponenter emitteres sammen, så visninger ikke vælger satser igen.

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
  // En skjult toggle er ikke en beregningsindstilling. Sammenlign derfor kun den effektive værdi, så
  // tidligere skjulte true/false-værdier ikke kan blokere en ellers gyldig lønudvikling.
  assertUniform(active, (af) => harValgtStoreBededagstillaeg(af), 'Store Bededagstillæg');
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
      beregnStoreBededagstillaeg: active[0].beregnStoreBededagstillaeg,
      feriePct,
      manualRows: active[0].loenudviklingManuelTableData ?? [],
      tafRanges,
    },
  };
};

const byggResultat = (
  konsolideret: KonsolideretLoenudvikling,
  segmentRanges: readonly IsoRange[] = konsolideret.tafRanges
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
    resolveStoreBededagstillaegPct(iso, konsolideret);

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
      // Gaten gør disse rækker røde; motoren afviser dem også defensivt, så to reguleringer aldrig
      // kan få samme eller omvendt kronologisk basisanker.
      if (konsolideret.reguleringsdato && startIso <= konsolideret.reguleringsdato) return null;
      const components = {
        grundloen: amountValueToNumber(row.grundloen) ?? 0,
        feriePct: resolveFeriePctForFormula(row.feriepenge, konsolideret.feriePct),
        shSoPct: parsePercentInput(row.shSoSats),
        fritvalgPct: parsePercentInput(row.fritvalg),
        pensionPct: parsePercentInput(row.agPension),
      };
      const packageValue = computePackageValuePct({
        ...components,
        // Store Bededag tilføjes efter den konkrete opslagdato nedenfor.
        storeBededagPct: 0,
      });
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel pakkevaerdi');
      }
      return { startIso, components };
    })
    .filter((row): row is Readonly<{
      startIso: ISODateString;
      components: Readonly<{ grundloen: number; feriePct: number; shSoPct: number; fritvalgPct: number; pensionPct: number }>;
    }> => Boolean(row))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const segments: LoenreguleringsSegment[] = [];
  for (const range of segmentRanges) {
    const starts = new Set<ISODateString>();
    for (const row of datedRows) {
      if (row.startIso > range.fra && row.startIso <= range.til) starts.add(row.startIso);
    }
    if (harValgtStoreBededagstillaeg(konsolideret) && range.fra < STORE_BEDEDAG_START && range.til >= STORE_BEDEDAG_START) {
      starts.add(STORE_BEDEDAG_START);
    }
    for (const segment of buildSegmentsFromStartDates(range, starts)) {
      const segmentRow = findLatestByDateInSortedList(datedRows, segment.fra, 'manual:segment');
      // Datoens niveau skal også gælde ved SFGG-opslag uden for TAF-perioden.
      const packageValue = computePackageValuePct({
        ...(segmentRow ? segmentRow.components : baseComponents),
        storeBededagPct: resolveStoreBededagPctForManualDate(segment.fra),
      });
      if (!Number.isFinite(packageValue) || packageValue <= 0) {
        throw new Error('Loenudvikling kan ikke beregnes: ugyldig manuel segmentvaerdi');
      }
      const referenceComponents = {
        ...baseComponents, baseValue: baseComponents.grundloen,
        storeBededagPct: resolveStoreBededagPctForManualDate(konsolideret.reguleringsdato),
      };
      const selectedComponents = segmentRow?.components ?? baseComponents;
      const periodComponents = {
        ...selectedComponents, baseValue: selectedComponents.grundloen,
        storeBededagPct: resolveStoreBededagPctForManualDate(segment.fra),
      };
      const { grundloen: _referenceGrundloen, ...referenceFormula } = referenceComponents;
      const { grundloen: _periodGrundloen, ...periodFormula } = periodComponents;
      const regulering = buildReguleringsbevis(basePackage, packageValue, {
        kind: 'pakke', referenceDate: konsolideret.reguleringsdato,
        periodRateDate: [segmentRow?.startIso ?? konsolideret.reguleringsdato,
          harValgtStoreBededagstillaeg(konsolideret) && segment.fra >= STORE_BEDEDAG_START ? STORE_BEDEDAG_START : undefined,
        ].filter((date): date is ISODateString => date !== undefined).sort().at(-1),
        referenceComponents: referenceFormula, periodComponents: periodFormula,
      });
      segments.push({ ...segment, deltaPct: regulering.appliedDeltaPct, regulering });
    }
  }
  if (segments.length === 0) {
    throw new Error('Loenudvikling kan ikke beregnes: ingen manuelle segmenter');
  }
  return { segmenter: segments };
};

// De manuelle modeller har intet kilde-interval – dækningen afhænger af reguleringsdatoen og
// de indtastede rækker (håndteres lokalt af row-gaten).
const coverageInterval = (): KildeReguleringsInterval | undefined => undefined;

export const manuelForm: ReguleringForm = {
  id: 'Manuelt angivet',
  strategi: 'manual',
  konsolider,
  byggResultat,
  coverageInterval,
};
