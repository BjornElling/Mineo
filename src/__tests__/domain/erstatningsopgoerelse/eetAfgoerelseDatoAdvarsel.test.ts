import { resolveEetAfgoerelseDatoAdvarsler } from '../../../domain/erstatningsopgoerelse/validation/eetAfgoerelseDatoAdvarsel';
import {
  resolveEetAfgoerelseDatoer,
  type EetAfgoerelseDatoer,
  type EetImportSource,
} from '../../../domain/erhvervsevnetab/eetImportPort';
import { resolveMidlertidigtEetIssueNavigation } from '../../../domain/erhvervsevnetab/eetIssueNavigation';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import {
  eoEndeligEETVirkningsdatoField,
  eoMidlertidigEETAfgoerelseDatoField,
  eoMidlertidigEETVirkningsdatoField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { toISODateString } from '../../../types/branded';

const iso = toISODateString;

type Values = Parameters<typeof resolveEetAfgoerelseDatoAdvarsler>[0];

const values = (overrides: Partial<Values> = {}): Values => ({
  midlertidigtEetFraEetSiden: 'Ja',
  midlertidigtEETAfgorelse: 'Ja',
  midlertidigEETAfgoerelseDato: iso('2025-03-10'),
  midlertidigEETVirkningsdato: iso('2025-01-01'),
  endeligtEETAfgorelse: 'Nej',
  endeligEETAfgoerelseDato: undefined,
  endeligEETVirkningsdato: undefined,
  ...overrides,
});

const midlertidig: EetAfgoerelseDatoer = {
  afgoerelseType: 'Midlertidig',
  afgoerelsesdato: iso('2025-03-10'),
  virkningsdato: iso('2025-01-01'),
};

const endelig: EetAfgoerelseDatoer = {
  afgoerelseType: 'Endelig',
  afgoerelsesdato: iso('2026-02-01'),
  virkningsdato: iso('2026-02-01'),
};

describe('resolveEetAfgoerelseDatoAdvarsler', () => {
  it('er tavs, når datoerne på EO oplysninger genfindes på samme afgørelse på Erhvervsevnetab-siden', () => {
    expect(resolveEetAfgoerelseDatoAdvarsler(values(), [midlertidig])).toEqual([]);
  });

  it('advarer, når virkningsdatoen ikke genfindes – og peger på feltet på EO oplysninger', () => {
    const issues = resolveEetAfgoerelseDatoAdvarsler(values({ midlertidigEETVirkningsdato: iso('2025-02-01') }), [midlertidig]);

    expect(issues).toEqual([{
      id: 'eo-midlertidig-eet-dato-uden-eet-afgoerelse',
      severity: 'warning',
      message: 'Virkningsdatoen for den midlertidige EET-afgørelse på EO oplysninger (01-02-2025) svarer ikke til nogen midlertidig afgørelse på Erhvervsevnetab-siden',
      focusTarget: { kind: 'fieldAddress', address: eoMidlertidigEETVirkningsdatoField.bind().address },
    }]);
    expect(resolveMidlertidigtEetIssueNavigation(issues[0]!)).toEqual(expect.objectContaining({
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionId: 'aes',
    }));
  });

  it('kræver, at afgørelses- og virkningsdato findes på SAMME afgørelse', () => {
    const anden: EetAfgoerelseDatoer = { ...midlertidig, afgoerelsesdato: iso('2025-06-01'), virkningsdato: iso('2025-06-01') };
    const issues = resolveEetAfgoerelseDatoAdvarsler(
      values({ midlertidigEETAfgoerelseDato: iso('2025-06-01') }),
      [midlertidig, anden]
    );

    expect(issues).toEqual([expect.objectContaining({
      message: 'Afgørelsesdatoen for den midlertidige EET-afgørelse på EO oplysninger (01-06-2025) svarer ikke til nogen midlertidig afgørelse på Erhvervsevnetab-siden',
      focusTarget: { kind: 'fieldAddress', address: eoMidlertidigEETAfgoerelseDatoField.bind().address },
    })]);
  });

  it('lader en delvist endelig afgørelse tælle som midlertidig – den hentes som løbende ydelse', () => {
    expect(resolveEetAfgoerelseDatoAdvarsler(values(), [{ ...midlertidig, afgoerelseType: 'Delvist endelig' }])).toEqual([]);
  });

  it('advarer om den endelige afgørelse, når Erhvervsevnetab-siden har en endelig afgørelse med en anden dato', () => {
    const issues = resolveEetAfgoerelseDatoAdvarsler(
      values({ endeligtEETAfgorelse: 'Ja', endeligEETVirkningsdato: iso('2026-03-01') }),
      [midlertidig, endelig]
    );

    expect(issues).toEqual([expect.objectContaining({
      id: 'eo-endelig-eet-dato-uden-eet-afgoerelse',
      message: 'Virkningsdatoen for den endelige EET-afgørelse på EO oplysninger (01-03-2026) svarer ikke til nogen endelig afgørelse på Erhvervsevnetab-siden',
      focusTarget: { kind: 'fieldAddress', address: eoEndeligEETVirkningsdatoField.bind().address },
    })]);
  });

  it.each([
    ['hentningen er slået fra', values({ midlertidigtEetFraEetSiden: 'Nej', midlertidigEETVirkningsdato: iso('2025-02-01') }), [midlertidig]],
    ['EO oplysninger ikke angiver en afgørelse', values({ midlertidigtEETAfgorelse: 'Nej', midlertidigEETVirkningsdato: iso('2025-02-01') }), [midlertidig]],
    // Uden en midlertidig afgørelse på Erhvervsevnetab-siden siger «ingen ydelser»-advarslen det allerede.
    ['Erhvervsevnetab-siden ingen afgørelse af samme slags har', values({ endeligtEETAfgorelse: 'Ja', endeligEETVirkningsdato: iso('2026-03-01') }), [midlertidig]],
  ] as const)('er tavs, når %s', (_label, input, afgoerelser) => {
    expect(resolveEetAfgoerelseDatoAdvarsler(input, afgoerelser)).toEqual([]);
  });
});

describe('resolveEetAfgoerelseDatoer', () => {
  it('udleder virkningsdatoen som beregningen og springer tomme og ufuldstændige rækker over', () => {
    const source: EetImportSource = {
      revision: 'r',
      skadedato: iso('2024-01-01'),
      eetValues: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAfgoerelser: [
          {
            id: 'a', afgoerelsesDato: iso('2025-03-10'), virkningsDato: undefined, eetPct: 20, kapDato: undefined,
            kapPct: undefined, afgoerelseType: 'Midlertidig', tidlKapDato: undefined, fsTilbageholdtEet: 'Nej',
          },
          {
            id: 'b', afgoerelsesDato: undefined, virkningsDato: iso('2025-01-01'), eetPct: 20, kapDato: undefined,
            kapPct: undefined, afgoerelseType: 'Endelig', tidlKapDato: undefined, fsTilbageholdtEet: 'Nej',
          },
        ],
      },
    };

    expect(resolveEetAfgoerelseDatoer(source)).toEqual([
      { afgoerelseType: 'Midlertidig', afgoerelsesdato: iso('2025-03-10'), virkningsdato: iso('2025-03-10') },
    ]);
    expect(resolveEetAfgoerelseDatoer(null)).toEqual([]);
  });
});
