import {
  buildBeregnetDifferencekravLabel,
  resolveMerErstatningPensionsalderBilagDisabledReason,
  resolveProformaKapitaliseringBilagDisabledReason,
} from '../../../domain/erhvervsevnetab/eetDifferencekravPresentation';

describe('buildBeregnetDifferencekravLabel', () => {
  it('viser plain label uden parentes når der ikke er noget forlig', () => {
    expect(buildBeregnetDifferencekravLabel(null, '1.095.121 kr.')).toBe('Beregnet differencekrav');
  });

  it('viser forligs-label og det fulde krav i parentes ved brøk-forlig', () => {
    expect(buildBeregnetDifferencekravLabel('2/3', '1.095.121 kr.')).toBe(
      'Beregnet differencekrav (2/3 af 1.095.121 kr.)'
    );
  });

  it('viser procent-forlig i parentes', () => {
    expect(buildBeregnetDifferencekravLabel('50 %', '1.095.121 kr.')).toBe(
      'Beregnet differencekrav (50 % af 1.095.121 kr.)'
    );
  });
});

describe('resolveMerErstatningPensionsalderBilagDisabledReason', () => {
  it('giver ingen årsag når mer-erstatningen både er indregnet og beregnet', () => {
    expect(resolveMerErstatningPensionsalderBilagDisabledReason(true, true)).toBeNull();
  });

  it('forklarer manglende forhøjelse i perioden når mer-erstatningen er indregnet men ikke findes', () => {
    const reason = resolveMerErstatningPensionsalderBilagDisabledReason(true, false);
    expect(reason).toContain('ikke forhøjet i perioden');
  });

  it('forklarer brugerens eget fravalg når togglen er slået fra', () => {
    const reason = resolveMerErstatningPensionsalderBilagDisabledReason(false, false);
    expect(reason).toContain('fravalgt');
  });

  // Rangordenen er en bevidst regel (page-component-contract.md §10.5, punkt 4): et fravalg må ikke
  // forklares med et regnestykke, programmet ikke har udført. Uden den kunne beregningsårsagen vinde,
  // så brugeren fik at vide, at pensionsalderen ikke er forhøjet — uden at det er efterprøvet.
  it('lader fravalget gå forud for beregningsårsagen, også hvis begge forudsætninger mangler', () => {
    const reason = resolveMerErstatningPensionsalderBilagDisabledReason(false, false);
    expect(reason).toContain('fravalgt');
    expect(reason).not.toContain('ikke forhøjet i perioden');
  });
});

describe('resolveProformaKapitaliseringBilagDisabledReason', () => {
  it('giver ingen årsag når proformakapitaliseringen findes', () => {
    expect(resolveProformaKapitaliseringBilagDisabledReason(true, false)).toBeNull();
  });

  it('forklarer at resten i stedet er opgjort som løbende ydelser', () => {
    const reason = resolveProformaKapitaliseringBilagDisabledReason(false, true);
    expect(reason).toContain('løbende ydelser');
  });

  it('forklarer at der intet resterende erhvervsevnetab er at proformakapitalisere', () => {
    const reason = resolveProformaKapitaliseringBilagDisabledReason(false, false);
    expect(reason).toContain('intet rest-EET');
  });
});
