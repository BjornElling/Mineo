import type { ISODateString } from '../../types/branded';
import { toISODateString } from '../../types/branded';
import { endOfYearIso, isoYear, maxISO, minISO } from '../../utils/isoDateHelpers';

// Oversigt over kapitaliseringsbekendtgørelser og -vejledninger.
// Manuelt vedligeholdt — opdateres årligt når nye bekendtgørelser/vejledninger udstedes.
//
// Struktur:
//   - skadedatoFra: første skadedato (inklusiv) dette interval gælder for
//   - kapitaliseringer: liste af kapitaliseringsdato-intervaller med tilhørende bekendtgørelse
//     - kapitaliseringsdatoFra: første kapitaliseringsdato (inklusiv) dette interval gælder for
//     - id: bekendtgørelsens nummer/årstal — bruges til opslag i kapitaliseringstabeller
//
// Opslagslogik: find seneste skadedatoFra ≤ skadedato, og inden for det interval
// seneste kapitaliseringsdatoFra ≤ kapitaliseringsdato.
//
// Udløbsregel: en post gælder til dagen før næste kapitaliseringsdatoFra i samme
// skadesinterval. Hvis der ikke findes en senere post endnu, gælder den foreløbigt
// kun til og med 31-12 i året for dens kapitaliseringsdatoFra. Dermed kan en ny
// bekendtgørelse midt i et år erstatte den tidligere straks fra sin ikrafttrædelsesdato,
// mens manglende fremtidige år stadig fail-closed ved næste årsskifte.
//
// Tomme celler i den originale oversigt (kombinationer der ikke kan forekomme) er udeladt.
//
// Note: Intervallet 01-04-1978 indeholder ældre bekendtgørelser fra før 2005.
// Disse kan aldrig forekomme i praksis (stamdata låser mindste skadedato til 01-01-2005),
// men bevares af dokumentationsmæssige årsager.
//
// Sådan tilføjes et nyt år:
//   1. Tilføj en ny { kapitaliseringsdatoFra, id } linje nederst i HVERT relevant interval.
//   2. Hvis en ny skadedato-grænse indføres ved lov, tilføj et nyt objekt i hovedarrayet.
//
// Fail-fast validering:
// - RAW_* konverteres ved modul-load med toISODateString.
// - Ugyldige dato-strenge giver throw ved appstart (bevidst, trust-kritisk datakilde).

export interface KapitaliseringsInterval {
  kapitaliseringsdatoFra: ISODateString
  id: string
}

export interface KapitaliseringsSkadedatoInterval {
  skadedatoFra: ISODateString
  kapitaliseringer: KapitaliseringsInterval[]
}

type RawKapitaliseringsInterval = Readonly<{
  kapitaliseringsdatoFra: string;
  id: string;
}>;

type RawKapitaliseringsSkadedatoInterval = Readonly<{
  skadedatoFra: string;
  kapitaliseringer: readonly RawKapitaliseringsInterval[];
}>;

const RAW_KAPITALISERINGSBEKENDTGOERELSER: readonly RawKapitaliseringsSkadedatoInterval[] = [

  {
    skadedatoFra: '1978-04-01',
    kapitaliseringer: [
      { kapitaliseringsdatoFra: '2004-01-01', id: '1068/2003' },
      { kapitaliseringsdatoFra: '2007-07-01', id: '1068/2003' },
      { kapitaliseringsdatoFra: '2008-01-01', id: '1068/2003' },
      { kapitaliseringsdatoFra: '2009-01-01', id: '1068/2003' },
      { kapitaliseringsdatoFra: '2009-07-01', id: '449/2009'  },
      { kapitaliseringsdatoFra: '2010-01-01', id: '449/2009'  },
      { kapitaliseringsdatoFra: '2011-01-01', id: '1221/2010' },
      { kapitaliseringsdatoFra: '2012-01-01', id: '1403/2011' },
      { kapitaliseringsdatoFra: '2013-01-01', id: '1403/2011' },
      { kapitaliseringsdatoFra: '2014-01-01', id: '1403/2011' },
      { kapitaliseringsdatoFra: '2015-01-01', id: '1403/2011' },
      { kapitaliseringsdatoFra: '2015-03-01', id: '198/2015'  },
      { kapitaliseringsdatoFra: '2015-12-29', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2016-01-01', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2017-01-01', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2018-01-01', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2019-01-01', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2020-01-01', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2020-12-31', id: '9871/2020' },
      { kapitaliseringsdatoFra: '2021-01-01', id: '9871/2020' },
      { kapitaliseringsdatoFra: '2022-01-01', id: '9871/2020' },
      { kapitaliseringsdatoFra: '2023-01-01', id: '9871/2020' },
      { kapitaliseringsdatoFra: '2024-01-01', id: '9871/2020' },
      { kapitaliseringsdatoFra: '2024-07-01', id: '9376/2024' },
      { kapitaliseringsdatoFra: '2025-01-01', id: '10029/2024' },
      { kapitaliseringsdatoFra: '2025-12-31', id: '10183/2025' },
      { kapitaliseringsdatoFra: '2026-01-01', id: '10056/2025' },
    ],
  },

  {
    skadedatoFra: '2007-07-01',
    kapitaliseringer: [
      { kapitaliseringsdatoFra: '2007-07-01', id: '678/2007'  },
      { kapitaliseringsdatoFra: '2008-01-01', id: '1263/2007' },
      { kapitaliseringsdatoFra: '2009-01-01', id: '1047/2008' },
      { kapitaliseringsdatoFra: '2009-07-01', id: '440/2009'  },
      { kapitaliseringsdatoFra: '2010-01-01', id: '1022/2009' },
      { kapitaliseringsdatoFra: '2011-01-01', id: '1221/2010' },
      { kapitaliseringsdatoFra: '2012-01-01', id: '1403/2011' },
      { kapitaliseringsdatoFra: '2013-01-01', id: '1403/2011' },
      { kapitaliseringsdatoFra: '2014-01-01', id: '1403/2011' },
      { kapitaliseringsdatoFra: '2015-01-01', id: '1403/2011' },
      { kapitaliseringsdatoFra: '2015-03-01', id: '198/2015'  },
      { kapitaliseringsdatoFra: '2015-12-29', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2016-01-01', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2017-01-01', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2018-01-01', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2019-01-01', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2020-01-01', id: '1700/2015' },
      { kapitaliseringsdatoFra: '2020-12-31', id: '9871/2020' },
      { kapitaliseringsdatoFra: '2021-01-01', id: '9871/2020' },
      { kapitaliseringsdatoFra: '2022-01-01', id: '9871/2020' },
      { kapitaliseringsdatoFra: '2023-01-01', id: '9871/2020' },
      { kapitaliseringsdatoFra: '2024-01-01', id: '9871/2020' },
      { kapitaliseringsdatoFra: '2024-07-01', id: '9376/2024' },
      { kapitaliseringsdatoFra: '2025-01-01', id: '10029/2024' },
      { kapitaliseringsdatoFra: '2025-12-31', id: '10183/2025' },
      { kapitaliseringsdatoFra: '2026-01-01', id: '10056/2025' },
    ],
  },

  {
    skadedatoFra: '2011-01-01',
    kapitaliseringer: [
      { kapitaliseringsdatoFra: '2011-01-01', id: '1220/2010' },
      { kapitaliseringsdatoFra: '2012-01-01', id: '1358/2011' },
      { kapitaliseringsdatoFra: '2013-01-01', id: '990/2012'  },
      { kapitaliseringsdatoFra: '2014-01-01', id: '1202/2013' },
      { kapitaliseringsdatoFra: '2015-01-01', id: '1275/2014' },
      { kapitaliseringsdatoFra: '2015-03-01', id: '199/2015'  },
      { kapitaliseringsdatoFra: '2015-12-29', id: '1663/2015' },
      { kapitaliseringsdatoFra: '2016-01-01', id: '1664/2015' },
      { kapitaliseringsdatoFra: '2017-01-01', id: '1275/2016' },
      { kapitaliseringsdatoFra: '2018-01-01', id: '1156/2017' },
      { kapitaliseringsdatoFra: '2019-01-01', id: '1233/2018' },
      { kapitaliseringsdatoFra: '2020-01-01', id: '9921/2019' },
      { kapitaliseringsdatoFra: '2020-12-31', id: '9870/2020' },
      { kapitaliseringsdatoFra: '2021-01-01', id: '9741/2020' },
      { kapitaliseringsdatoFra: '2022-01-01', id: '9864/2021' },
      { kapitaliseringsdatoFra: '2023-01-01', id: '10141/2022' },
      { kapitaliseringsdatoFra: '2024-01-01', id: '9820/2023' },
      { kapitaliseringsdatoFra: '2024-07-01', id: '9376/2024' },
      { kapitaliseringsdatoFra: '2025-01-01', id: '10029/2024' },
      { kapitaliseringsdatoFra: '2025-12-31', id: '10183/2025' },
      { kapitaliseringsdatoFra: '2026-01-01', id: '10056/2025' },
    ],
  },

  {
    skadedatoFra: '2021-01-01',
    kapitaliseringer: [
      { kapitaliseringsdatoFra: '2021-01-01', id: '9741/2020' },
      { kapitaliseringsdatoFra: '2022-01-01', id: '9864/2021' },
      { kapitaliseringsdatoFra: '2023-01-01', id: '10141/2022' },
      { kapitaliseringsdatoFra: '2024-01-01', id: '9820/2023' },
      { kapitaliseringsdatoFra: '2024-07-01', id: '9376/2024' },
      { kapitaliseringsdatoFra: '2025-01-01', id: '10029/2024' },
      { kapitaliseringsdatoFra: '2025-12-31', id: '10183/2025' },
      { kapitaliseringsdatoFra: '2026-01-01', id: '10056/2025' },
    ],
  },

];

export const kapitaliseringsbekendtgoerelser: KapitaliseringsSkadedatoInterval[] =
  RAW_KAPITALISERINGSBEKENDTGOERELSER.map((row) => ({
    skadedatoFra: toISODateString(row.skadedatoFra),
    kapitaliseringer: row.kapitaliseringer.map((kap) => ({
      kapitaliseringsdatoFra: toISODateString(kap.kapitaliseringsdatoFra),
      id: kap.id,
    })),
  }));

const resolveLatestKapitaliseringsdatoFraPerSkadesinterval = (
  interval: KapitaliseringsSkadedatoInterval
): ISODateString => {
  if (interval.kapitaliseringer.length === 0) {
    throw new Error(
      `CRITICAL: Kapitaliseringsinterval for skadedato ${interval.skadedatoFra} mangler kapitaliseringsdatoer`
    );
  }

  return interval.kapitaliseringer.reduce(
    (latest, current) => maxISO(latest, current.kapitaliseringsdatoFra),
    interval.kapitaliseringer[0].kapitaliseringsdatoFra
  );
};

// EET max-grænse fra bekendtgørelsesoversigten:
// Find den laveste "seneste kapitaliseringsdatoFra" på tværs af alle skadedato-intervaller.
// Når en seneste post endnu ikke er afløst af en ny post, gælder den foreløbigt kun
// til årets udgang, så resultatet er 31-12 i det år.
export const eetKapitaliseringsDatoMaxFraBekendtgoerelser: ISODateString = (() => {
  if (kapitaliseringsbekendtgoerelser.length === 0) {
    throw new Error('CRITICAL: kapitaliseringsbekendtgoerelser er tom');
  }

  const earliestLatestFraDate = kapitaliseringsbekendtgoerelser
    .map(resolveLatestKapitaliseringsdatoFraPerSkadesinterval)
    .reduce((earliest, current) => minISO(earliest, current));

  return endOfYearIso(isoYear(earliestLatestFraDate));
})();
