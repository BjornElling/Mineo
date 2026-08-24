import * as React from 'react';
import type { CollectionRef } from '../../inputCore/fieldAddress';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import { useCollectionRowCommands } from '../../inputCore/react/useCollectionRows';
import { useInputEvaluation } from '../../inputCore/react/useInputEvaluation';
import type { CellSpec } from '../../inputCore/react/useCellEditor';
import {
  useCollectionCellSpecBuilder,
  type CollectionRenderRow,
} from '../../inputCore/react/cellSpecBuilder';
import { usePlaceholderSlotIds } from '../../inputCore/react/placeholderSlots';

export type RenderRow = CollectionRenderRow;

/**
 * Fælles række-/placeholderbinding for dynamiske tabeller. Hooken holder kun UI-identiteten for den tomme
 * placeholder; alle eksisterende række-id'er og celleværdier kommer fra inputaggregatet. Cellernes dataidentitet
 * bygges af den fælles `buildCollectionCellSpec` (§3.2), som selv udleder ejer-id'erne af collectionens sti – så
 * en nested tabel ikke kan binde med for få entity-led.
 *
 * Render-modellen har ÉN konstruktion: `buildRenderRows(displayRows)` – de viste rækker i den orden,
 * de skal vises i, plus placeholderne sidst. Det var tidligere to konkurrerende konstruktioner, der
 * gav samme resultat ad hver sin vej: hooken byggede modellen af den USORTEREDE `committedRows` og
 * lod `useSortedCollectionTable` permutere den tilbage på plads bagefter, mens fire tabeller
 * sorterede først og byggede modellen i hånden af resultatet. Prisen for den anden vej var, at hver
 * af de fire ejede hele identitetskæden selv, med kun `usePlaceholderSlotIds` delt.
 *
 * Reconciliation-vejen bar desuden en defekt, som «byg af den viste orden» ikke kan have: den
 * genfandt placeholderen med `.find(kind === 'placeholder')` og tog altså kun den FØRSTE. En tabel
 * med `minimumVisibleRows > 1` ville tavst tabe sine øvrige tomme rækker. Det ramte ikke produktionen,
 * fordi netop de to tabeller, der viser flere tomme rækker, var blandt dem der gik uden om hooken –
 * altså præcis den «tre af fire rigtigt»-fejlmåde, hele rækkefølge-laget findes for at forhindre.
 *
 * `buildRenderRows` er en FUNKTION og ikke en `displayRows`-parameter, fordi rækkefølge-laget
 * har brug for `reorderRows` fra denne hook, mens render-modellen har brug for rækkefølge-lagets
 * `sortedRows`. Som parameter ville de to hooks skulle kaldes i en rækkefølge, ingen af dem kan
 * opfylde; som funktion forsvinder afhængigheden, og kaldstedet får stadig kun ét sted at bygge
 * modellen.
 */
export const useCollectionTable = <TRow extends Readonly<{ id: string }>>({
  collection,
  committedRows,
  createRowId,
  createEmptyRow,
  locationPrefix,
  locationNav,
  minimumVisibleRows = 1,
}: Readonly<{
  collection: CollectionRef;
  committedRows: readonly TRow[];
  createRowId: () => string;
  createEmptyRow: (id: string) => TRow;
  locationPrefix: string;
  /**
   * Mindste antal rækker, tabellen viser i alt (committede + tomme). Default 1 = altid præcis én trailing tom
   * række. Et højere tal er en ren VISNINGSregel og påvirker aldrig, hvad der persisteres – tomme rækker
   * gemmes ikke. Parameteren findes, fordi antalsreglen er den eneste saglige forskel mellem tabellerne; den
   * begrunder ikke en egen kopi af identitets- og bindingsalgoritmen.
   */
  minimumVisibleRows?: number;
  /**
   * Eksplicit navigation-metadata for cellernes editorlokationer (§3.7): route + fane for den side/fane, tabellen
   * bor på. Kalderen leverer den, fordi tabellen ikke kan udlede route af `locationPrefix`.
   *
   * PÅKRÆVET – både feltet og `route`. Var de valgfrie, kunne en ny tabel lydløst få rækkehandlinger uden
   * destination: dataene ville blive gendannet ved undo, men brugeren ville blive efterladt på en vilkårlig side
   * (§3.7). `tabKey: null` udtrykker eksplicit "siden har ingen faner"; udeladelse er ikke længere lovlig.
   */
  locationNav: Readonly<{ route: string; tabKey: string | null }>;
}>) => {
  const evaluation = useInputEvaluation();
  // KUN rækkekommandoerne: rækkerne kommer fra slice-projektionens `committedRows` (den kanoniske read-grænse),
  // så tabellen må ikke også abonnere på collectionens aggregat-id-liste – det ville være to reaktive
  // rækkekilder for samme collection. Kommandoerne bærer tabellens origin, så undo/redo af en rækkehandling
  // navigerer til den rette side/fane (§3.7).
  const rows = useCollectionRowCommands<TRow>(collection, {
    locationId: locationPrefix,
    route: locationNav.route,
    tabKey: locationNav.tabKey,
  });
  const committedIdSet = React.useMemo(() => new Set(committedRows.map((row) => row.id)), [committedRows]);
  // UI-tomhed er ikke det samme som beregningens canonical tomhed: en rejected råtekst er skjult i
  // rækkeprojektionen, men skal stadig give sletning og holde en ny trailing række fremme. Readeren ejer
  // den eneste prøve, inklusive undtagelsen for ikke-tømbare dropdown-defaults.
  const rowsWithSettledInput = React.useMemo(
    () => new Set(committedRows
      .filter((row) => evaluation.reader.hasEntityInput(collection, row.id))
      .map((row) => row.id)),
    [collection, committedRows, evaluation.reader]
  );
  const isRowEmpty = React.useCallback(
    (rowId: string): boolean => !rowsWithSettledInput.has(rowId),
    [rowsWithSettledInput]
  );
  // En committet række uden afsluttet input fungerer selv som den trailing indtastningsrække.
  const hasEmptyEntryRow = committedRows.some((row) => isRowEmpty(row.id));
  const placeholderCount = Math.max(hasEmptyEntryRow ? 0 : 1, minimumVisibleRows - committedRows.length);
  // Den ENE placeholder-identitets-livscyklus (§1.11/§3.7): puljen BEVARER et promoveret id, så det kan
  // genindtræde, hvis rækken forsvinder ved et undo – ellers findes der intet element, fokusrestoren kan
  // matche på, og fokus forlader lydløst tabellen.
  const placeholderIds = usePlaceholderSlotIds(committedIdSet, placeholderCount, createRowId);

  /**
   * Render-modellen for én visning: de viste rækker i den orden, de skal vises i, plus
   * placeholderne SIDST. Placeholderne er «næste tomme række», ikke data, og må aldrig kunne
   * sorteres ind mellem de udfyldte rækker.
   *
   * `displayRows` er som regel `sortedRows` fra `useSortedCollectionTable`, men enhver orden af de
   * committede rækker er lovlig – fx de base-række-ankrede tabellers «basisrække først, resten
   * sorteret». Det er bevidst RÆKKEFØLGEN alene: placeholder-identiteten udledes af MÆNGDEN af
   * committede id'er ovenfor, aldrig af den viste orden. Ellers kunne en sortering flytte den
   * tomme rækkes identitet, og en history-origin fra før sorteringen ville ikke længere kunne
   * finde sit element (§1.11/§3.7).
   */
  const buildRenderRows = React.useCallback(
    (displayRows: readonly TRow[] = committedRows): readonly RenderRow[] => [
      ...displayRows.map((row) => ({ rowId: row.id, kind: 'existing' as const })),
      ...placeholderIds.map((rowId) => ({ rowId, kind: 'placeholder' as const })),
    ],
    [committedRows, placeholderIds]
  );
  const committedById = React.useMemo(
    () => new Map(committedRows.map((row) => [row.id, row])),
    [committedRows]
  );

  // Én cellebindingsmodel for alle tabeller (§3.2): ejer-id'erne udledes af collectionens sti, ikke af en prop.
  const buildCellSpec: <T>(
    renderRow: RenderRow,
    descriptor: FieldDescriptor<T>,
    colIndex: number
  ) => CellSpec<T, TRow> = useCollectionCellSpecBuilder<TRow>({
    collection,
    createEmptyRow,
    locationPrefix,
    locationNav,
  });

  return React.useMemo(() => ({
    buildRenderRows,
    committedById,
    buildCellSpec,
    isRowEmpty,
    rowsWithSettledInput,
    removeRow: rows.remove,
    reorderRows: rows.reorder,
  }), [buildCellSpec, buildRenderRows, committedById, isRowEmpty, rows.remove, rows.reorder, rowsWithSettledInput]);
};
