import {
  type ErstatningsopgoerelseValues,
  type LoenindkomstAnsaettelsesforhold,
} from '../../../schemas/formSchemas';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import { type ISODateString, parseISODate } from '../../../types/branded';
import { formatDanishDate } from '../../../utils/dateUtils';
import { formatAsAmount } from '../../../utils/formatUtils';
import { getOverenskomstMetaById } from '../../../data/overenskomstRates';
import { hasIndtastetLoenoplysninger } from '../helpers/loenoplysningerInput';
import {
  resolveOverenskomstSatsBindings,
  type OverenskomstSatsField,
} from '../helpers/loenindkomstSatser';

/**
 * Ren (React-fri) sats-validering for Loenindkomst-ansættelsesforhold.
 *
 * Hele afledningen "given committed ansættelsesforhold + anvendt reguleringsdato → sats-fejl" bor her,
 * så den kan unit-testes uden React-render (jf. arkitektur-kandidat A1 — view-model-lagets primære
 * gevinst: afledning testbar uden render). `useLoenindkomstViewModel` ejer kun state/effekter/handlers
 * og kalder ind i disse funktioner.
 */

export type SatsErrorState = {
  feriePct?: string;
  fritvalgPct?: string;
  shSoPct?: string;
  storeBededagPct?: string;
  pensionPct?: string;
};

/**
 * Valider Feriegodtgørelse/-tillæg (min. 12 %).
 */
export const validateFeriePct = (
  fuldLoenUnderFerie: LoenindkomstAnsaettelsesforhold['fuldLoenUnderFerie'],
  inputValue: number | undefined,
  kraeverFeriePct: boolean
): string | undefined => {
  if (inputValue === undefined) {
    return kraeverFeriePct ? 'Feriegodtgørelse/-tillæg skal udfyldes' : undefined;
  }
  if (inputValue >= 12) return undefined;

  if (fuldLoenUnderFerie === 'Ja') {
    return 'Løn under ferie beregnes som feriegodtgørelse (12,5 % eller 15 % ved ret til 6. ferieuge)';
  }

  return 'Feriegodtgørelse udgør typisk 12,5 %, men 15 % ved ret til 6. ferieuge';
};

/**
 * Valider en enkelt overenskomst-bundet sats (fritvalg/SH-SO/pension) mod den sats overenskomsten
 * låser per den anvendte reguleringsdato. Returnerer undefined når feltet ikke er låst eller matcher.
 */
export const validateOverenskomstSats = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage'>,
  fieldName: OverenskomstSatsField,
  inputValue: number | undefined,
  anvendtReguleringsdato: ISODateString | undefined
): string | undefined => {
  const overenskomstId = af.overenskomstId?.trim();
  if (!overenskomstId) return undefined;
  if (!anvendtReguleringsdato) return undefined;
  const expectedBinding = resolveOverenskomstSatsBindings(af, anvendtReguleringsdato)[fieldName];
  if (!expectedBinding.locked || expectedBinding.value === undefined) return undefined;

  const overenskomstMeta = getOverenskomstMetaById(overenskomstId);
  const overenskomstNavn = overenskomstMeta?.navn || 'Overenskomsten';

  const dateObj = parseISODate(anvendtReguleringsdato);
  if (!dateObj) return undefined;

  const danishDateShort = formatDanishDate(dateObj);

  const expectedPct = expectedBinding.value;
  const actualValue = inputValue ?? 0;
  const diff = Math.abs(actualValue - expectedPct);
  if (diff > 0.01) {
    return `${overenskomstNavn}s sats per ${danishDateShort} udgør ${formatAsAmount(expectedPct, 2)} %`;
  }

  return undefined;
};

export type SatsValidationContext = Readonly<{
  anvendtReguleringsdato: ISODateString | undefined;
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
}>;

/**
 * Valider alle satser for ét ansættelsesforhold ud fra dets committede værdier + den anvendte
 * reguleringsdato. Beløb-tilstand bruger de indtastede tillægsbeløb/rækkeprocenter i stedet for de
 * skjulte top-satsfelter, så disse felter må ikke give feltfejl der.
 */
export const validateAllSatserForAnsaettelsesforhold = (
  af: LoenindkomstAnsaettelsesforhold,
  ctx: SatsValidationContext
): SatsErrorState => {
  const errors: SatsErrorState = {};
  if (af.tillaegAngivesSom === TILLAEG_ANGIVES_SOM.BELOEB) return errors;
  const { anvendtReguleringsdato, beregnesUdFra } = ctx;
  const kraeverFeriePct = beregnesUdFra === 'Beregningsperiode'
    && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? []);

  // Valider Feriegodtgørelse/-tillæg
  const ferieError = validateFeriePct(af.fuldLoenUnderFerie, af.feriePct, kraeverFeriePct);
  if (ferieError) errors.feriePct = ferieError;

  // Valider Fritvalg
  const fritvalgError = validateOverenskomstSats(af, 'fritvalgPct', af.fritvalgPct, anvendtReguleringsdato);
  if (fritvalgError) errors.fritvalgPct = fritvalgError;

  // Valider SH/SO-sats
  const shError = validateOverenskomstSats(af, 'shSoPct', af.shSoPct, anvendtReguleringsdato);
  if (shError) errors.shSoPct = shError;

  // Valider Arbejdsgivers pensionsbidrag
  const pensionError = validateOverenskomstSats(af, 'pensionPct', af.pensionPct, anvendtReguleringsdato);
  if (pensionError) errors.pensionPct = pensionError;

  return errors;
};
