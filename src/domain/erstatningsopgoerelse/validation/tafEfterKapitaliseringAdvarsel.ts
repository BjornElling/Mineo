import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { isoToDanish, type ISODateString } from '../../../types/branded';
import { toAnyFieldRef, type AnyFieldRef } from '../../../inputCore/fieldDescriptor';
import { eoTafPeriodeFraField, eoTafPeriodeTilField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { EetIssue } from '../../erhvervsevnetab/eetTypes';
import { TAF_EFTER_KAPITALISERING_ISSUE_ID_PREFIX } from '../../erhvervsevnetab/eetIssueNavigation';
import { clampTafRow, resolveTafConstraintBounds, type TafConstraintSource } from './tafPeriodConstraints';

// TAF efter kapitaliseringen af en delvist endelig EET-afgørelse (BB-187, udviklerafgørelse 2026-10-30).
//
// Udgangspunktet er, at en delvist endelig afgørelse i forhold til TAF behandles som en endelig: retten til TAF
// ophører på kapitaliseringstidspunktet. Der kan dog hypotetisk opstå sager, hvor TAF alligevel fortsætter, så
// reglen er IKKE en afskæring. Det er et absolut krav, at brugeren får besked – men kun som gul, ikke-blokerende
// advarsel; beregningen er uændret. Normativt i `eo-snapshot-contract.md` §2.4 og `domain-boundary-contract.md`
// §9 pkt. 11.
//
// Prøven bruger rækkens BEREGNEDE periode (samme grænser som motorens clamping): en periode, der allerede er
// afskåret før kapitaliseringen – af differencekravet, et endeligt EET eller EO-perioden – fortsætter ikke forbi
// den, og advarslen ville da tale om dage, der ikke regnes.

export type TafEfterKapitaliseringAdvarsel = Readonly<{
  rowId: string;
  /** Linjen i «Fejl og advarsler». Linket fører til rækkens første dato efter kapitaliseringen. */
  issue: EetIssue;
  /** Den gule ring: til-datoen, og fra-datoen, når hele perioden ligger efter kapitaliseringen. */
  cellWarnings: readonly Readonly<{ cells: readonly AnyFieldRef[]; cellMessage: string }>[];
}>;

const danish = (iso: ISODateString): string => isoToDanish(iso) ?? iso;

const kapitaliseringTekst = (dato: ISODateString): string =>
  `kapitaliseringsdatoen for den delvist endelige afgørelse om erhvervsevnetab på Erhvervsevnetab-siden (${danish(dato)})`;

const UDGANGSPUNKT_TEKST = 'TAF ophører som udgangspunkt ved kapitaliseringen';

/**
 * Én advarsel pr. TAF-række, hvis beregnede periode når kapitaliseringsdatoen eller senere. Datoen er
 * inklusiv som de øvrige afskæringsdatoer: TAF på selve kapitaliseringsdagen ligger efter den.
 *
 * Har flere delvist endelige afgørelser en kapitaliseringsdato, er den TIDLIGSTE afgørende: TAF efter en senere
 * kapitalisering ligger også efter den tidligste, så én dato pr. række er nok og navngiver den første grænse.
 *
 * En verserende klage over EET tavser ikke advarslen. Klagen suspenderer EO's egne afskæringer, men denne regel
 * er netop ikke en afskæring – kun en besked, og den skal stå uden undtagelse.
 */
export const resolveTafEfterKapitaliseringAdvarsler = (
  values: Pick<ErstatningsopgoerelseValues, 'kravPaaTabtArbejdsfortjeneste' | 'tafPerioder'> & TafConstraintSource,
  context: Readonly<{
    skadedatoISO: ISODateString | undefined;
    kapitaliseringsdatoer: readonly ISODateString[];
  }>,
): readonly TafEfterKapitaliseringAdvarsel[] => {
  if (values.kravPaaTabtArbejdsfortjeneste !== 'Ja') return [];
  const kapitaliseringsdato = [...context.kapitaliseringsdatoer].sort((left, right) => left.localeCompare(right))[0];
  if (kapitaliseringsdato === undefined) return [];
  const bounds = resolveTafConstraintBounds(values, { skadedatoISO: context.skadedatoISO });

  return Object.freeze(values.tafPerioder.flatMap((row) => {
    const beregnet = clampTafRow(row, bounds);
    if (beregnet === null || beregnet.til < kapitaliseringsdato) return [];
    const helePerioden = beregnet.fra >= kapitaliseringsdato;
    const fraField = toAnyFieldRef(eoTafPeriodeFraField.bind(row.id));
    const tilField = toAnyFieldRef(eoTafPeriodeTilField.bind(row.id));
    const message = `TAF-perioden ${danish(beregnet.fra)} - ${danish(beregnet.til)} ${helePerioden ? 'ligger' : 'fortsætter'} `
      + `på eller efter ${kapitaliseringTekst(kapitaliseringsdato)} – ${UDGANGSPUNKT_TEKST}`;
    const tilMessage = `Der er angivet tabt arbejdsfortjeneste på eller efter ${kapitaliseringTekst(kapitaliseringsdato)}. ${UDGANGSPUNKT_TEKST}`;
    const fraMessage = `Hele perioden ligger på eller efter ${kapitaliseringTekst(kapitaliseringsdato)}. ${UDGANGSPUNKT_TEKST}`;
    return [Object.freeze({
      rowId: row.id,
      issue: Object.freeze({
        id: `${TAF_EFTER_KAPITALISERING_ISSUE_ID_PREFIX}:${row.id}`,
        severity: 'warning' as const,
        message,
        focusTarget: { kind: 'fieldAddress' as const, address: (helePerioden ? fraField : tilField).address },
      }),
      cellWarnings: Object.freeze(helePerioden
        ? [{ cells: [fraField], cellMessage: fraMessage }, { cells: [tilField], cellMessage: tilMessage }]
        : [{ cells: [tilField], cellMessage: tilMessage }]),
    })];
  }));
};
