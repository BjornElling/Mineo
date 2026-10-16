import { resolveAnvendtReguleringsdato } from '../erstatningsopgoerelse/helpers/eoSharedUtils';
import { getAngivetLoenOpreguleresFraDato } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { IndeksEntry, RegulationIndexTimeline } from './eoInspektionRegulationTypes';
import type { LoenudviklingModel } from '../erstatningsopgoerelse/shared/eoTypes';
import { computeTafBeregningsenhed } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { resolveLoenudviklingKilde } from '../erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { resolveValgtReguleringDisplay } from '../erstatningsopgoerelse/helpers/loenudviklingDisplay';
import { resolveLoenudviklingSegmenterForKilde } from '../erstatningsopgoerelse/engines/reguleringsPresentation';
import { formatKRLSatstabelDisplay } from '../../data/krlRates';

export type RegulationCoreInput = Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
  loenudvikling: LoenudviklingModel | null;
}>;

/**
 * Kontrollens udvalg og værdier kommer fra motorens beregnede segmenter. EO-perioden kan være længere
 * end TAF uden at kræve nye satsopslag, og kontrolvisningen kan aldrig opfinde sit eget beregningsresultat.
 */
export function buildRegulationTimeline(input: RegulationCoreInput): RegulationIndexTimeline {
  const tafBeregningsenhed = computeTafBeregningsenhed(input.eoValues);
  const ansaettelser = resolveLoenudviklingKilde(input.eoValues).flatMap((af) => {
    if (!af.loenudviklingBeregningsgrundlag || af.loenudviklingBeregningsgrundlag === 'Ingen') return [];
    const segments = resolveLoenudviklingSegmenterForKilde({
      perAnsaettelse: input.loenudvikling?.perAnsaettelse ?? [],
      globaleSegmenter: input.loenudvikling?.beregnedeSegmenter ?? [],
      ansaettelsesforholdId: af.id,
    });
    const reference = segments.find((segment) => segment.regulering?.referenceDate)?.regulering;
    if (!reference?.referenceDate) return [];
    const referenceIso = resolveAnvendtReguleringsdato({
      beregnesUdFra: input.eoValues.beregnesUdFra,
      angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(input.eoValues),
      saerligFraDatoRegulering: af.saerligFraDatoRegulering,
      beregningsperiodeTil: input.eoValues.tafBeregningsperiodeTil,
      skadedato: input.stamdataValues.skadedato,
    });
    if (!referenceIso) return [];
    const entries: IndeksEntry[] = segments.flatMap((segment) => {
      const bevis = segment.regulering;
      if (!bevis) return [];
      const components = bevis.periodComponents;
      return [{
        effectiveFrom: segment.fra,
        grundloen: components?.baseValue ?? bevis.periodValue,
        feriePct: (components?.feriePct ?? 0) / 100,
        shSoPct: (components?.shSoPct ?? 0) / 100,
        fritvalgPct: (components?.fritvalgPct ?? 0) / 100,
        storeBededagPct: (components?.storeBededagPct ?? 0) / 100,
        pensionPct: (components?.pensionPct ?? 0) / 100,
        packageValue: bevis.periodValue,
        index: 100 + bevis.appliedDeltaPct,
        arbejdsdage: segment.kind === 'arbejdsdage' ? segment.arbejdsdage : null,
        maaneder: segment.kind === 'maaneder' ? segment.maaneder : null,
      }];
    });
    const grundlag = af.loenudviklingBeregningsgrundlag;
    return [{
      ansaettelsesforholdId: af.id,
      navn: af.navnPaaArbejdssted,
      kildeLabel: grundlag === 'Overenskomst' ? 'Overenskomst'
        : grundlag === 'Statistik' ? 'Statistikmodel'
          : grundlag === 'KRL satstabel' ? 'KRL satstabel'
            : grundlag === 'KL-lønaftaler' ? 'KL-lønaftaler' : 'Navn på reguleringsform',
      kildeVaerdi: grundlag === 'KRL satstabel'
        ? formatKRLSatstabelDisplay(af.loenudviklingKRLSatstabel ?? '') : resolveValgtReguleringDisplay(af),
      ...(af.overenskomstId ? { overenskomstId: af.overenskomstId } : {}),
      referenceIso,
      referenceValue: reference.referenceValue,
      entries,
    }];
  });
  return { tafBeregningsenhed, ansaettelser };
}
