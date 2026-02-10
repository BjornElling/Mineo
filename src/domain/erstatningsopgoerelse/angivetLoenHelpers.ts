import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { LOENPERIODE } from '../../types/common';

export const EO_ANGIVET_LOEN_ID = 'eo-angivet-loen';

export type LoenudviklingSource = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

export const getAngivetLoenBaseretPaa = (
  values: ErstatningsopgoerelseValues
): string | undefined => {
  if (values.beregnesUdFra === 'Angivet månedsløn') return values.angivetMaanedsloenBaseretPaa;
  if (values.beregnesUdFra === 'Angivet dagsløn') return values.angivetDagsloenBaseretPaa;
  return undefined;
};

export const getAngivetLoenOpreguleresFraDato = (
  values: ErstatningsopgoerelseValues
): ISODateString | undefined => {
  if (values.beregnesUdFra === 'Angivet månedsløn') return values.angivetMaanedsloenOpreguleresFraDato;
  if (values.beregnesUdFra === 'Angivet dagsløn') return values.angivetDagsloenOpreguleresFraDato;
  return undefined;
};

export const resolveLoenudviklingKilde = (
  values: ErstatningsopgoerelseValues
): readonly LoenudviklingSource[] => {
  if (values.beregnesUdFra === 'Beregningsperiode') {
    return values.loenindkomstAnsaettelsesforhold ?? [];
  }

  const eo = values.eoAngivetLoenLoenudvikling;
  // Lønudviklingsmotoren arbejder på månedlig regulering; angivet dagsløn er kun input-reference.
  const loenudviklingErOverenskomst = eo.loenudviklingBeregningsgrundlag === 'Overenskomst';

  return [{
    id: EO_ANGIVET_LOEN_ID,
    navnPaaArbejdssted: 'EO-oplysninger',
    harOverenskomst: loenudviklingErOverenskomst,
    overenskomstId: eo.overenskomstId,
    ansatPaaSkadestidspunktet: true,
    ansaettelsesforholdOphoert: false,
    sidsteArbejdsdag: undefined,
    feriePct: eo.feriePct,
    fritvalgPct: undefined,
    shSoPct: undefined,
    storeBededagPct: undefined,
    pensionPct: undefined,
    loenperiode: LOENPERIODE.MAANED,
    fuldLoenUnderFerie: 'Ja',
    // Deliberately no fallback; validator must catch missing selection for Overenskomst.
    loenPaaHelligdage: eo.loenPaaHelligdage as LoenudviklingSource['loenPaaHelligdage'],
    saerligFraDatoRegulering: eo.saerligFraDatoRegulering,
    indtaegtsoplysningerTableData: [],
    loenudviklingBeregningsgrundlag: eo.loenudviklingBeregningsgrundlag,
    loenudviklingStatistikModel: eo.loenudviklingStatistikModel,
    loenudviklingKRLSatstabel: eo.loenudviklingKRLSatstabel,
    loenudviklingManuelNavn: eo.loenudviklingManuelNavn,
    loenudviklingManuelTableData: eo.loenudviklingManuelTableData,
    offentligLoenType: eo.offentligLoenType,
    offentligLoenTrin: eo.offentligLoenTrin,
    offentligLoenGruppe: eo.offentligLoenGruppe,
    overenskomstFilter: {
      loenmodtager: undefined,
      arbejdsgiver: undefined,
    },
  }];
};
