import type { PersistedSectionMap } from '../../../config/persistenceRegistry';
import { isoToDanish } from '../../../types/branded';
import { detectOverlappingPeriods } from '../engines/periodOverlapDetection';
import { buildBeregningsperiodeRange, buildIncomeForRanges } from '../helpers/indtaegtPerioder';
import { isNonEmptyString } from './eoDateRangeMessages';
import type { EoBlockingIssue } from './eoBlockingValidationTypes';

/**
 * Værdi-afledte beregningsgrundlag-blokeringer der KAN sameksistere med en 'ok' snapshot-
 * projektion (dvs. ikke allerede fanget af snapshot-validatoren) og derfor skal med i den
 * autoritative gate, jf. B9: manglende indkomst i beregningsperioden, og
 * beregningsgrundlag-ferieperiodernes komplethed/rækkefølge/overlap/uden-for-periode.
 *
 * Bevidst udeladt (allerede dækket af snapshot-validatoren → projektion 'blocked', så
 * gate-led 1 blokerer): beregningsperiode-komplethed/rækkefølge, TAF↔beregningsperiode-overlap,
 * manglende øvrige-fraværsdage, manglende angivet løn. Verificeret i ækvivalens-værnet.
 *
 * NB (konvergens): dette re-deriverer beslutningen fra `eoDebugTafBeregningsgrundlagRows`'
 * display-/beregnings-sammenfiltrede builder frem for at dele kode med den; en ren udskillelse
 * dér ville sammenblande beslutning og visning/beregning og skade klarhed. Ækvivalens-værnet
 * (`eoBlockingValidationEquivalence.test`) pinner, at de to ikke kan drive fra hinanden — det er
 * re-evaluerings-triggeren, hvis builderen ændres.
 */

type EoValues = PersistedSectionMap['erstatningsopgoerelse'];

export const computeBeregningsgrundlagBlocking = (eoValues: EoValues): readonly EoBlockingIssue[] => {
  if (eoValues.beregnesUdFra !== 'Beregningsperiode') return [];

  const issues: EoBlockingIssue[] = [];
  const periodeFra = eoValues.tafBeregningsperiodeFra;
  const periodeTil = eoValues.tafBeregningsperiodeTil;

  // 1) Ingen indkomst i beregningsperioden.
  const range = buildBeregningsperiodeRange(eoValues);
  if (range) {
    const income = buildIncomeForRanges(eoValues, [range]);
    const hasIncome = income.employers.length > 0 || income.benefits.length > 0;
    if (!hasIncome) {
      const fraDanish = isoToDanish(range.fra);
      const tilDanish = isoToDanish(range.til);
      const message = fraDanish && tilDanish
        ? `Ingen indkomst i beregningsperioden (${fraDanish} - ${tilDanish})`
        : 'Ingen indkomst i beregningsperioden';
      issues.push({ id: 'taf.beregningsgrundlag.indkomst', message });
    }
  }

  // 2) Beregningsgrundlag-ferieperioder (komplethed/rækkefølge/overlap/uden-for-periode).
  const fravaerPerioder = eoValues.fravaerPerioder ?? [];
  const fravaerOverlappingIds = detectOverlappingPeriods(fravaerPerioder);
  const hasValidBeregningsperiodeBounds =
    periodeFra !== undefined && periodeTil !== undefined && periodeFra <= periodeTil;

  for (const periode of fravaerPerioder) {
    const hasFra = isNonEmptyString(periode.fra);
    const hasTil = isNonEmptyString(periode.til);
    const filledCount = [hasFra, hasTil].filter(Boolean).length;
    if (filledCount === 0) continue;
    const id = `taf.beregningsgrundlag.ferie.${periode.id}`;
    if (filledCount !== 2) {
      issues.push({ id, message: 'Ikke alle felter udfyldt' });
      continue;
    }
    const fraISO = periode.fra;
    const tilISO = periode.til;
    if (!fraISO || !tilISO) {
      issues.push({ id, message: 'Ugyldig dato' });
      continue;
    }
    if (fraISO > tilISO) {
      issues.push({ id, message: 'Fra-dato er efter til-dato' });
      continue;
    }
    if (fravaerOverlappingIds.has(periode.id)) {
      issues.push({ id, message: 'Der er overlappende perioder' });
      continue;
    }
    if (hasValidBeregningsperiodeBounds && (fraISO < periodeFra || tilISO > periodeTil)) {
      issues.push({ id, message: 'Ferieperioden ligger uden for beregningsperioden' });
      continue;
    }
  }

  // Bevidst udeladt: TAF↔beregningsperiode-overlap blokerer allerede via snapshot-projektionen.
  return issues;
};
