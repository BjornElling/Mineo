import type { PersistedSectionMap } from '../../config/persistenceRegistry';
import type { ISODateString } from '../../types/branded';
import { subtractOneDay } from '../../types/branded';
import { resolveMidlertidigEetDatoHvisAktiv } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';

type StamdataValues = PersistedSectionMap['stamdata'];
type ErstatningsopgoerelseValues = PersistedSectionMap['erstatningsopgoerelse'];

/**
 * Context for Svie/Smerte beregninger
 */
export type SvieSmerteContext = {
  skadedatoISO: ISODateString | undefined;
  erErhvervssygdom: boolean;
  menAfgoerelseDatoForTabel: ISODateString | undefined;
  verserendeKlageMen: boolean;
};

/**
 * Context for TAF beregninger
 */
export type TaftContext = {
  skadedatoISO: ISODateString | undefined;
  skadelidteFodselsdato: ISODateString | undefined;
  erErhvervssygdom: boolean;
  endeligEETBeregnetDato: ISODateString | undefined;
  midlertidigEETBeregnetDato: ISODateString | undefined;
  differencekravDato: ISODateString | undefined;
  verserendeKlageEet: boolean;
};

/**
 * Beregner SvieSmerteContext
 */
export const buildSvieSmerteContext = (
  stamdataValues: StamdataValues,
  erstatningsopgoerelseValues: ErstatningsopgoerelseValues
): SvieSmerteContext => {
  const erErhvervssygdom = stamdataValues.skadestype === 'Erhvervssygdom';
  const menAfgoerelseDatoForTabel =
    erstatningsopgoerelseValues.varigeMenAfgorelse === 'Ja'
      ? subtractOneDay(erstatningsopgoerelseValues.menAfgoerelseDato)
      : undefined;
  const verserendeKlageMen = erstatningsopgoerelseValues.verserendeKlageMen === 'Ja';

  return {
    skadedatoISO: stamdataValues.skadedato,
    erErhvervssygdom,
    menAfgoerelseDatoForTabel,
    verserendeKlageMen,
  };
};

/**
 * Beregner TaftContext
 */
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
