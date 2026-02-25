import type { ISODateString } from '../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import { erstatningsopgoerelseSchema, stamdataSchema } from '../../schemas/formSchemas';
import { buildOevrigeKravModel, buildSvieSmerteModel, buildTabtArbejdsfortjenesteModel } from './eoPdfBuilders';
import type {
  PdfModel,
} from './eoPdfModelTypes';
import { clampMoneyOreToZero, ensureMoneyOre } from './eoPdfMoneyUtils';
import {
  formatDateShort,
  formatDateLong,
} from './sharedPdfUtils';

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

  const erRevideret = safeEo.revideretOpgoerelse === 'Ja';
  const revideretPrefix = erRevideret ? 'Revideret ' : '';
  const erstatningsord = erRevideret ? 'erstatningsopgørelse' : 'Erstatningsopgørelse';
  const nummer = safeEo.eoNummer || '';
  const ledsagetekst = safeEo.eoLedsagetekst ? ` (${safeEo.eoLedsagetekst})` : '';
  const titel = `${revideretPrefix}${erstatningsord} ${nummer}${ledsagetekst}`.trim();

  const periodeFra = safeEo.vedroererPeriodeFra;
  const periodeTil = safeEo.vedroererPeriodeTil;
  const periode = periodeFra && periodeTil ? { fra: periodeFra, til: periodeTil } : null;
  const periodeDisplay =
    periodeFra && periodeTil ? `${formatDateShort(periodeFra)} - ${formatDateShort(periodeTil)}` : null;

  const navn = (safeStamdata.skadelidte ?? '').trim();
  const skadestype = (safeStamdata.skadestype ?? '').trim();
  const skadesdato = formatDateLong(safeStamdata.skadesdato);
  const skadestypeLinje = skadestype && skadesdato
    ? `${skadestype} ${skadestype === 'Erhvervssygdom' ? 'anmeldt ' : ''}den ${skadesdato}`
    : null;

  const brevhoved = {
    journalnr: safeStamdata.journalnr,
    advokat: safeStamdata.advokat,
    sagsbehandler: safeStamdata.sagsbehandler,
    dagsDatoISO: safeEo.opgørelseLavetDen ?? options.dagsDatoISO,
  };

  const svieSmerte = buildSvieSmerteModel(safeEo, safeStamdata);
  const tabtArbejdsfortjeneste = buildTabtArbejdsfortjenesteModel(safeEo, safeStamdata);
  const oevrigeKrav = buildOevrigeKravModel(safeEo.oevrigeKravPerioder ?? []);

  const svieSmerteOre = clampMoneyOreToZero(svieSmerte.totalOre);
  const tabtArbejdsfortjenesteOre = clampMoneyOreToZero(tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre);
  const oevrigeKravOre = clampMoneyOreToZero(oevrigeKrav.totalOre);
  const totalOre = clampMoneyOreToZero(
    ensureMoneyOre(svieSmerteOre + tabtArbejdsfortjenesteOre + oevrigeKravOre)
  );
  const samlet = {
    svieSmerteOre,
    tabtArbejdsfortjenesteOre,
    oevrigeKravOre,
    totalOre,
  };

  return {
    titel,
    titelMetadata: titel,
    periode,
    periodeDisplay,
    skadelidteNavn: navn !== '' ? navn : null,
    skadestypeLinje,
    brevhoved,
    svieSmerte,
    tabtArbejdsfortjeneste,
    oevrigeKrav,
    samlet,
    saerligeKommentarer: (safeEo.saerligeKommentarer ?? '').trim() || null,
  };
};
