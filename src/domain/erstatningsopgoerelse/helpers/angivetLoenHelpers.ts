import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { TafCalculationValues } from '../engines/tafCalculationInput';
import type { ISODateString } from '../../../types/branded';
import { LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../../types/loen';

export const EO_ANGIVET_LOEN_ID = 'eo-angivet-loen';

export type LoenudviklingKildeErrorCode = 'invalid_beregnes_udfra';

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
  values: TafCalculationValues
): string | undefined => {
  if (values.beregnesUdFra === 'Angivet månedsløn') return values.angivetMaanedsloenBaseretPaa;
  if (values.beregnesUdFra === 'Angivet dagsløn') return values.angivetDagsloenBaseretPaa;
  return undefined;
};

export const getAngivetLoenOpreguleresFraDato = (
  values: TafCalculationValues
): ISODateString | undefined => {
  if (values.beregnesUdFra === 'Angivet månedsløn') return values.angivetMaanedsloenOpreguleresFraDato;
  if (values.beregnesUdFra === 'Angivet dagsløn') return values.angivetDagsloenOpreguleresFraDato;
  return undefined;
};

export const resolveLoenudviklingKilde = (
  values: TafCalculationValues
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
  // `loenPaaHelligdage` er required-with-default i det persisterede schema OG i inputdescriptoren, så der
  // findes ingen manglende/ugyldig værdi at kaste på. Det defensive kast, der stod her, var kun nåeligt,
  // fordi feltet var valgfrit – og det var netop den vej, en nyoprettet sag altid tog.
  const loenPaaHelligdage = eo.loenPaaHelligdage;

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
    loenPaaHelligdage,
    saerligFraDatoRegulering: eo.saerligFraDatoRegulering,
    indtaegtsoplysningerTableData: [],
    loenudviklingBeregningsgrundlag: eo.loenudviklingBeregningsgrundlag,
    loenudviklingStatistikModel: eo.loenudviklingStatistikModel,
    loenudviklingKRLSatstabel: eo.loenudviklingKRLSatstabel,
    loenudviklingManuelNavn: eo.loenudviklingManuelNavn,
    loenudviklingManuelTableData: eo.loenudviklingManuelTableData,
    loenudviklingManuelProcentsatsTableData: eo.loenudviklingManuelProcentsatsTableData,
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
  values: TafCalculationValues
): LoenudviklingSource | undefined => {
  const kilder = resolveLoenudviklingKilde(values);
  return kilder.find((kilde) =>
    kilde.loenudviklingBeregningsgrundlag !== undefined &&
    kilde.loenudviklingBeregningsgrundlag !== 'Ingen'
  ) ?? kilder[0];
};
