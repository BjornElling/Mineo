import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { resolveOverenskomstDisplay } from '../../../data/overenskomstRates';
import { formatKRLSatstabelDisplay } from '../../../data/krlRates';

export const resolveValgtReguleringDisplay = (
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): string => {
  const grundlag = ansaettelsesforhold.loenudviklingBeregningsgrundlag;
  if (!grundlag) return '-';
  if (grundlag === 'Statistik') return ansaettelsesforhold.loenudviklingStatistikModel?.trim() || '-';
  if (grundlag === 'Overenskomst') return resolveOverenskomstDisplay(ansaettelsesforhold.overenskomstId);
  if (grundlag === 'Manuelt angivet') {
    const manuelNavn = ansaettelsesforhold.loenudviklingManuelNavn?.trim() ?? '';
    return manuelNavn !== '' ? `Manuelt angivet (${manuelNavn})` : 'Manuelt angivet';
  }
  if (grundlag === 'Manuel procentsats') return 'Manuel procentsats';
  if (grundlag === 'KRL satstabel') {
    const krlId = ansaettelsesforhold.loenudviklingKRLSatstabel;
    if (!krlId) return '-';
    return formatKRLSatstabelDisplay(krlId);
  }
  if (grundlag === 'KL-lønaftaler') return 'KL-lønaftaler';
  return 'Ingen';
};

export const resolveValgtReguleringDisplayForPdf = (
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): string => {
  if (ansaettelsesforhold.loenudviklingBeregningsgrundlag !== 'Manuelt angivet') {
    return resolveValgtReguleringDisplay(ansaettelsesforhold);
  }

  const manuelNavn = ansaettelsesforhold.loenudviklingManuelNavn?.trim() ?? '';
  return manuelNavn !== '' ? manuelNavn : 'Manuelt angivet';
};

/**
 * Reguleringsgrundlagets navn i en sætning om dets satser («… den første sats i SBLON2, som er fra …»). Statistikkens
 * og satstabellens kildeangivelse i parentes udelades, så sætningen ikke får to parenteser efter hinanden (BB-306).
 */
export const resolveReguleringskildeNavn = (
  ansaettelsesforhold: Pick<
    ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
    'loenudviklingBeregningsgrundlag' | 'loenudviklingStatistikModel' | 'overenskomstId' | 'loenudviklingKRLSatstabel'
  >
): string => {
  switch (ansaettelsesforhold.loenudviklingBeregningsgrundlag) {
    case 'Statistik':
      return (ansaettelsesforhold.loenudviklingStatistikModel ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim() || 'statistikken';
    case 'Overenskomst':
      return resolveOverenskomstDisplay(ansaettelsesforhold.overenskomstId);
    case 'KRL satstabel':
      return ansaettelsesforhold.loenudviklingKRLSatstabel
        ? formatKRLSatstabelDisplay(ansaettelsesforhold.loenudviklingKRLSatstabel)
        : 'KRL-satstabellen';
    case 'KL-lønaftaler':
      return 'KL-lønaftalerne';
    default:
      return 'reguleringsgrundlaget';
  }
};
