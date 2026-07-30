import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';

/** Det fulde og compiler-håndhævede read-set for TAF-periodisering og nettoberegning. */
export type TafCalculationValues = Pick<
  ErstatningsopgoerelseValues,
  | 'eoNummer'
  | 'opgørelseLavetDen'
  | 'kravPaaTabtArbejdsfortjeneste'
  | 'beregnesUdFra'
  | 'tafBeregningsperiodeFra'
  | 'tafBeregningsperiodeTil'
  | 'tafPerioder'
  | 'ferieperioder'
  | 'fravaerPerioder'
  | 'uspecificeredeFerieFridage'
  | 'oevrigtFravaerUdenLoen'
  | 'oevrigeFravaersdage'
  | 'oevrigeFravaersdageBeskrivelse'
  | 'maanedsloenenUdgoer'
  | 'dagsloenenUdgoer'
  | 'angivetMaanedsloenBaseretPaa'
  | 'angivetMaanedsloenOpreguleresFraDato'
  | 'angivetDagsloenBaseretPaa'
  | 'angivetDagsloenOpreguleresFraDato'
  | 'loenindkomstAnsaettelsesforhold'
  | 'eoAngivetLoenLoenudvikling'
  | 'sfggAnsaettelsesforhold'
  | 'offentligeYdelserRows'
  | 'regulerOffentligeYdelser'
  | 'tidligereModtagetTaf'
  | 'midlertidigtEetFraEetSiden'
  | 'vedroererPeriodeFra'
  | 'vedroererPeriodeTil'
  | 'differencekravDato'
  | 'midlertidigtEETAfgorelse'
  | 'midlertidigEETAfgoerelseDato'
  | 'midlertidigEETVirkningsdato'
  | 'endeligtEETAfgorelse'
  | 'endeligEETAfgoerelseDato'
  | 'endeligEETVirkningsdato'
  | 'verserendeKlageEet'
>;

export type TafCalculationStamdata = Pick<StamdataValues, 'skadedato' | 'skadestype'>;
