import {
  resolveEoIssueFocusTarget,
  resolveEoIssueSummaryText,
} from '../../../domain/eoRowEvaluation/eoRowIssueCatalog';
import {
  eoFerieperiodeFraField,
  eoOevrigeKravBeloebField,
  eoOevrigeKravUdgiftTilField,
  eoSfggBeregningskildeField,
  eoSfggSatsvalgField,
  eoSvieSmertePeriodeFraField,
  eoSvieSmertePeriodeTilField,
  eoSvieSmertePeriodeTilstandField,
  eoTafPeriodeFraField,
  eoTafPeriodeTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { eoEmploymentFields } from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type { FieldDescriptor } from '../../../inputCore/fieldDescriptor';
import type { EoRowModel } from '../../../domain/eoRowEvaluation/eoRowTypes';

/**
 * Systematik-værn for EO-fejl/advarselstekster (jf. error-contract.md).
 *
 * Formålet er at sikre, at hver fejlkilde i Beregning-fanen har en KORT, SPECIFIK og SELVSTÆNDIG
 * tekst — uden generiske catch-all-fraser og uden label-præfiks (det højrestillede link angiver
 * placeringen). Tabellen nedenfor er den autoritative liste over de tekster, der vises i dag, og
 * binder samtidig fejl til det korrekte fokusfelt — udtrykt som produktionens egen descriptor, så
 * forventningen er den adresse, feltet faktisk bærer i DOM.
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
  /**
   * Det felt, fejlens link skal føre til. Angives som produktionens egen DESCRIPTOR plus rækkens id, så
   * forventningen er den samme kanoniske adresse cellen redigeres på (§3.2) — ikke en DOM-strengkonvention,
   * der kan være sand i testen og uopnåelig i produktionen.
   */
  expectedFocus?: RowFieldFocus;
}>;

/**
 * Rækkefelt-fokus, type-udslettet over feltets værditype: kun `bind(rowId).address` bruges, og adressen
 * er værdi-uafhængig. `unknown` frem for `any`, så en forkert form stadig er en typefejl.
 */
type RowFieldFocus = Readonly<{ field: FieldDescriptor<unknown>; rowId: string }>;

const focus = <T>(field: FieldDescriptor<T>, rowId: string): RowFieldFocus =>
  ({ field: field as FieldDescriptor<unknown>, rowId });

const CASES: readonly Case[] = [
  // ── Svie/smerte-perioder ──────────────────────────────────────────────────
  {
    name: 'svie/smerte – til-dato ikke angivet',
    row: { id: 'sviesmerte.periode.ss-1', label: 'Periode', message: 'Til-dato er ikke angivet', focusFieldHint: 'til' },
    expectedSummary: 'Til-dato er ikke angivet',
    expectedFocus: focus(eoSvieSmertePeriodeTilField, 'ss-1'),
  },
  {
    name: 'svie/smerte – tilstand ikke angivet',
    row: { id: 'sviesmerte.periode.ss-1', label: 'Periode', message: 'Tilstand er ikke angivet', focusFieldHint: 'tilstand' },
    expectedSummary: 'Tilstand er ikke angivet',
    expectedFocus: focus(eoSvieSmertePeriodeTilstandField, 'ss-1'),
  },
  {
    name: 'svie/smerte – rækkefølge',
    row: { id: 'sviesmerte.periode.ss-1', label: 'Periode', message: 'Til-dato skal være efter fra-dato', focusFieldHint: 'til' },
    expectedSummary: 'Til-dato skal være efter fra-dato',
    expectedFocus: focus(eoSvieSmertePeriodeTilField, 'ss-1'),
  },
  // Tilstands-hintet er ligeledes autoritativt: beskeden nævner ikke tilstanden, så ordlyd-grenen ville
  // vælge en datocelle. Uden denne case er `hint === 'tilstand'` ubevist.
  {
    name: 'svie/smerte – tilstands-hintet vinder over ordlyden',
    row: { id: 'sviesmerte.periode.ss-1', label: 'Periode', message: 'Perioden er ikke fuldt dækket', focusFieldHint: 'tilstand' },
    expectedSummary: 'Perioden er ikke fuldt dækket',
    expectedFocus: focus(eoSvieSmertePeriodeTilstandField, 'ss-1'),
  },
  // Og uden hint: ordlyden vælger fra-feltet, når intet peger på til-datoen.
  {
    name: 'svie/smerte – uden hint vælges fra-feltet af ordlyden',
    row: { id: 'sviesmerte.periode.ss-1', label: 'Periode', message: 'Fra-dato er ikke angivet' },
    expectedSummary: 'Fra-dato er ikke angivet',
    expectedFocus: focus(eoSvieSmertePeriodeFraField, 'ss-1'),
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
    expectedFocus: focus(eoTafPeriodeFraField, 'taf-1'),
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
    expectedFocus: focus(eoTafPeriodeFraField, 'taf-1'),
  },
  {
    name: 'TAF – datointerval får perioden navngivet',
    row: { id: 'taf.periode.taf-1', label: 'Periode', displayValue: 'Fejl (Dato skal være mellem 01-01-2024 og 31-12-2024)' },
    expectedSummary: 'TAF-perioden skal være mellem 01-01-2024 og 31-12-2024',
  },
  // Hintet er AUTORITATIVT over ordlyden. Denne case er den ENESTE, hvor de to er UENIGE: beskeden
  // navngiver ingen til-dato, så ordlyd-heuristikken ville vælge fra-feltet, men row-builderen VED at
  // fejlen sidder på til-datoen. Uden en uenig case er hintets forrang ubevist — enhver anden hint-case
  // ville også bestå med ren ordlyd-gætning.
  {
    name: 'TAF – hintet vinder over ordlyden, når de er uenige',
    row: {
      id: 'taf.periode.taf-1',
      label: 'Periode',
      message: 'Perioden ligger efter folkepensionsalderen',
      focusFieldHint: 'til',
    },
    expectedSummary: 'Perioden ligger efter folkepensionsalderen',
    expectedFocus: focus(eoTafPeriodeTilField, 'taf-1'),
  },
  // Modstykket: uden hint SKAL ordlyden bruges, ellers ville en fjernet heuristik være usynlig.
  {
    name: 'TAF – uden hint vælges til-feltet af ordlyden',
    row: {
      id: 'taf.periode.taf-1',
      label: 'Periode',
      message: 'Til-dato skal være efter fra-dato',
    },
    expectedSummary: 'Til-dato skal være efter fra-dato',
    expectedFocus: focus(eoTafPeriodeTilField, 'taf-1'),
  },
  // ── Ferieperioder ─────────────────────────────────────────────────────────
  {
    name: 'TAF-ferie – fra-dato ikke angivet',
    row: { id: 'taf.ferie.f-1', label: 'Ferieperiode', message: 'Fra-dato er ikke angivet', focusFieldHint: 'fra' },
    expectedSummary: 'Fra-dato er ikke angivet',
    expectedFocus: focus(eoFerieperiodeFraField, 'f-1'),
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
    expectedFocus: focus(eoOevrigeKravUdgiftTilField, 'k-1'),
  },
  {
    name: 'øvrige krav – beløb ikke angivet peger på beløbscellen',
    row: { id: 'oevrigekrav.k-1', label: 'Tandlæge', message: 'Beløb er ikke angivet', summaryDisplay: 'messageOnly' },
    expectedSummary: 'Beløb er ikke angivet',
    expectedFocus: focus(eoOevrigeKravBeloebField, 'k-1'),
  },
  // ── Sygeferiegodtgørelse ──────────────────────────────────────────────────
  {
    name: 'SFGG – beregningskilde ikke valgt',
    row: { id: 'sfgg.beregningskilde.af-1', label: 'Sygeferiegodtgørelse beregnes ud fra', message: 'Intet valgt' },
    expectedSummary: 'Beregningsgrundlag for sygeferiegodtgørelse er ikke valgt',
    expectedFocus: focus(eoSfggBeregningskildeField, 'af-1'),
  },
  {
    name: 'SFGG – ukendt overenskomst',
    row: { id: 'sfgg.beregningskilde.af-1', label: 'Sygeferiegodtgørelse beregnes ud fra', message: 'Ukendt overenskomst-ID' },
    expectedSummary: 'Den valgte overenskomst for sygeferiegodtgørelse er ukendt',
    expectedFocus: focus(eoSfggBeregningskildeField, 'af-1'),
  },
  {
    name: 'SFGG – satsvalg ikke valgt',
    row: { id: 'sfgg.satsvalg.af-1', label: 'Uddannelse og arbejdssted', message: 'Intet valgt' },
    expectedSummary: 'Uddannelse og arbejdssted for sygeferiegodtgørelse er ikke valgt',
    expectedFocus: focus(eoSfggSatsvalgField, 'af-1'),
  },
  {
    name: 'SFGG – overenskomst ikke valgt',
    row: { id: 'sfgg.overenskomst.af-1', label: 'Overenskomst (angivet ovenfor)', message: 'Ingen overenskomst valgt' },
    expectedSummary: 'Det er angivet, at SFGG fastsættes efter overenskomst, men ingen overenskomst er valgt',
    expectedFocus: focus(eoEmploymentFields.overenskomstId, 'af-1'),
  },
  {
    name: 'lønindkomst – manglende arbejdsstedsnavn peger på tekstfeltet',
    row: { id: 'loenindkomst.af-1.arbejdsstedNavn', label: 'Navn på arbejdssted', message: 'er ikke angivet', status: 'warning' },
    expectedSummary: "'Navn på arbejdssted' er ikke angivet",
    expectedFocus: focus(eoEmploymentFields.navnPaaArbejdssted, 'af-1'),
  },
  // ── Lønudvikling / regulering ─────────────────────────────────────────────
  {
    name: 'regulering – statistik ikke valgt',
    row: { id: 'loenindkomst.af-1.regulering.valgt', label: 'Valgt regulering', message: 'Statistisk beregningsmodel er ikke valgt' },
    expectedSummary: "Regulering er sat til 'Statistik', men ingen statistisk beregningsmodel er valgt",
    expectedFocus: focus(eoEmploymentFields.loenudviklingStatistikModel, 'af-1'),
  },
  {
    name: 'regulering – KRL ikke valgt',
    row: { id: 'loenindkomst.af-1.regulering.valgt', label: 'Valgt regulering', message: 'KRL satstabel er ikke valgt' },
    expectedSummary: "Regulering er sat til 'KRL', men ingen KRL-satstabel er valgt",
    expectedFocus: focus(eoEmploymentFields.loenudviklingKRLSatstabel, 'af-1'),
  },
  {
    name: 'offentlig løn – løntrin ikke angivet vises uden label-præfiks',
    row: { id: 'loenindkomst.af-1.regulering.offentligLoenoplysninger', label: 'KL-/RLTN-oplysninger', displayValue: 'Fejl (Løntrin er ikke angivet)' },
    expectedSummary: 'Løntrin er ikke angivet',
    expectedFocus: focus(eoEmploymentFields.offentligLoenTrin, 'af-1'),
  },
  // ── Mén / EET-datoer ──────────────────────────────────────────────────────
  {
    name: 'mén – afgørelsesdato ikke angivet',
    row: { id: 'aes.menAfgoerelseDato', label: 'Mén-afgørelsesdato', displayValue: 'Advarsel (Afgørelsesdato mangler)', status: 'warning' },
    expectedSummary: 'Dato for ménafgørelse er ikke angivet',
  },
  {
    name: 'midlertidigt EET – dato ikke angivet',
    row: { id: 'aes.midlertidigEETAfgoerelseDato', label: 'Dato for midlertidig EET-afgørelse', displayValue: 'Advarsel (Afgørelsesdato eller virkningsdato mangler)', status: 'warning' },
    expectedSummary: 'Afgørelses- eller virkningsdato for midlertidig EET-afgørelse er ikke angivet',
  },
  {
    name: 'endeligt EET – dato ikke angivet',
    row: { id: 'aes.endeligEETAfgoerelseDato', label: 'Dato for endelig EET-afgørelse', displayValue: 'Advarsel (Afgørelsesdato eller virkningsdato mangler)', status: 'warning' },
    expectedSummary: 'Afgørelses- eller virkningsdato for endelig EET-afgørelse er ikke angivet',
  },
];

describe('eoRowIssueCatalog – systematisk dækning', () => {
  it.each(CASES)('$name', ({ row, expectedSummary, expectedFocus }) => {
    const model = makeRow(row);
    expect(resolveEoIssueSummaryText(model)).toBe(expectedSummary);
    expect(resolveEoIssueFocusTarget(model)).toBeDefined();
    if (expectedFocus) {
      expect(resolveEoIssueFocusTarget(model)).toEqual({
        kind: 'fieldAddress',
        address: expectedFocus.field.bind(expectedFocus.rowId).address,
      });
    }
  });

  it.each([
    'loenindkomst.af-1.loenoplysninger',
    'loenindkomst.af-1.regulering.alleVaerdier',
    'offentligeYdelser.dagpenge',
    'sfgg.referencesats.af-1',
    'sfgg.advarsel.seksmaaneder.af-1',
    'taf.beregningsgrundlag.arbejdsdage',
  ])('giver det bevidste samlede fokusmål til %s', (rowId) => {
    const target = resolveEoIssueFocusTarget(makeRow({ id: rowId }));

    expect(target).toEqual({ kind: 'rowId', rowId });
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
