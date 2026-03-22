export {
  jaNejEnum,
  type JaNej,
  skadestypeEnum,
  type Skadestype,
  helbredsstatusEnum,
  type Helbredsstatus,
  tilstandEnum,
  type Tilstand,
  arbejdsstatusEnum,
  type Arbejdsstatus,
  beregningsmetodeEnum,
  type Beregningsmetode,
  afsluttesMedEnum,
  type AfsluttesMed,
  loenperiodeSchema,
  type Loenperiode,
  anciennitetSatsPerEnum,
  type AnciennitetSatsPer,
  loenPaaHelligdageSchema,
  type LoenPaaHelligdage,
  offentligLoenTypeEnum,
  type OffentligLoenTypeLabel,
  loenudviklingBeregningsgrundlagEnum,
  type LoenudviklingBeregningsgrundlag,
  loenudviklingStatistikModelEnum,
  type LoenudviklingStatistikModel,
  krlSatstabelEnum,
  type KRLSatstabelValg,
  tillaegstidEnhedEnum,
  type TillaegstidEnhed,
  afgoerelseTypeEnum,
  type AfgoerelseType,
  koenEnum,
  type Koen,
} from './formSchemas/enumSchemas';

export { stamdataSchema, type StamdataValues } from './formSchemas/sections/stamdataSchemas';
export { satserSchema, type SatserValues } from './formSchemas/sections/satserSchemas';
export {
  standardLoenTableRowSchema,
  type StandardLoenTableRow,
  aarsloenSchema,
  type AarsloenValues,
} from './formSchemas/sections/aarsloenSchemas';
export {
  rentekravRowSchema,
  type RentekravRow,
  renteberegningSchema,
  type RenteberegningValues,
} from './formSchemas/sections/renteberegningSchemas';
export { varigeMenSchema, type VarigeMenValues } from './formSchemas/sections/varigeMenSchemas';
export { faellesAarsloenSchema, type FaellesAarsloenValues } from './formSchemas/sections/faellesAarsloenSchemas';
export { faellesPersondataSchema, type FaellesPersondataValues } from './formSchemas/sections/faellesPersondataSchemas';
export {
  svieSmertePeriodeRowSchema,
  type SvieSmertePeriodeRow,
  tafPeriodeRowSchema,
  type TafPeriodeRow,
  ferieperiodeRowSchema,
  type FerieperiodeRow,
  oevrigeKravRowSchema,
  type OevrigeKravRow,
  offentligeYdelserRowSchema,
  type OffentligeYdelserRow,
  loenudviklingManuelRowSchema,
  type LoenudviklingManuelRow,
  loenudviklingOgSatserSchema,
  eoLoenudviklingOgSatserSchema,
  type LoenudviklingOgSatser,
  type EOLoenudviklingOgSatser,
  loenindkomstAnsaettelsesforholdSchema,
  type LoenindkomstAnsaettelsesforhold,
  eoAngivetLoenLoenudviklingSchema,
  type EOAngivetLoenLoenudvikling,
  erstatningsopgoerelseSchema,
  type ErstatningsopgoerelseValues,
  type EoBilagLoenindkomstOgOffentligeYdelserIndgaar,
} from './formSchemas/sections/erstatningsopgoerelseSchemas';
export { type AarsloenMetode, type AarsloenBeregningResult, type DateInterval } from './formSchemas/formSchemaTypes';
export {
  aslAfgoerelseRowSchema,
  type AslAfgoerelseRow,
  erhvervsevnetabSchema,
  type ErhvervsevnetabValues,
  type ErhvervsevnetabComposedValues,
} from './formSchemas/sections/erhvervsevnetabSchemas';
export {
  forsoergertabSchema,
  type ForsoergertabValues,
} from './formSchemas/sections/forsoergertabSchemas';
