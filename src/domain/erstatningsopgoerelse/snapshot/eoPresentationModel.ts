import type { ISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type {
  EoModel,
  ForligModel,
  OevrigeKravModel,
  SvieSmerteModel,
  TabtArbejdsfortjenesteModel,
} from '../shared/eoTypes';
import { clampMoneyOreToZero, ensureMoneyOre, scaleMoneyOre } from '../shared/eoMoney';
import { formatISOToDanish as formatDateShort, formatIsoDateLong as formatDateLong } from '../../../utils/dateFormatting';
import type { IsoRange } from '../validation/tafPeriodConstraints';

export type {
  Calculable,
  IndkomstSkadestidspunktModel,
  LoenudviklingModel,
  LoenudviklingSegment,
  MoneyOre,
  OevrigeKravModel,
  EoModel,
  SvieSmerteModel,
  SygeferiegodtgoerelseModel,
  TabtArbejdsfortjenesteModel,
  TafIndtaegterModel,
} from '../shared/eoTypes';
export { clampMoneyOreToZero, ensureMoneyOre, roundKroner, toOre } from '../shared/eoMoney';
export { buildTafArbejdsdageSet, countTafArbejdsdageInRange, resolveLoenudviklingRows, segmentAmountOre } from '../pdf/eoPdfLoenudvikling';

export type EoPdfPresentation = Readonly<{
  titel: string;
  titelMetadata: string;
  periode: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  periodeDisplay: string | null;
  skadelidteNavn: string | null;
  skadestypeLinje: string | null;
  brevhoved: Readonly<{
    journalnr?: string;
    advokat?: string;
    sagsbehandler?: string;
    dagsDatoISO: ISODateString;
  }> | null;
  saerligeKommentarer: string | null;
}>;

export const buildEoPdfPresentation = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  options: Readonly<{ dagsDatoISO: ISODateString }>
): EoPdfPresentation => {
  const erRevideret = eoValues.revideretOpgoerelse === 'Ja';
  const revideretPrefix = erRevideret ? 'Revideret ' : '';
  const erstatningsord = erRevideret ? 'erstatningsopgørelse' : 'Erstatningsopgørelse';
  const nummer = eoValues.eoNummer || '';
  const ledsagetekst = eoValues.eoLedsagetekst ? ` (${eoValues.eoLedsagetekst})` : '';
  const titel = `${revideretPrefix}${erstatningsord} ${nummer}${ledsagetekst}`.trim();

  const periodeFra = eoValues.vedroererPeriodeFra;
  const periodeTil = eoValues.vedroererPeriodeTil;
  const periode = periodeFra && periodeTil ? { fra: periodeFra, til: periodeTil } : null;
  const periodeDisplay =
    periodeFra && periodeTil ? `${formatDateShort(periodeFra)} - ${formatDateShort(periodeTil)}` : null;

  const navn = (stamdataValues.skadelidte ?? '').trim();
  const skadestype = (stamdataValues.skadestype ?? '').trim();
  const skadedato = formatDateLong(stamdataValues.skadedato);
  const skadestypeLinje = skadestype && skadedato
    ? `${skadestype} ${skadestype === 'Erhvervssygdom' ? 'anmeldt ' : ''}den ${skadedato}`
    : null;

  return {
    titel,
    titelMetadata: titel,
    periode,
    periodeDisplay,
    skadelidteNavn: navn !== '' ? navn : null,
    skadestypeLinje,
    brevhoved: {
      journalnr: stamdataValues.journalnr,
      advokat: stamdataValues.advokat,
      sagsbehandler: stamdataValues.sagsbehandler,
      dagsDatoISO: eoValues.opgørelseLavetDen ?? options.dagsDatoISO,
    },
    saerligeKommentarer: (eoValues.saerligeKommentarer ?? '').trim() || null,
  };
};

export const buildErstatningsopgoerelsePdfModelFromComputed = (args: Readonly<{
  presentation: EoPdfPresentation;
  svieSmerte: SvieSmerteModel;
  tabtArbejdsfortjeneste: TabtArbejdsfortjenesteModel;
  oevrigeKrav: OevrigeKravModel;
  forlig: ForligModel;
  tafRanges: readonly IsoRange[];
}>): EoModel => {
  const tidligereModtagetTafOre = args.tabtArbejdsfortjeneste.tidligereModtagetTaf.status === 'ok'
    ? args.tabtArbejdsfortjeneste.tidligereModtagetTaf.value
    : ensureMoneyOre(0);
  const tabtArbejdsfortjenesteEfterForligOre = args.forlig.erIndgaaet
    ? scaleMoneyOre(args.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteFoerForligOre, args.forlig.factor)
    : args.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteFoerForligOre;
  const tabtArbejdsfortjenesteOre = clampMoneyOreToZero(
    ensureMoneyOre(tabtArbejdsfortjenesteEfterForligOre - tidligereModtagetTafOre)
  );
  const tabtArbejdsfortjeneste = {
    ...args.tabtArbejdsfortjeneste,
    tabtArbejdsfortjenesteOre,
  };
  const oevrigeKravOre = args.forlig.erIndgaaet
    ? clampMoneyOreToZero(scaleMoneyOre(args.oevrigeKrav.totalFoerForligOre, args.forlig.factor))
    : args.oevrigeKrav.totalFoerForligOre;
  const oevrigeKrav = {
    ...args.oevrigeKrav,
    totalOre: oevrigeKravOre,
  };

  const svieSmerteOre = clampMoneyOreToZero(args.svieSmerte.totalOre);
  const tabtArbejdsfortjenesteOreClamped = clampMoneyOreToZero(tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre);
  const oevrigeKravOreClamped = clampMoneyOreToZero(oevrigeKrav.totalOre);
  const totalOre = clampMoneyOreToZero(
    ensureMoneyOre(svieSmerteOre + tabtArbejdsfortjenesteOreClamped + oevrigeKravOreClamped)
  );

  return {
    titel: args.presentation.titel,
    titelMetadata: args.presentation.titelMetadata,
    periode: args.presentation.periode,
    periodeDisplay: args.presentation.periodeDisplay,
    skadelidteNavn: args.presentation.skadelidteNavn,
    skadestypeLinje: args.presentation.skadestypeLinje,
    brevhoved: args.presentation.brevhoved,
    svieSmerte: args.svieSmerte,
    forlig: args.forlig,
    tabtArbejdsfortjeneste,
    oevrigeKrav,
    samlet: {
      svieSmerteOre,
      tabtArbejdsfortjenesteOre: tabtArbejdsfortjenesteOreClamped,
      oevrigeKravOre: oevrigeKravOreClamped,
      totalOre,
    },
    saerligeKommentarer: args.presentation.saerligeKommentarer,
    tafRanges: args.tafRanges,
  };
};
