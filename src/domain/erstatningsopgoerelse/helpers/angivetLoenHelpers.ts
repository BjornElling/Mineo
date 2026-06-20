import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { LOENPERIODE, LOEN_PAA_HELLIGDAGE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';

export const EO_ANGIVET_LOEN_ID = 'eo-angivet-loen';

export type LoenudviklingKildeErrorCode = 'invalid_beregnes_udfra' | 'invalid_loen_paa_helligdage';

export class LoenudviklingKildeError extends Error {
  public readonly code: LoenudviklingKildeErrorCode;

  public constructor(code: LoenudviklingKildeErrorCode, message: string) {
    super(message);
    this.name = 'LoenudviklingKildeError';
    this.code = code;
  }
}

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
  const assertNever = (value: never): never => {
    throw new LoenudviklingKildeError(
      'invalid_beregnes_udfra',
      `Ukendt beregnesUdFra-værdi: ${String(value)}`
    );
  };

  switch (values.beregnesUdFra) {
    case 'Beregningsperiode':
      return values.loenindkomstAnsaettelsesforhold ?? [];
    case 'Angivet månedsløn':
    case 'Angivet dagsløn':
      break;
    default:
      return assertNever(values.beregnesUdFra);
  }

  const eo = values.eoAngivetLoenLoenudvikling;
  const anciennitetSatsAngivesPer = values.beregnesUdFra === 'Angivet dagsløn' ? 'Time' : 'Måned';
  // Lønudviklingsmotoren arbejder på månedlig regulering; angivet dagsløn er kun input-reference.
  const loenudviklingErOverenskomst = eo.loenudviklingBeregningsgrundlag === 'Overenskomst';
  const loenPaaHelligdage = eo.loenPaaHelligdage;
  if (
    loenPaaHelligdage !== LOEN_PAA_HELLIGDAGE.ALMINDELIG &&
    loenPaaHelligdage !== LOEN_PAA_HELLIGDAGE.SH_UDBETALING &&
    loenPaaHelligdage !== LOEN_PAA_HELLIGDAGE.INGEN
  ) {
    throw new LoenudviklingKildeError(
      'invalid_loen_paa_helligdage',
      'Løn på helligdage mangler eller er ugyldig for angivet løn.'
    );
  }

  return [{
    id: EO_ANGIVET_LOEN_ID,
    navnPaaArbejdssted: 'EO-oplysninger',
    harOverenskomst: loenudviklingErOverenskomst,
    overenskomstId: eo.overenskomstId,
    ansatPaaSkadestidspunktet: true,
    ansaettelsesforholdOphoert: false,
    sidsteArbejdsdag: undefined,
    harAnciennitetstillaegEfterSkadedatoen: eo.harAnciennitetstillaegEfterSkadedatoen,
    anciennitetstillaegDato: eo.anciennitetstillaegDato,
    anciennitetstillaegSatsAngivesPer: anciennitetSatsAngivesPer,
    anciennitetstillaegSats: eo.anciennitetstillaegSats,
    feriePct: eo.feriePct,
    fritvalgPct: undefined,
    shSoPct: undefined,
    storeBededagPct: undefined,
    pensionPct: undefined,
    // Angivet løn bruger ikke lønindkomst-tabellen; Beløb-tilstand er irrelevant her.
    tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
    loenperiode: LOENPERIODE.MAANED,
    fuldLoenUnderFerie: 'Ja',
    // Bevidst ingen fallback; ugyldige værdier skal kaste for at undgå stille propagering.
    loenPaaHelligdage,
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
    offentligLoenEkstraGrundloen: eo.offentligLoenEkstraGrundloen,
    overenskomstFilter: {
      loenmodtager: eo.overenskomstFilter?.loenmodtager,
      arbejdsgiver: eo.overenskomstFilter?.arbejdsgiver,
    },
  }];
};

export const resolveAktivEllerFoersteLoenudviklingKilde = (
  values: ErstatningsopgoerelseValues
): LoenudviklingSource | undefined => {
  const kilder = resolveLoenudviklingKilde(values);
  return kilder.find((kilde) =>
    kilde.loenudviklingBeregningsgrundlag !== undefined &&
    kilde.loenudviklingBeregningsgrundlag !== 'Ingen'
  ) ?? kilder[0];
};
