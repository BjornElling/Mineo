import type { ErstatningsopgoerelseValues, SvieSmertePeriodeRow, TafPeriodeRow } from '../../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import { getDayAfterIso } from '../../../utils/isoDateHelpers';
import { isValidClosedDateRange, type ClosedDateRange } from '../../../utils/closedDateRange';
import { toAnyFieldRef, type AnyFieldRef, type FieldDescriptor } from '../../../inputCore/fieldDescriptor';
import {
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';

// To rækker, hvor den ene periode begynder dagen efter, at den anden slutter, er én sammenhængende periode
// skrevet i to rækker. Det er lovligt og regnes med, men er usædvanligt nok til en gul ring og en linje i
// «Fejl og advarsler» (udviklerønske 2026-10-29). Overlap er en anden – rød – regel (`periodOverlapIssues.ts`);
// to sammenhængende perioder overlapper netop ikke.

/** Én sammenhængende periode skrevet i to rækker. `rowId` er den SENESTE række, som også bærer linket. */
export type SammenhaengendePeriodeAdvarsel = Readonly<{
  rowId: string;
  summaryMessage: string;
  focusField: AnyFieldRef;
  /** Den tidligste rækkes til-dato og den seneste rækkes fra-dato: de to datoer, der mødes. */
  cellWarnings: readonly Readonly<{ cells: readonly AnyFieldRef[]; cellMessage: string }>[];
}>;

type DateField = FieldDescriptor<ISODateString | undefined>;
type PeriodeRaekke = Readonly<{ id: string; fra?: ISODateString | undefined; til?: ISODateString | undefined }>;

const danish = (iso: ISODateString): string => isoToDanish(iso) ?? iso;
const periodeTekst = (range: ClosedDateRange): string => `${danish(range.fra)} - ${danish(range.til)}`;

const findSammenhaengendePerioder = <TRow extends PeriodeRaekke>(
  rows: readonly TRow[],
  fields: Readonly<{ fra: DateField; til: DateField }>,
  tabelFlertal: string,
  sammeGruppe: (a: TRow, b: TRow) => boolean,
): readonly SammenhaengendePeriodeAdvarsel[] => {
  const gyldige = rows.flatMap((row) => {
    const range = { fra: row.fra, til: row.til };
    return isValidClosedDateRange(range) ? [{ row, range }] : [];
  });
  const advarsler: SammenhaengendePeriodeAdvarsel[] = [];
  for (const tidlig of gyldige) {
    const naesteDag = getDayAfterIso(tidlig.range.til);
    for (const sen of gyldige) {
      if (sen.range.fra !== naesteDag || !sammeGruppe(tidlig.row, sen.row)) continue;
      advarsler.push(Object.freeze({
        rowId: sen.row.id,
        summaryMessage: `${tabelFlertal} ${periodeTekst(tidlig.range)} og ${periodeTekst(sen.range)} hænger sammen og kan skrives i én række`,
        focusField: toAnyFieldRef(fields.fra.bind(sen.row.id)),
        cellWarnings: Object.freeze([
          {
            cells: [toAnyFieldRef(fields.til.bind(tidlig.row.id))],
            cellMessage: `Perioden fortsætter i perioden ${periodeTekst(sen.range)} og kan skrives i samme række`,
          },
          {
            cells: [toAnyFieldRef(fields.fra.bind(sen.row.id))],
            cellMessage: `Perioden fortsætter perioden ${periodeTekst(tidlig.range)} og kan skrives i samme række`,
          },
        ]),
      }));
    }
  }
  return Object.freeze(advarsler);
};

/** TAF-perioder, der hænger sammen. Tavst, når TAF-kravet ikke er «Ja» – tabellen er da skjult. */
export const resolveTafSammenhaengendePerioder = (
  values: Pick<ErstatningsopgoerelseValues, 'kravPaaTabtArbejdsfortjeneste' | 'tafPerioder'>,
): readonly SammenhaengendePeriodeAdvarsel[] => {
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja') return [];
  return findSammenhaengendePerioder<TafPeriodeRow>(
    values.tafPerioder,
    { fra: eoTafPeriodeFraField, til: eoTafPeriodeTilField },
    'TAF-perioderne',
    () => true,
  );
};

/**
 * Svie/smerte-perioder, der hænger sammen OG har samme tilstand. En sygemelding, der går over i en delvis
 * sygemelding, skal stå i to rækker. Samme relevans-guard som overlappet (`svieSmerteOverlapIssues.ts`).
 */
export const resolveSvieSmerteSammenhaengendePerioder = (
  values: Pick<ErstatningsopgoerelseValues, 'kravPaaSvieSmerteGodtgoerelse' | 'tidligereSsMax' | 'svieSmertePerioder'>,
): readonly SammenhaengendePeriodeAdvarsel[] => {
  if (values.kravPaaSvieSmerteGodtgoerelse !== 'Ja' || values.tidligereSsMax !== 'Nej') return [];
  return findSammenhaengendePerioder<SvieSmertePeriodeRow>(
    values.svieSmertePerioder,
    { fra: eoSvieSmertePeriodeFraField, til: eoSvieSmertePeriodeTilField },
    'Svie/smerte-perioderne',
    (a, b) => a.tilstand !== undefined && a.tilstand === b.tilstand,
  );
};
