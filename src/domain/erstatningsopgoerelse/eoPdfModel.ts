import type { ISODateString } from '../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { erstatningsopgoerelseSchema, stamdataSchema } from '../../schemas/formSchemas';
import { buildOevrigeKravModel, buildSvieSmerteModel, buildTabtArbejdsfortjenesteModel } from './eoPdfBuilders';
import type {
  PdfModel,
} from './eoPdfModelTypes';
import { clampMoneyOreToZero, ensureMoneyOre, scaleMoneyOre } from './eoPdfMoneyUtils';
import { parseForligsgrad } from './forligsgrad';
import {
  formatDateShort,
  formatDateLong,
} from './sharedPdfUtils';
import type {
  ForligPdfModel,
  OevrigeKravPdfModel,
  SvieSmertePdfModel,
  TabtArbejdsfortjenestePdfModel,
} from './eoPdfModelTypes';

export type {
  Calculable,
  IndkomstSkadestidspunktPdfModel,
  LoenudviklingPdfModel,
  LoenudviklingSegment,
  MoneyOre,
  OevrigeKravPdfModel,
  PdfModel,
  SvieSmertePdfModel,
  TabtArbejdsfortjenestePdfModel,
  TafIndtaegterPdfModel,
} from './eoPdfModelTypes';
export { clampMoneyOreToZero, ensureMoneyOre, roundKroner, toOre } from './eoPdfMoneyUtils';
export { buildTafArbejdsdageSet, countTafArbejdsdageInRange, resolveLoenudviklingRowsV3, segmentAmountOreV3 } from './eoPdfLoenudvikling';

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
  const skadesdato = formatDateLong(stamdataValues.skadesdato);
  const skadestypeLinje = skadestype && skadesdato
    ? `${skadestype} ${skadestype === 'Erhvervssygdom' ? 'anmeldt ' : ''}den ${skadesdato}`
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
  svieSmerte: SvieSmertePdfModel;
  tabtArbejdsfortjeneste: TabtArbejdsfortjenestePdfModel;
  oevrigeKrav: OevrigeKravPdfModel;
  forlig: ForligPdfModel;
}>): PdfModel => {
  const tabtArbejdsfortjenesteOre = args.forlig.erIndgaaet
    ? clampMoneyOreToZero(scaleMoneyOre(args.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteFoerForligOre, args.forlig.factor))
    : args.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteFoerForligOre;
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
  };
};

export const buildErstatningsopgoerelsePdfModel = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  options: Readonly<{ dagsDatoISO: ISODateString }>
): PdfModel => {
  const stamdataParsed = stamdataSchema.safeParse(stamdataValues);
  const eoParsed = erstatningsopgoerelseSchema.safeParse(eoValues);
  if (!stamdataParsed.success || !eoParsed.success) {
    const errors = [
      ...(stamdataParsed.success ? [] : stamdataParsed.error.issues),
      ...(eoParsed.success ? [] : eoParsed.error.issues),
    ]
      .map((e) => e.message)
      .join('; ');
    throw new Error(`Ugyldigt input til PDF: ${errors}`);
  }

  const safeStamdata = stamdataParsed.data;
  const safeEo = eoParsed.data;

  const presentation = buildEoPdfPresentation(safeStamdata, safeEo, options);

  const svieSmerte = buildSvieSmerteModel(safeEo, safeStamdata);
  const tabtArbejdsfortjenesteRaw = buildTabtArbejdsfortjenesteModel(safeEo, safeStamdata);
  const oevrigeKravRaw = buildOevrigeKravModel(safeEo.oevrigeKravPerioder ?? []);
  const parsedForlig = parseForligsgrad(safeEo);
  const forlig = parsedForlig
    ? {
      erIndgaaet: true,
      label: parsedForlig.label,
      dato: safeEo.forligDato ?? null,
      factor: parsedForlig.factor,
    } as const
    : {
      erIndgaaet: false,
      label: null,
      dato: null,
      factor: null,
    } as const;

  return buildErstatningsopgoerelsePdfModelFromComputed({
    presentation,
    svieSmerte,
    tabtArbejdsfortjeneste: tabtArbejdsfortjenesteRaw,
    oevrigeKrav: oevrigeKravRaw,
    forlig,
  });
};
