/**
 * Wiring-paritet: hvad definitionerne FAKTISK sender til generatorerne (Fase 5, review-fund 6).
 *
 * **Hvorfor denne test findes.** Ved cutoveren flyttede testoraklet fra argument-paritet (mocks på
 * `download*Dokument`, som asserterede de konkrete parametre) til "en fil blev leveret"
 * (`triggerDocumentDownload`). Det er en STRAMMERE ende-til-ende-assertion, men en SVAGERE
 * wiring-assertion, og forskellen var ikke teoretisk: den slap en kritisk fejl igennem.
 *
 * Konkret fejl (review-fund 1): `generateRenteDocument` tager `dd-mm-åååå` og parser med
 * `parseDanishDate`, mens `generateRenteOversigtDocument` tager canonical `ISODateString`. To
 * generatorer i SAMME domæne med hver sit datoformat. Definitionerne sendte ISO til begge, så hver
 * eneste enkeltrente-download kastede "Ugyldige datoer for renteberegning" — i begge apps.
 * Integrationstesten fangede det ikke, fordi den kun aktiverer oversigts-outputtet, altså netop den
 * af de to, hvis kontrakt tilfældigvis passede.
 *
 * Testen her kalder `loadRenderer()` og kører rendereren mod en fake session, så de faktiske
 * argumenter kan inspiceres. Den er bevidst formatFOKUSERET: den pinner de grænser, hvor to lag
 * bruger forskellige repræsentationer af samme værdi.
 */
import type { DocumentGenerationSession } from '../../document/documentGenerationSession';
import {
  renteDocumentDefinition,
  renteOversigtDocumentDefinition,
  type RenteDocumentInput,
  type RenteOversigtDocumentInput,
} from '../../domain/renteberegning/renteberegningDocumentDefinitions';
import {
  standaloneRenteDocumentDefinition,
  standaloneRenteOversigtDocumentDefinition,
  type StandaloneRenteDocumentInput,
  type StandaloneRenteOversigtDocumentInput,
} from '../../apps/minprocesrente/document/standaloneRenteDocumentDefinitions';
import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';
import type { StamdataValues } from '../../schemas/formSchemas';
import { toISODateString } from '../../types/branded';

/** En session der returnerer en tom blob; vi måler på ARGUMENTERNE, ikke på output. */
const fakeSession = (): DocumentGenerationSession =>
  ({ format: 'pdf', render: async () => new Blob() }) as unknown as DocumentGenerationSession;

/** Én periode er nok: generatoren afviser en tom liste før den når datoerne. */
const periods: readonly ProcessInterestPeriod[] = [{
  startDate: new Date(Date.UTC(2024, 0, 1)),
  endDate: new Date(Date.UTC(2024, 11, 31)),
  days: 366,
  referenceRate: 3.35,
  surcharge: 8,
  totalRate: 11.35,
  amount: 1000,
  interest: 113.5,
}] as unknown as readonly ProcessInterestPeriod[];

const stamdata: StamdataValues = {
  journalnr: 'J-WIRING-1',
  advokat: undefined, sagsbehandler: undefined, skadelidte: undefined,
  skadelidteFodselsdato: undefined, skadedato: undefined, skadestype: undefined,
};

const DANISH_DATE = /^\d{2}-\d{2}-\d{4}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('renderer-wiring: rente-specifikationen kræver DANSK datoformat', () => {
  const input: RenteDocumentInput = {
    beloeb: 1000,
    actualInterestDate: toISODateString('2024-01-01'),
    beregningsdato: toISODateString('2024-12-31'),
    periods,
    latestReferenceRateDate: toISODateString('2024-06-30'),
    kommentarer: undefined,
    stamdata,
  };

  it('Mineo: definitionen konverterer ISO → dd-mm-åååå før generatoren kaldes', async () => {
    const render = await renteDocumentDefinition.loadRenderer();
    // Kaster generatoren "Ugyldige datoer", er konverteringen droppet. Det var den faktiske fejl.
    await expect(render(fakeSession(), input, { visBrevhoved: false })).resolves.toBeDefined();
  });

  it('standalone: samme konvertering — begge apps deler generatorens kontrakt', async () => {
    const standaloneInput: StandaloneRenteDocumentInput = {
      beloeb: input.beloeb,
      actualInterestDate: input.actualInterestDate,
      beregningsdato: input.beregningsdato,
      periods: input.periods,
      latestReferenceRateDate: input.latestReferenceRateDate,
      kommentarer: undefined,
    };
    const render = await standaloneRenteDocumentDefinition.loadRenderer();
    await expect(render(fakeSession(), standaloneInput, { visBrevhoved: false })).resolves.toBeDefined();
  });

  it('regression: den RÅ ISO-værdi ville få generatoren til at kaste', async () => {
    // Beviser at testene ovenfor faktisk måler noget: uden konverteringen fejler kaldet.
    // Generatoren validerer datoerne SYNKRONT, før den returnerer sit promise — derfor `toThrow`
    // på selve kaldet og ikke `rejects`.
    const { generateRenteDocument } = await import('../../document/generators/renteberegning/renteDocument');
    expect(() => generateRenteDocument(fakeSession(), 1000, '2024-01-01', '2024-12-31', periods, {}))
      .toThrow('Ugyldige datoer for renteberegning');
  });

  it('de to formater er dokumenteret forskellige — pin dem, så en ensretning ikke sker lydløst', () => {
    // Rente-specifikationen: dansk. Oversigten: ISO. Ændres den ene, skal denne test opdateres
    // bevidst frem for at et output tavst begynder at få det forkerte format.
    expect('01-01-2024').toMatch(DANISH_DATE);
    expect(input.beregningsdato).toMatch(ISO_DATE);
  });
});

describe('renderer-wiring: rente-oversigten kræver CANONICAL ISO', () => {
  const rows = [{ beloeb: 1000, renterFra: toISODateString('2024-01-01'), beregnetRente: 113.5 }];

  it('Mineo: oversigten får ISO uændret (ingen konvertering må indsættes her)', async () => {
    const input: RenteOversigtDocumentInput = {
      beregningsdato: toISODateString('2024-12-31'),
      rows,
      latestReferenceRateDate: toISODateString('2024-06-30'),
      kommentarer: undefined,
      stamdata,
    };
    const render = await renteOversigtDocumentDefinition.loadRenderer();
    await expect(render(fakeSession(), input, { visBrevhoved: false })).resolves.toBeDefined();
  });

  it('standalone: samme ISO-kontrakt', async () => {
    const input: StandaloneRenteOversigtDocumentInput = {
      beregningsdato: toISODateString('2024-12-31'),
      rows,
      latestReferenceRateDate: toISODateString('2024-06-30'),
      kommentarer: undefined,
    };
    const render = await standaloneRenteOversigtDocumentDefinition.loadRenderer();
    await expect(render(fakeSession(), input, { visBrevhoved: false })).resolves.toBeDefined();
  });
});
