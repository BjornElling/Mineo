import { computeMerErstatningPensionsalder } from '../../../domain/erhvervsevnetab/eetMerErstatningPensionsalderCalculation';
import type { EetIssue } from '../../../domain/erhvervsevnetab/eetTypes';
import { toISODateString } from '../../../types/branded';
import { fromKroner } from '../../../domain/money/money';

// Autoritativt eksempel (jf. docs/domain/eet/mer-erstatning-pensionsalder.md):
//   Skade mellem 1.1.2004 og 30.6.2007 → erstatningsniveau 80 %, intet AM-bidrag,
//   faktor ud fra alder på skadestidspunktet (ikke månedsafhængig).
//   Forhøjelse 67 → 68 pr. 29.12.2015 (Bkg. 198/2015 → Bkg. 1700/2015).
//   Alder 29.12.2015: 41 år, 10 måneder (født 28-02-1974).
//   Grundløn 251.580 kr., kapitaliseret 25 %.
//   Løbende ydelse i 2016 (satsår = 1 måned efter virkningsdato): 69.234,82 kr.
//   Kapitalværdi til 67 år (Tabel G, faktor 9,388): 649.976,49 kr.
//   Kapitalværdi til 68 år (Tabel H, faktor 9,452): 654.407,52 kr.
//   Mer-erstatning: 4.431 kr.

const iso = (v: string) => toISODateString(v);

describe('computeMerErstatningPensionsalder – autoritativt eksempel (67→68, 4.431 kr.)', () => {
  const run = () => {
    const issues: EetIssue[] = [];
    const computation = computeMerErstatningPensionsalder(
      {
        kapitaliseringer: [
          {
            rowId: 'a1',
            afgoerelsesdato: iso('2014-06-01'),
            // Kapitaliseret i et tidligere kalenderår end forhøjelsen (2014 < 2015).
            kapitaliseringsdato: iso('2014-06-01'),
            kapitaliseringspct: 25,
            grundloenOre: fromKroner(251580),
            erstatningsniveauPct: 80,
            amBidragPct: 0,
          },
        ],
        beregningsdato: iso('2016-06-01'),
        skadedato: iso('2004-01-01'),
        fodselsdato: iso('1974-02-28'),
        before2024Skade: true,
        koen: undefined,
      },
      issues
    );
    return { computation, issues };
  };

  it('beregner mer-erstatningen til 4.431 kr.', () => {
    const { computation, issues } = run();
    expect(issues).toEqual([]);
    expect(computation).not.toBeNull();
    expect(computation?.events).toHaveLength(1);
    expect(computation?.samletMerErstatningOre).toBe(443100);
  });

  it('rammer den løbende ydelse (årsydelse) på 69.234,82 kr. i satsår 2016', () => {
    const { computation } = run();
    const event = computation!.events[0]!;
    expect(event.satsAar).toBe(2016);
    expect(event.aarsydelseOre).toBe(6923482);
    expect(event.grundydelseOre).toBe(5031600);
  });

  it('beregner kapitalværdierne med faktor 9,388 (67 år) og 9,452 (68 år)', () => {
    const { computation } = run();
    const event = computation!.events[0]!;
    expect(event.gammel.kapitaliseringsfaktor).toBe(9.388);
    expect(event.gammel.kapitalvaerdiOre).toBe(64997649);
    expect(event.gammel.folkepensionsalderLabel).toBe('67 år');
    expect(event.ny.kapitaliseringsfaktor).toBe(9.452);
    expect(event.ny.kapitalvaerdiOre).toBe(65440752);
    expect(event.ny.folkepensionsalderLabel).toBe('68 år');
  });

  it('slår de korrekte bekendtgørelser op (Bkg. 198/2015 → Bkg. 1700/2015)', () => {
    const { computation } = run();
    const event = computation!.events[0]!;
    expect(event.gammel.kapitaliseringsbekendtgoerelseLabel).toContain('198/2015');
    expect(event.gammel.kapitaliseringsbekendtgoerelseLabel).toContain('tabel G');
    expect(event.ny.kapitaliseringsbekendtgoerelseLabel).toContain('1700/2015');
    expect(event.ny.kapitaliseringsbekendtgoerelseLabel).toContain('tabel H');
  });
});

describe('computeMerErstatningPensionsalder – betingelser', () => {
  const base = {
    beregningsdato: iso('2026-06-01'),
    skadedato: iso('2004-01-01'),
    fodselsdato: iso('1974-02-28'),
    before2024Skade: true,
    koen: undefined,
  };
  const kap = (kapitaliseringsdato: string) => ({
    rowId: 'a1',
    afgoerelsesdato: iso(kapitaliseringsdato),
    kapitaliseringsdato: iso(kapitaliseringsdato),
    kapitaliseringspct: 25,
    grundloenOre: fromKroner(251580),
    erstatningsniveauPct: 80,
    amBidragPct: 0,
  });

  it('medtager en forhøjelse senere på året end kapitaliseringen (datokriterium, ikke kalenderår)', () => {
    const issues: EetIssue[] = [];
    // Kapitaliseret 01-06-2015 → 67→68-forhøjelsen 29-12-2015 ligger efter kapitaliseringsdatoen
    // (samme kalenderår, men senere dato) → mer-erstatning skal medregnes.
    const computation = computeMerErstatningPensionsalder(
      { ...base, kapitaliseringer: [kap(toISODateString('2015-06-01'))] },
      issues
    );
    const har2015 = computation?.events.some((e) => e.forhoejelsesdato === toISODateString('2015-12-29'));
    expect(har2015).toBeTruthy();
  });

  it('medtager ikke en forhøjelse på eller før kapitaliseringsdatoen', () => {
    const issues: EetIssue[] = [];
    // Kapitaliseret 30-12-2015 → 67→68-forhøjelsen 29-12-2015 ligger før kapitaliseringsdatoen
    // → ingen mer-erstatning for den forhøjelse.
    const computation = computeMerErstatningPensionsalder(
      { ...base, kapitaliseringer: [kap(toISODateString('2015-12-30'))] },
      issues
    );
    const har2015 = computation?.events.some((e) => e.forhoejelsesdato === toISODateString('2015-12-29'));
    expect(har2015).toBeFalsy();
  });

  it('medtager ikke en forhøjelse efter beregningsdatoen', () => {
    const issues: EetIssue[] = [];
    const computation = computeMerErstatningPensionsalder(
      // Beregningsdato før 2020-forhøjelsen → kun 67→68 må kunne indgå.
      { ...base, beregningsdato: iso('2017-01-01'), kapitaliseringer: [kap(toISODateString('2014-06-01'))] },
      issues
    );
    const har2020 = computation?.events.some((e) => e.forhoejelsesdato === toISODateString('2020-12-31'));
    expect(har2020).toBeFalsy();
  });

  it('returnerer null når ingen forhøjelse kvalificerer', () => {
    const issues: EetIssue[] = [];
    const computation = computeMerErstatningPensionsalder(
      // Kapitaliseret 01-06-2024, beregningsdato 01-06-2025 → 31-12-2025-forhøjelsen ligger efter
      // beregningsdatoen, og ingen tidligere forhøjelse ligger efter kapitaliseringsdatoen.
      { ...base, beregningsdato: iso('2025-06-01'), kapitaliseringer: [kap(toISODateString('2024-06-01'))] },
      issues
    );
    expect(computation).toBeNull();
  });
});

describe('computeMerErstatningPensionsalder – autoritativt eksempel (67→68, skade fra 2011, 22.641 kr.)', () => {
  // Skade 01-01-2011 → erstatningsniveau 83 % og AM-bidrag 8 % (giver 0,92-faktoren i kæden, som
  // fane 3 anvender for skade fra 2011), bekendtgørelsesspor 199/2015 → 1663/2015.
  // Grundløn 216.019 kr. er den allerede reguleret grundløn fra fane 3 (279.000 × 367.000/474.000).
  // Forhøjelse 67 → 68 pr. 29-12-2015. Kapitaliseret 01-06-2014 (tidligere år end forhøjelsen).
  // Alder 29-12-2015: 41 år, 10 måneder (født 28-02-1974).
  // Løbende ydelse i satsår 2016: 216.019 × 83 % × 25 % × 0,92 × 137,60 % = 56.743,53 kr.
  // Kapitalværdi til 67 år (Bkg. 199/2015, faktor 13,291): 754.178,26 kr.
  // Kapitalværdi til 68 år (Bkg. 1663/2015, faktor 13,69): 776.818,93 kr.
  // Mer-erstatning: 22.641 kr.
  const run = () => {
    const issues: EetIssue[] = [];
    const computation = computeMerErstatningPensionsalder(
      {
        kapitaliseringer: [
          {
            rowId: 'a1',
            afgoerelsesdato: iso('2014-06-01'),
            kapitaliseringsdato: iso('2014-06-01'),
            kapitaliseringspct: 25,
            grundloenOre: fromKroner(216019),
            erstatningsniveauPct: 83,
            amBidragPct: 8,
          },
        ],
        beregningsdato: iso('2016-06-01'),
        skadedato: iso('2011-01-01'),
        fodselsdato: iso('1974-02-28'),
        before2024Skade: true,
        koen: undefined,
      },
      issues
    );
    return { computation, issues };
  };

  it('beregner mer-erstatningen til 22.641 kr.', () => {
    const { computation, issues } = run();
    expect(issues).toEqual([]);
    expect(computation).not.toBeNull();
    expect(computation?.events).toHaveLength(1);
    expect(computation?.samletMerErstatningOre).toBe(2264100);
  });

  it('rammer den løbende ydelse (årsydelse) på 56.743,53 kr. i satsår 2016', () => {
    const { computation } = run();
    const event = computation!.events[0]!;
    expect(event.satsAar).toBe(2016);
    expect(event.aarsydelseOre).toBe(5674353);
  });

  it('beregner kapitalværdierne med faktor 13,291 (67 år) og 13,69 (68 år)', () => {
    const { computation } = run();
    const event = computation!.events[0]!;
    expect(event.gammel.kapitaliseringsfaktor).toBe(13.291);
    expect(event.gammel.kapitalvaerdiOre).toBe(75417826);
    expect(event.gammel.folkepensionsalderLabel).toBe('67 år');
    expect(event.ny.kapitaliseringsfaktor).toBe(13.69);
    expect(event.ny.kapitalvaerdiOre).toBe(77681893);
    expect(event.ny.folkepensionsalderLabel).toBe('68 år');
  });

  it('slår de korrekte bekendtgørelser op (Bkg. 199/2015 → Bkg. 1663/2015)', () => {
    const { computation } = run();
    const event = computation!.events[0]!;
    expect(event.gammel.kapitaliseringsbekendtgoerelseLabel).toContain('199/2015');
    expect(event.ny.kapitaliseringsbekendtgoerelseLabel).toContain('1663/2015');
  });
});
