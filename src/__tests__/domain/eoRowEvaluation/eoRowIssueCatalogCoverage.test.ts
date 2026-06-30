import { CELL_TABLE_IDS, buildCellInvalidDraftFieldPath } from '../../../config/cellInvalidDraftScopes';
import {
  resolveEoIssueFocusTarget,
  resolveEoIssueSummaryText,
} from '../../../domain/eoRowEvaluation/eoRowIssueCatalog';
import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';

/**
 * Systematik-værn for EO-fejl/advarselstekster (jf. error-debug-contract.md).
 *
 * Formålet er at sikre, at hver fejlkilde i Beregning-fanen har en KORT, SPECIFIK og SELVSTÆNDIG
 * tekst — uden generiske catch-all-fraser og uden label-præfiks (det højrestillede link angiver
 * placeringen). Tabellen nedenfor er den autoritative liste over de tekster, der vises i dag, og
 * binder samtidig fejl til den korrekte fokus-celle.
 */

const makeRow = (patch: Partial<EoRowModel>): EoRowModel => ({
  id: 'row.id',
  label: 'Felt',
  displayValue: '-',
  status: 'error',
  ...patch,
});

// Fraser der aldrig må nå brugeren som færdig fejltekst: enten rene catch-alls (siger ikke HVAD der
// er galt) eller bagt-ind-præfikser, der dublerer linkets placeringsangivelse.
const BANNED_SUBSTRINGS = [
  'Ikke alle felter udfyldt',
  'Intet valgt',
  'Manglende indtastning',
  'Fejl: ',
  'Fejl i indtastning',
  'Indtastet sygeperiode men ikke år',
];

// Et standalone "<felt> mangler" kan læses som om VÆRDIEN er forsvundet i programmet i stedet for
// at brugeren mangler at indtaste den. Brug "er ikke angivet"/"er ikke udfyldt"/"er ikke valgt" eller
// en form med flere ord ("mangler at blive angivet", "Der mangler en …"). Værnet fanger derfor en
// besked, der ENDER på " mangler".
const endsWithBareMangler = (text: string): boolean => /\bmangler$/i.test(text.trim());

type Case = Readonly<{
  name: string;
  row: Partial<EoRowModel>;
  expectedSummary: string;
  expectedFocus?: { tableId: string; gridCellKey: string };
}>;

const CASES: readonly Case[] = [
  // ── Svie/smerte-perioder ──────────────────────────────────────────────────
  {
    name: 'svie/smerte – til-dato ikke angivet',
    row: { id: 'sviesmerte.periode.ss-1', label: 'Periode', message: 'Til-dato er ikke angivet', focusFieldHint: 'til' },
    expectedSummary: 'Til-dato er ikke angivet',
    expectedFocus: { tableId: CELL_TABLE_IDS.eoSvieSmerte, gridCellKey: 'ss-1:1' },
  },
  {
    name: 'svie/smerte – tilstand ikke angivet',
    row: { id: 'sviesmerte.periode.ss-1', label: 'Periode', message: 'Tilstand er ikke angivet', focusFieldHint: 'tilstand' },
    expectedSummary: 'Tilstand er ikke angivet',
    expectedFocus: { tableId: CELL_TABLE_IDS.eoSvieSmerte, gridCellKey: 'ss-1:3' },
  },
  {
    name: 'svie/smerte – rækkefølge',
    row: { id: 'sviesmerte.periode.ss-1', label: 'Periode', message: 'Til-dato skal være efter fra-dato', focusFieldHint: 'til' },
    expectedSummary: 'Til-dato skal være efter fra-dato',
  },
  {
    name: 'svie/smerte – datointerval får perioden navngivet',
    row: { id: 'sviesmerte.periode.ss-1', label: 'Periode', displayValue: 'Fejl (Dato skal være mellem 01-01-2024 og 31-12-2024)' },
    expectedSummary: 'Svie/smerte-perioden skal være mellem 01-01-2024 og 31-12-2024',
  },
  // ── TAF-perioder (incl. BUG: fra-cutoff må pege på fra-cellen) ─────────────
  {
    name: 'TAF – fra-dato ikke angivet peger på fra-cellen',
    row: { id: 'taf.periode.taf-1', label: 'Periode', message: 'Fra-dato er ikke angivet', focusFieldHint: 'fra' },
    expectedSummary: 'Fra-dato er ikke angivet',
    expectedFocus: { tableId: CELL_TABLE_IDS.eoTafPeriode, gridCellKey: 'taf-1:0' },
  },
  {
    name: 'TAF – cutoff på fra-dato peger på fra-cellen (ikke til, selv om beskeden indeholder "efter")',
    row: {
      id: 'taf.periode.taf-1',
      label: 'Periode',
      message: 'Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (01-01-2025)',
      focusFieldHint: 'fra',
    },
    expectedSummary: 'Der er angivet tabt arbejdsfortjeneste efter afgørelse om endeligt erhvervsevnetab (01-01-2025)',
    expectedFocus: { tableId: CELL_TABLE_IDS.eoTafPeriode, gridCellKey: 'taf-1:0' },
  },
  {
    name: 'TAF – datointerval får perioden navngivet',
    row: { id: 'taf.periode.taf-1', label: 'Periode', displayValue: 'Fejl (Dato skal være mellem 01-01-2024 og 31-12-2024)' },
    expectedSummary: 'TAF-perioden skal være mellem 01-01-2024 og 31-12-2024',
  },
  // ── Ferieperioder ─────────────────────────────────────────────────────────
  {
    name: 'TAF-ferie – fra-dato ikke angivet',
    row: { id: 'taf.ferie.f-1', label: 'Ferieperiode', message: 'Fra-dato er ikke angivet', focusFieldHint: 'fra' },
    expectedSummary: 'Fra-dato er ikke angivet',
    expectedFocus: { tableId: CELL_TABLE_IDS.eoFerieperiode, gridCellKey: 'f-1:0' },
  },
  {
    name: 'Beregningsgrundlag-ferie – uden for beregningsperioden',
    row: { id: 'taf.beregningsgrundlag.ferie.f-1', label: 'Ferieperiode', displayValue: 'Fejl (Ferieperioden ligger uden for beregningsperioden)' },
    expectedSummary: 'Ferieperioden ligger uden for beregningsperioden',
  },
  // ── Øvrige erstatningskrav ────────────────────────────────────────────────
  {
    name: 'øvrige krav – beskrivelse og beløb ikke udfyldt peger på beskrivelsescellen',
    row: { id: 'oevrigekrav.k-1', label: 'Øvrigt erstatningskrav', message: 'Beskrivelse og beløb er ikke udfyldt', summaryDisplay: 'messageOnly' },
    expectedSummary: 'Beskrivelse og beløb er ikke udfyldt',
    expectedFocus: { tableId: CELL_TABLE_IDS.eoOevrigeKrav, gridCellKey: 'k-1:1' },
  },
  {
    name: 'øvrige krav – beløb ikke angivet peger på beløbscellen',
    row: { id: 'oevrigekrav.k-1', label: 'Tandlæge', message: 'Beløb er ikke angivet', summaryDisplay: 'messageOnly' },
    expectedSummary: 'Beløb er ikke angivet',
    expectedFocus: { tableId: CELL_TABLE_IDS.eoOevrigeKrav, gridCellKey: 'k-1:2' },
  },
  // ── Sygeferiegodtgørelse ──────────────────────────────────────────────────
  {
    name: 'SFGG – beregningskilde ikke valgt',
    row: { id: 'sfgg.beregningskilde.af-1', label: 'Sygeferiegodtgørelse beregnes ud fra', message: 'Intet valgt' },
    expectedSummary: 'Beregningsgrundlag for sygeferiegodtgørelse er ikke valgt',
  },
  {
    name: 'SFGG – ukendt overenskomst',
    row: { id: 'sfgg.beregningskilde.af-1', label: 'Sygeferiegodtgørelse beregnes ud fra', message: 'Ukendt overenskomst-ID' },
    expectedSummary: 'Den valgte overenskomst for sygeferiegodtgørelse er ukendt',
  },
  {
    name: 'SFGG – satsvalg ikke valgt',
    row: { id: 'sfgg.satsvalg.af-1', label: 'Uddannelse og arbejdssted', message: 'Intet valgt' },
    expectedSummary: 'Uddannelse og arbejdssted for sygeferiegodtgørelse er ikke valgt',
  },
  // ── Lønudvikling / regulering ─────────────────────────────────────────────
  {
    name: 'regulering – statistik ikke valgt',
    row: { id: 'loenindkomst.af-1.regulering.valgt', label: 'Valgt regulering', message: 'Statistisk beregningsmodel er ikke valgt' },
    expectedSummary: "Regulering er sat til 'Statistik', men ingen statistisk beregningsmodel er valgt",
  },
  {
    name: 'regulering – KRL ikke valgt',
    row: { id: 'loenindkomst.af-1.regulering.valgt', label: 'Valgt regulering', message: 'KRL satstabel er ikke valgt' },
    expectedSummary: "Regulering er sat til 'KRL', men ingen KRL-satstabel er valgt",
  },
  {
    name: 'offentlig løn – løntrin ikke angivet vises uden label-præfiks',
    row: { id: 'loenindkomst.af-1.regulering.offentligLoenoplysninger', label: 'KL-/RLTN-oplysninger', displayValue: 'Fejl (Løntrin er ikke angivet)' },
    expectedSummary: 'Løntrin er ikke angivet',
  },
  // ── Mén / EET-datoer ──────────────────────────────────────────────────────
  {
    name: 'mén – afgørelsesdato ikke angivet',
    row: { id: 'aes.menAfgoerelseDato', label: 'Mén-afgørelsesdato', displayValue: 'Fejl (Afgørelsesdato mangler)' },
    expectedSummary: 'Dato for ménafgørelse er ikke angivet',
  },
  {
    name: 'midlertidigt EET – dato ikke angivet',
    row: { id: 'aes.midlertidigEETAfgoerelseDato', label: 'Dato for midlertidig EET-afgørelse', displayValue: 'Fejl (Afgørelsesdato eller virkningsdato mangler)' },
    expectedSummary: 'Afgørelses- eller virkningsdato for midlertidig EET-afgørelse er ikke angivet',
  },
  {
    name: 'endeligt EET – dato ikke angivet',
    row: { id: 'aes.endeligEETAfgoerelseDato', label: 'Dato for endelig EET-afgørelse', displayValue: 'Fejl (Afgørelsesdato eller virkningsdato mangler)' },
    expectedSummary: 'Afgørelses- eller virkningsdato for endelig EET-afgørelse er ikke angivet',
  },
];

describe('eoRowIssueCatalog – systematisk dækning', () => {
  it.each(CASES)('$name', ({ row, expectedSummary, expectedFocus }) => {
    const model = makeRow(row);
    expect(resolveEoIssueSummaryText(model)).toBe(expectedSummary);
    if (expectedFocus) {
      expect(resolveEoIssueFocusTarget(model)).toEqual({
        kind: 'fieldPath',
        fieldPath: buildCellInvalidDraftFieldPath(expectedFocus.tableId, '', expectedFocus.gridCellKey),
      });
    }
  });

  it('ingen viste fejltekster indeholder generiske catch-all-fraser eller label-præfiks', () => {
    for (const { row } of CASES) {
      const summary = resolveEoIssueSummaryText(makeRow(row)) ?? '';
      for (const banned of BANNED_SUBSTRINGS) {
        expect(summary).not.toContain(banned);
      }
      // Intet "Label: …"-præfiks (linket angiver allerede placeringen).
      expect(summary.startsWith(`${row.label}:`)).toBe(false);
      // Intet standalone "… mangler" til sidst (læses som om værdien er forsvundet i programmet).
      expect(endsWithBareMangler(summary)).toBe(false);
    }
  });
});
