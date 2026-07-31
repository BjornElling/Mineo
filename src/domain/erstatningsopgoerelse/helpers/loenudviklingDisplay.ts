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
