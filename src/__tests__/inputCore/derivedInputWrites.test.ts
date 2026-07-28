import {
  createEmptySettledInput,
  reduceInputCommand,
  settleField,
  clearField,
  setImmediateField,
  inputTransaction,
  inputTransactionStep,
  type DerivedInputWrite,
  type PersistedInputSections,
  type SettledInput,
} from '../../inputCore';
import {
  aargangField,
  beregningsdatoField,
  createTestCatalog,
  enhedField,
  kommentarerField,
  makeRow,
  rentekravRowsRef,
} from './testCatalog';
import { insertRow } from '../../inputCore/inputReducer';

/**
 * Mekanismetests for AFLEDTE SKRIVNINGER (§3.6, GM-F02).
 *
 * En afledt skrivning er et felt, hvis kanoniske værdi er en funktion af andre afsluttede felter. Kravet er,
 * at konsekvensen materialiseres i SAMME reducerede kandidat som årsagen — ikke som en selvstændig senere
 * handling. Testene her måler netop det: at reglen kører for hver command-art, at den ikke kan skrive uden
 * for sin sektion, og at en ikke-idempotent regel afvises frem for at give en skrivecyklus.
 */

/**
 * Testregel: `renteberegning.kommentarer` afledes af `satser.aargang`. Bevidst en KRYDS-SEKTIONS-læsning
 * med en afgrænset skriveflade — samme form som produktionens satsregel.
 */
const kommentarFollowsAargang: DerivedInputWrite = Object.freeze({
  id: 'test.kommentarFollowsAargang',
  writesSection: 'renteberegning',
  materialize: (sections: PersistedInputSections): PersistedInputSections => {
    const aargang = sections.satser?.aargang;
    const expected = aargang === undefined ? undefined : `afledt:${aargang}`;
    const rente = sections.renteberegning;
    if (rente === null) return sections;
    if (rente.kommentarer === expected) return sections;
    return { ...sections, renteberegning: { ...rente, kommentarer: expected } };
  },
});

const withCatalog = (rules: readonly DerivedInputWrite[]) => {
  const catalog = createTestCatalog(rules);
  const reduce = (input: SettledInput, ...args: Parameters<typeof settleField>) =>
    reduceInputCommand(input, settleField(...args), catalog).input;
  return { catalog, reduce };
};

describe('afledte skrivninger', () => {
  it('materialiserer konsekvensen i SAMME reduktion som årsagen', () => {
    const { catalog } = withCatalog([kommentarFollowsAargang]);
    // Baseline: en renteberegning-sektion skal findes, før reglen har noget at skrive i.
    const seeded = reduceInputCommand(
      createEmptySettledInput(),
      settleField(beregningsdatoField.bind(), '01-01-2024'),
      catalog
    ).input;

    const after = reduceInputCommand(seeded, settleField(aargangField.bind(), '2025'), catalog).input;

    // ÉN reduktion har både årsagen og konsekvensen. Havde konsekvensen krævet en anden command, ville
    // kommentarfeltet stadig være tomt her — og brugeren ville skulle fortryde to gange.
    expect(after.sections.satser?.aargang).toBe(2025);
    expect(after.sections.renteberegning?.kommentarer).toBe('afledt:2025');
  });

  it('kører for hver command-art, ikke kun for felt-settle', () => {
    const { catalog } = withCatalog([kommentarFollowsAargang]);
    const seeded = reduceInputCommand(
      createEmptySettledInput(),
      settleField(beregningsdatoField.bind(), '01-01-2024'),
      catalog
    ).input;
    const withAargang = reduceInputCommand(seeded, settleField(aargangField.bind(), '2025'), catalog).input;

    // clearField
    const cleared = reduceInputCommand(withAargang, clearField(aargangField.bind()), catalog).input;
    expect(cleared.sections.renteberegning?.kommentarer).toBeUndefined();

    // insertRow (strukturel) — reglen skal fortsat holde konsekvensen ved lige.
    const inserted = reduceInputCommand(
      withAargang,
      insertRow(rentekravRowsRef(), makeRow('row-1')),
      catalog
    ).input;
    expect(inserted.sections.renteberegning?.kommentarer).toBe('afledt:2025');

    // setImmediateField på et choice-felt i en række.
    const immediate = reduceInputCommand(
      inserted,
      setImmediateField(enhedField.bind('row-1'), 'maaneder'),
      catalog
    ).input;
    expect(immediate.sections.renteberegning?.kommentarer).toBe('afledt:2025');

    // transaktion
    const transacted = reduceInputCommand(
      seeded,
      inputTransaction([inputTransactionStep(settleField(aargangField.bind(), '2030'))]),
      catalog
    ).input;
    expect(transacted.sections.renteberegning?.kommentarer).toBe('afledt:2030');
  });

  it('reparerer en tilstand, hvor det afledte felt er ude af trit — også uden at årsagen ændres', () => {
    // En `.eo`-fil fra før reglen, eller en manipuleret fil, kan bære en forældet afledt værdi. Fordi reglen
    // kører på HVER command, konvergerer tilstanden ved den første ændring frem for at bevare den forkerte
    // værdi, indtil netop det styrende felt røres.
    const { catalog } = withCatalog([kommentarFollowsAargang]);
    const seeded = reduceInputCommand(
      createEmptySettledInput(),
      settleField(beregningsdatoField.bind(), '01-01-2024'),
      catalog
    ).input;
    const stale = reduceInputCommand(seeded, settleField(aargangField.bind(), '2025'), catalog).input;

    // Ændr et felt, reglen IKKE læser.
    const touched = reduceInputCommand(stale, settleField(beregningsdatoField.bind(), '02-01-2024'), catalog).input;
    expect(touched.sections.renteberegning?.kommentarer).toBe('afledt:2025');
  });

  it('afviser en regel, der skriver uden for sin erklærede sektion', () => {
    const crossesBoundary: DerivedInputWrite = Object.freeze({
      id: 'test.crossesBoundary',
      writesSection: 'renteberegning',
      materialize: (sections) => ({ ...sections, satser: { aargang: 1999 } }),
    });
    const catalog = createTestCatalog([crossesBoundary]);

    expect(() => reduceInputCommand(
      createEmptySettledInput(),
      settleField(aargangField.bind(), '2025'),
      catalog
    )).toThrow(/ændrede sektionen satser uden for sin skriveflade/);
  });

  it('afviser en ikke-idempotent regel frem for at lade den svinge', () => {
    let counter = 0;
    const notIdempotent: DerivedInputWrite = Object.freeze({
      id: 'test.notIdempotent',
      writesSection: 'renteberegning',
      materialize: (sections) => {
        const rente = sections.renteberegning;
        if (rente === null) return sections;
        counter += 1;
        return { ...sections, renteberegning: { ...rente, kommentarer: `tick-${counter}` } };
      },
    });
    const catalog = createTestCatalog([notIdempotent]);

    expect(() => reduceInputCommand(
      createEmptySettledInput(),
      settleField(beregningsdatoField.bind(), '01-01-2024'),
      catalog
    )).toThrow(/test\.notIdempotent er ikke idempotent/);
  });

  it('afviser et dubleret regel-id ved katalogkonstruktion', () => {
    expect(() => createTestCatalog([kommentarFollowsAargang, kommentarFollowsAargang]))
      .toThrow(/dubleret afledt skrivning/);
  });

  it('lader tilstanden være uændret, når intet katalog erklærer afledte skrivninger', () => {
    const catalog = createTestCatalog();
    const seeded = reduceInputCommand(
      createEmptySettledInput(),
      settleField(kommentarerField.bind(), 'brugerens egen tekst'),
      catalog
    ).input;
    const after = reduceInputCommand(seeded, settleField(aargangField.bind(), '2025'), catalog).input;

    // Uden en regel er kommentarfeltet almindeligt brugerinput og røres ikke.
    expect(after.sections.renteberegning?.kommentarer).toBe('brugerens egen tekst');
    expect(catalog.derivedWrites).toEqual([]);
  });
});
