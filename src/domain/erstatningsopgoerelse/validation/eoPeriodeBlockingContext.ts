import type { PersistedSectionMap } from '../../../config/persistenceRegistry';
import type { ISODateString } from '../../../types/branded';
import { getDayBeforeIso } from '../../../utils/isoDateHelpers';
import { resolveMidlertidigEetDatoHvisAktiv } from './tafPeriodConstraints';

/**
 * Afledning af de dato-/afgørelses-grænser som periode-blokeringen (svie/smerte, TAF, ferie)
 * afhænger af — ud fra committed stamdata + EO-input. React-/visnings-fri, så den autoritative
 * række-evaluerings-motor (`domain/eoRowEvaluation/`, jf. B9) og dens periode-evaluatorer deler
 * samme afledning — ÉN sandhedskilde.
 *
 * Genbruges af motor-helperen `eoRowContextBuilders.ts`, der re-eksporterer herfra.
 */

type StamdataValues = PersistedSectionMap['stamdata'];
type ErstatningsopgoerelseValues = PersistedSectionMap['erstatningsopgoerelse'];

export type SvieSmerteContext = {
  skadedatoISO: ISODateString | undefined;
  erErhvervssygdom: boolean;
  menAfgoerelseDatoForTabel: ISODateString | undefined;
  verserendeKlageMen: boolean;
};

export type TaftContext = {
  skadedatoISO: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
  erErhvervssygdom: boolean;
  endeligEETBeregnetDato: ISODateString | undefined;
  midlertidigEETBeregnetDato: ISODateString | undefined;
  differencekravDato: ISODateString | undefined;
  verserendeKlageEet: boolean;
};

export const buildSvieSmerteContext = (
  stamdataValues: StamdataValues,
  erstatningsopgoerelseValues: ErstatningsopgoerelseValues
): SvieSmerteContext => {
  const erErhvervssygdom = stamdataValues.skadestype === 'Erhvervssygdom';
  const menAfgoerelseDatoForTabel =
    erstatningsopgoerelseValues.varigeMenAfgorelse === 'Ja'
      ? getDayBeforeIso(erstatningsopgoerelseValues.menAfgoerelseDato)
      : undefined;
  const verserendeKlageMen = erstatningsopgoerelseValues.verserendeKlageMen === 'Ja';

  return {
    skadedatoISO: stamdataValues.skadedato,
    erErhvervssygdom,
    menAfgoerelseDatoForTabel,
    verserendeKlageMen,
  };
};

export const buildTaftContext = (
  stamdataValues: StamdataValues,
  erstatningsopgoerelseValues: ErstatningsopgoerelseValues
): TaftContext => {
  const erErhvervssygdom = stamdataValues.skadestype === 'Erhvervssygdom';
  const endeligEETBeregnetDato =
    erstatningsopgoerelseValues.endeligtEETAfgorelse === 'Ja'
      ? erstatningsopgoerelseValues.endeligEETVirkningsdato || erstatningsopgoerelseValues.endeligEETAfgoerelseDato
      : undefined;
  const midlertidigEETBeregnetDato = resolveMidlertidigEetDatoHvisAktiv({
    ...erstatningsopgoerelseValues,
    skadedatoISO: stamdataValues.skadedato,
  });
  const verserendeKlageEet = erstatningsopgoerelseValues.verserendeKlageEet === 'Ja';

  return {
    skadedatoISO: stamdataValues.skadedato,
    skadelidteFodselsdato: stamdataValues.skadelidteFodselsdato,
    erErhvervssygdom,
    endeligEETBeregnetDato,
    midlertidigEETBeregnetDato,
    differencekravDato: erstatningsopgoerelseValues.differencekravDato,
    verserendeKlageEet,
  };
};
