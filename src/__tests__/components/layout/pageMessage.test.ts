import {
  NO_MESSAGE,
  firstPageMessage,
  hasPageMessage,
  pageMessage,
} from '../../../components/layout/pageMessage';

/**
 * `PageMessage` – typen der gør en besked-boks' TILSTEDEVÆRELSE eksplicit.
 *
 * Fejlklassen den lukker: Årsløns "Kritisk Fejl"-boks stod permanent og TOM øverst på siden, fordi
 * viewmodellen skrev `?? []` på et `string | null`-felt. Et tomt array er truthy, så boksens håndrullede
 * værn (`if (!beregningsFejl)`) slap igennem, og `{[]}` renderede lovligt til ingenting.
 *
 * Testene måler derfor netop grænsetilfældene, hvor truthiness og "har indhold" IKKE er samme spørgsmål.
 */
describe('pageMessage', () => {
  it('normaliserer null og undefined til NO_MESSAGE', () => {
    expect(pageMessage(null)).toBe(NO_MESSAGE);
    expect(pageMessage(undefined)).toBe(NO_MESSAGE);
  });

  it('normaliserer tom og whitespace-only tekst til NO_MESSAGE', () => {
    // Kernen: en boks må ikke kunne vises med en besked, brugeren ikke kan læse.
    expect(pageMessage('')).toBe(NO_MESSAGE);
    expect(pageMessage('   ')).toBe(NO_MESSAGE);
    expect(pageMessage('\n\t ')).toBe(NO_MESSAGE);
  });

  it('bevarer en rigtig besked og trimmer den', () => {
    const message = pageMessage('  Fejl ved beregning af SH-dage  ');
    expect(hasPageMessage(message)).toBe(true);
    expect(message).toEqual({ kind: 'message', text: 'Fejl ved beregning af SH-dage' });
  });

  it('hasPageMessage er falsk for NO_MESSAGE og sand for en besked', () => {
    expect(hasPageMessage(NO_MESSAGE)).toBe(false);
    expect(hasPageMessage(pageMessage('noget gik galt'))).toBe(true);
  });

  it('NO_MESSAGE er TRUTHY – derfor er `hasPageMessage` den eneste gyldige kontrol', () => {
    // Denne test dokumenterer, HVORFOR typen findes. `NO_MESSAGE` er et objekt og dermed truthy, præcis som
    // det tomme array der forårsagede den tomme boks. Havde værnet været `if (!message)`, ville et fravær
    // igen slippe igennem. Fejler denne test, er `NO_MESSAGE` blevet falsy, og så er `hasPageMessage`-kravet
    // i `PageMessageBox` ikke længere load-bearing – værnet skal da gentænkes, ikke bare rettes.
    expect(Boolean(NO_MESSAGE)).toBe(true);
    expect(hasPageMessage(NO_MESSAGE)).toBe(false);
  });
});

describe('firstPageMessage', () => {
  it('vælger den første tilstedeværende besked', () => {
    const result = firstPageMessage(NO_MESSAGE, pageMessage('anden'), pageMessage('tredje'));
    expect(result).toEqual({ kind: 'message', text: 'anden' });
  });

  it('springer tom tekst over, ikke bare null', () => {
    // `??`-mønsteret, typen erstatter, havde netop dette hul: `'' ?? b` giver `''`, ikke `b`.
    const result = firstPageMessage(pageMessage(''), pageMessage('  '), pageMessage('den rigtige'));
    expect(result).toEqual({ kind: 'message', text: 'den rigtige' });
  });

  it('giver NO_MESSAGE når ingen kilde har indhold', () => {
    expect(firstPageMessage(NO_MESSAGE, pageMessage(null), pageMessage(''))).toBe(NO_MESSAGE);
    expect(firstPageMessage()).toBe(NO_MESSAGE);
  });
});
