import { amountValueSchema } from '../../schemas/amountExpressionSchema';
import { parseAmountInput } from '../../utils/expressionAmount';

// Settle må ALDRIG kaste en uncaught ZodError. Et udtryksresultat, som beløbsschemaet ikke kan
// gemme præcist, skal derfor afvises af PARSEREN – så bliver det afsluttet rejected råtekst med rød
// feltfejl (§1.6) i stedet for en teknisk fejladvarsel.
//
// Fejlen kunne kun ramme et HELTALS-beløbsfelt: parseren målte repræsentationsgrænsen mod feltets egen
// `precision`, mens `amountValueSchema` altid validerer ved 2 decimaler. Ved precision 0 er den sikre
// grænse 2^53, ved precision 2 er den 2^46 – et gab på tre størrelsesordener, hvor parseren sagde ja og
// schemaet kastede.

const parseIntegerAmount = (raw: string) => parseAmountInput(raw, {
  precision: 0,
  allowNegative: true,
  allowDecimals: false,
  maxIntegerDigits: 7,
  maxRawLength: 512,
});

describe('beløbsparserens canonical repræsentationsgrænse', () => {
  it('afviser et udtryksresultat over den canonical grænse i et heltalsfelt', () => {
    // 9.999.999 × 9.999.999 = 99.999.980.000.001, altså over 2^46 (~7,0e13).
    const parsed = parseIntegerAmount('9999999*9999999');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.message).toContain('for stort');
  });

  it('alt, parseren ACCEPTERER, kan også parses af beløbsschemaet', () => {
    // Den egentlige invariant: de to grænser må ikke kunne komme fra hinanden igen. Var værnet målt mod
    // feltets precision, ville den første værdi her kaste inde i schemaet.
    for (const raw of ['9999999*9999999', '9999999*2', '9999999', '5000000+4999999', '1234567,89']) {
      const parsed = parseAmountInput(raw, {
        precision: 0, allowNegative: true, allowDecimals: false, maxIntegerDigits: 7, maxRawLength: 512,
      });
      if (!parsed.ok || parsed.value === undefined) continue;
      expect(() => amountValueSchema.parse(parsed.value)).not.toThrow();
    }
  });

  it('et resultat over FELTETS grænse men inden for canonical repræsentation accepteres fortsat', () => {
    // `9999999*2` = 19.999.998 er over `±9.999.999,99`, men kan gemmes præcist. Den skal committes
    // canonical og markeres rødt af `amountResultBoundsValidator` – ikke afvises som format her.
    const parsed = parseIntegerAmount('9999999*2');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value?.value).toBe(19_999_998);
  });

  it('almindelige beløb er upåvirkede', () => {
    const parsed = parseIntegerAmount('1000');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value?.value).toBe(1000);
  });
});
