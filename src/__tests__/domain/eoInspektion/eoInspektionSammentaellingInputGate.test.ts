/**
 * Brugerfund 2026-09-17: et overlap mellem beregningsperioden og TAF-perioden gav BÅDE den
 * rigtige, røde række OG en falsk `control:sammentaelling_mismatch`.
 *
 * Kontrollens to sider hvilede på hver sit inputkrav: den beregnede side krævede et gyldigt,
 * ikke-overlappende input, mens tabelsiden talte arbejdsdage uanset. Resultatet var et «beregnet=-,
 * tabel=263», som kontrolmodellen læste som en uoverensstemmelse – og den er en SYSTEMFEJL, der
 * routes til `reportSystemIssue` og åbner notitsen «Teknisk fejl registreret». Brugeren blev
 * dermed sendt efter en kodefejl i stedet for efter sin egen dato.
 *
 * Testen pinner begge halvdele af rettelsen: uoverensstemmelsen er væk, OG den ægte fejl står
 * uændret som en blokerende rød række.
 */
import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { buildEoTafBeregningsgrundlagRows } from '../../../domain/eoRowEvaluation/eoRowTafBeregningsgrundlagRows';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

/**
 * Beregningsperioden slutter PRÆCIS den dag, TAF-perioden begynder. For brugeren ser det ud som to
 * perioder i forlængelse af hinanden; for den lukkede intervalalgebra er 01-03-2024 en fælles dag,
 * altså et overlap.
 */
const buildOverlappingValues = (): ErstatningsopgoerelseValues => ({
  ...structuredClone(createErstatningsopgoerelseInitialValues()),
  beregnesUdFra: 'Beregningsperiode',
  tafBeregningsperiodeFra: iso('2023-03-01'),
  tafBeregningsperiodeTil: iso('2024-03-01'),
  kravPaaTabtArbejdsfortjeneste: 'Ja',
  tafPerioder: [{ id: 'taf_row_overlap', fra: iso('2024-03-01'), til: iso('2026-02-26') }],
});

const buildAdjacentValues = (): ErstatningsopgoerelseValues => ({
  ...buildOverlappingValues(),
  tafBeregningsperiodeTil: iso('2024-02-29'),
});

const stamdata = {
  ...STAMDATA_INITIAL_VALUES,
  skadestype: 'Erhvervssygdom' as const,
  skadedato: iso('2024-04-09'),
};

const controlMismatchInvariants = (values: ErstatningsopgoerelseValues): readonly string[] => {
  const snapshot = computeEoSnapshot({
    revision: 'test',
    stamdataValues: stamdata,
    eoValues: values,
    dagsDatoISO: iso('2026-09-17'),
  });
  return snapshot.invariants
    .filter((invariant) => !invariant.passed && invariant.id === 'control:sammentaelling_mismatch')
    .flatMap((invariant) => invariant.evidence ?? []);
};

describe('sammentællingskontrollens inputgate', () => {
  it('overlappende beregningsperiode giver INGEN kontroluoverensstemmelse', () => {
    expect(controlMismatchInvariants(buildOverlappingValues())).toEqual([]);
  });

  it('overlappet står stadig som den ægte, blokerende fejl brugeren skal rette', () => {
    const rows = buildEoTafBeregningsgrundlagRows(
      buildOverlappingValues(),
      EMPTY_FIELD_ISSUE_SET,
      stamdata
    );
    const beregningsperiodeRow = rows.find((row) => row.id === 'taf.beregningsgrundlag.beregningsperiode');

    expect(beregningsperiodeRow?.status).toBe('error');
    expect(beregningsperiodeRow?.displayValue).toContain('Der er overlap mellem beregningsperioden');
  });

  it('en beregningsperiode, der slutter dagen før TAF-perioden, er hverken fejl eller uoverensstemmelse', () => {
    const values = buildAdjacentValues();
    const rows = buildEoTafBeregningsgrundlagRows(values, EMPTY_FIELD_ISSUE_SET, stamdata);
    const beregningsperiodeRow = rows.find((row) => row.id === 'taf.beregningsgrundlag.beregningsperiode');

    expect(beregningsperiodeRow?.status).not.toBe('error');
    expect(controlMismatchInvariants(values)).toEqual([]);
  });

  /**
   * Den anden bekræftede brugerrejse: «Øvrigt fravær uden løn» sat til Ja, mens antalsfeltet
   * endnu er tomt. Den rammer under helt almindelig indtastning – to klik er nok – og pinnes
   * derfor på SNAPSHOT-niveau, hvor invarianten faktisk bygges og når brugeren.
   */
  it('manglende antal øvrige fraværsdage giver INGEN kontroluoverensstemmelse', () => {
    const values: ErstatningsopgoerelseValues = {
      ...buildAdjacentValues(),
      oevrigtFravaerUdenLoen: 'Ja',
      oevrigeFravaersdage: undefined,
    };

    expect(controlMismatchInvariants(values)).toEqual([]);
  });

  /**
   * Tredje bekræftede indgang: en gemt `ydelsestype` kan bære den viste LABEL i stedet for nøglen.
   * Indtægtssiden normaliserede den, kontroltabellen gjorde ikke – og forskellen blev til en
   * systemfejl, der var den ENESTE besked brugeren fik.
   */
  it('ydelsestype gemt som label behandles som nøglen i begge sider af kontrollen', () => {
    const medYdelse = (ydelsestype: string): ErstatningsopgoerelseValues => ({
      ...buildAdjacentValues(),
      offentligeYdelserRows: [{
        id: 'oy_label',
        fraDato: iso('2024-03-01'),
        tilDato: iso('2024-03-31'),
        ydelse: { kind: 'number', value: 100 },
        ydelsestype,
      }],
    });

    expect(controlMismatchInvariants(medYdelse('Sygedagpenge'))).toEqual([]);
    expect(controlMismatchInvariants(medYdelse('sygedagpenge'))).toEqual([]);
  });
});
