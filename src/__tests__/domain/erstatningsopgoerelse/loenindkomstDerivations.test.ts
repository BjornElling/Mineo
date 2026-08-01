import {
  deriveLoenindkomstVm,
  type LoenindkomstDerivationInput,
} from '../../../domain/erstatningsopgoerelse/viewModel/loenindkomstDerivations';
import {
  createErstatningsopgoerelseInitialValues,
  createDefaultLoenindkomstAnsaettelsesforhold,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

// Isolations-tests for det rene Loenindkomst-afledningslag (uden React-render) — jf. arkitektur-kandidat A1.
// Modstykket til loenindkomstSatsAssessment.test.ts.

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

const baseValues = (): ErstatningsopgoerelseValues => createErstatningsopgoerelseInitialValues();

const buildInput = (
  ansaettelsesforhold: readonly Ansaettelsesforhold[],
  overrides?: Partial<ErstatningsopgoerelseValues>
): LoenindkomstDerivationInput => {
  const eoValues: ErstatningsopgoerelseValues = {
    ...baseValues(),
    ...overrides,
    loenindkomstAnsaettelsesforhold: [...ansaettelsesforhold],
  };
  return {
    loenindkomstAnsaettelsesforhold: eoValues.loenindkomstAnsaettelsesforhold,
    beregnesUdFra: eoValues.beregnesUdFra,
    tafBeregningsperiodeFra: eoValues.tafBeregningsperiodeFra,
    tafBeregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
    ferieperioder: eoValues.ferieperioder,
    fravaerPerioder: eoValues.fravaerPerioder,
    eoValues,
    skadedato: overrides?.tafBeregningsperiodeTil ? undefined : toISODateString('2024-06-01'),
    skadestype: 'Arbejdsulykke',
  };
};

describe('deriveLoenindkomstVm', () => {
  describe('satserByAfId', () => {
    it('afspejler ansættelsesforholdets satser pr. af-id', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        feriePct: 12.5,
        fritvalgPct: 4,
        shSoPct: 1.5,
        storeBededagPct: 0.45,
        pensionPct: 12,
      };
      const model = deriveLoenindkomstVm(buildInput([af]));
      expect(model.satserByAfId.get(af.id)).toEqual({
        ferie: 12.5,
        fritvalg: 4,
        shSo: 1.5,
        bededag: 0.45,
        pension: 12,
      });
    });

    it('har en post pr. ansættelsesforhold', () => {
      const af1 = createDefaultLoenindkomstAnsaettelsesforhold();
      const af2 = createDefaultLoenindkomstAnsaettelsesforhold();
      const model = deriveLoenindkomstVm(buildInput([af1, af2]));
      expect(model.satserByAfId.size).toBe(2);
      expect(model.derivedCalculatorByAfId.size).toBe(2);
      expect(model.satserByAfId.has(af1.id)).toBe(true);
      expect(model.satserByAfId.has(af2.id)).toBe(true);
    });
  });

  describe('getAnvendtReguleringsdatoForAnsaettelsesforhold', () => {
    it('bruger særlig fra-dato for regulering når den er sat (Beregningsperiode)', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        saerligFraDatoRegulering: toISODateString('2023-01-15'),
      };
      const input = buildInput([af], {
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeTil: toISODateString('2024-12-31'),
      });
      const model = deriveLoenindkomstVm(input);
      expect(model.getAnvendtReguleringsdatoForAnsaettelsesforhold(af)).toBe(toISODateString('2023-01-15'));
    });

    it('falder tilbage til beregningsperiodens slutdato uden særlig fra-dato (Beregningsperiode)', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        saerligFraDatoRegulering: undefined,
      };
      const input = buildInput([af], {
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeTil: toISODateString('2024-12-31'),
      });
      const model = deriveLoenindkomstVm(input);
      expect(model.getAnvendtReguleringsdatoForAnsaettelsesforhold(af)).toBe(toISODateString('2024-12-31'));
    });

    it('falder tilbage til skadedatoen, mens beregningsperiodens slutdato endnu mangler', () => {
      const af = createDefaultLoenindkomstAnsaettelsesforhold();
      const model = deriveLoenindkomstVm(buildInput([af], {
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeTil: undefined,
      }));

      expect(model.getAnvendtReguleringsdatoForAnsaettelsesforhold(af)).toBe(toISODateString('2024-06-01'));
      expect(model.getLoenudviklingBaseDate(af)).toMatchObject({
        iso: toISODateString('2024-06-01'),
        display: '01-06-2024',
        errorMessage: undefined,
      });
    });
  });

  describe('getLoenudviklingBaseDate', () => {
    it('returnerer formateret dato + iso når der findes en anvendt reguleringsdato', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        saerligFraDatoRegulering: toISODateString('2023-03-10'),
      };
      const input = buildInput([af], {
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeTil: toISODateString('2024-12-31'),
      });
      const model = deriveLoenindkomstVm(input);
      const baseDate = model.getLoenudviklingBaseDate(af);
      expect(baseDate.iso).toBe(toISODateString('2023-03-10'));
      expect(baseDate.display).toBe('10-03-2023');
      expect(baseDate.errorMessage).toBeUndefined();
    });

    it('returnerer fejlmeddelelse når der ikke kan udledes en reguleringsdato', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        saerligFraDatoRegulering: undefined,
      };
      const input = {
        ...buildInput([af], {
          beregnesUdFra: 'Beregningsperiode',
          tafBeregningsperiodeTil: undefined,
        }),
        skadedato: undefined,
      };
      const model = deriveLoenindkomstVm(input);
      const baseDate = model.getLoenudviklingBaseDate(af);
      expect(baseDate.iso).toBeUndefined();
      expect(baseDate.display).toBe('');
      expect(baseDate.errorMessage).toBe('Skadedato er ikke udfyldt');
    });

    it('bruger anmeldelsesdato i manglende basisdato-fejl ved erhvervssygdom', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        saerligFraDatoRegulering: undefined,
      };
      const input = {
        ...buildInput([af], {
          beregnesUdFra: 'Beregningsperiode',
          tafBeregningsperiodeTil: undefined,
        }),
        skadedato: undefined,
        skadestype: 'Erhvervssygdom' as const,
      };
      const model = deriveLoenindkomstVm(input);
      expect(model.getLoenudviklingBaseDate(af).errorMessage).toBe('Anmeldelsesdato er ikke udfyldt');
    });

    it('bruger skadedato som fallback i manglende basisdato-fejl når skadestype mangler', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        saerligFraDatoRegulering: undefined,
      };
      const input = {
        ...buildInput([af], {
          beregnesUdFra: 'Beregningsperiode',
          tafBeregningsperiodeTil: undefined,
        }),
        skadedato: undefined,
        skadestype: undefined,
      };
      const model = deriveLoenindkomstVm(input);
      expect(model.getLoenudviklingBaseDate(af).errorMessage).toBe('Skadedato er ikke udfyldt');
    });
  });

  describe('isOffentligLoenSelectionReady', () => {
    it('er klar (true) uden offentlig overenskomst', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        overenskomstId: undefined,
      };
      const model = deriveLoenindkomstVm(buildInput([af]));
      expect(model.isOffentligLoenSelectionReady(af)).toBe(true);
    });

    it('er ikke klar når offentlig overenskomst mangler løntrin/gruppe', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: true,
        overenskomstId: 'kl-overenskomst',
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: undefined,
        offentligLoenGruppe: undefined,
      };
      const model = deriveLoenindkomstVm(buildInput([af]));
      expect(model.isOffentligLoenSelectionReady(af)).toBe(false);
    });

    it('er klar når offentlig overenskomst har gyldigt løntrin og gruppe', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: true,
        overenskomstId: 'kl-overenskomst',
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: 30,
        offentligLoenGruppe: 2,
      };
      const model = deriveLoenindkomstVm(buildInput([af]));
      expect(model.isOffentligLoenSelectionReady(af)).toBe(true);
    });
  });

  describe('manualBaseRowErrorsByAfId', () => {
    it('udelader ansættelsesforhold der ikke bruger manuelt angivet lønudvikling', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        loenudviklingBeregningsgrundlag: 'Overenskomst',
      };
      const model = deriveLoenindkomstVm(buildInput([af]));
      expect(model.manualBaseRowErrorsByAfId[af.id]).toBeUndefined();
    });

    it('medtager ansættelsesforhold med manuelt angivet lønudvikling', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        feriePct: 12.5,
        fritvalgPct: 4,
        shSoPct: 1.5,
        pensionPct: 12,
      };
      const model = deriveLoenindkomstVm(buildInput([af]));
      // Posten findes (selv hvis der ikke er nogen celle-fejl) — afledningen kører for manuelt-sporet.
      expect(Object.prototype.hasOwnProperty.call(model.manualBaseRowErrorsByAfId, af.id)).toBe(true);
    });

    it('udelader basisrække-fejl i Beløb-tilstand', () => {
      // Beløb-tilstand bruger tabelcellernes egne satser, og de skjulte top-satsfelter må ikke
      // producere synlige basisrække-fejl.
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        tillaegAngivesSom: 'beloeb',
        feriePct: 12.5,
      };
      const model = deriveLoenindkomstVm(buildInput([af]));
      expect(model.manualBaseRowErrorsByAfId[af.id]).toBeUndefined();
    });
  });

  describe('getFilteredOverenskomsterForAnsaettelsesforhold', () => {
    it('returnerer en liste (ufiltreret når intet filter er sat)', () => {
      const af = createDefaultLoenindkomstAnsaettelsesforhold();
      const model = deriveLoenindkomstVm(buildInput([af]));
      const result = model.getFilteredOverenskomsterForAnsaettelsesforhold(af);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('resolveOverenskomstLabel', () => {
    it('returnerer "Ingen valgt" når intet er valgt', () => {
      const af = createDefaultLoenindkomstAnsaettelsesforhold();
      const model = deriveLoenindkomstVm(buildInput([af]));
      expect(model.resolveOverenskomstLabel(undefined)).toBe('Ingen valgt');
      expect(model.resolveOverenskomstLabel('   ')).toBe('Ingen valgt');
    });
  });

  describe('showSygeferiegodtgoerelseSection', () => {
    it('er true når der er krav på TAF og skadelidte var ansat på skadestidspunktet', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        ansatPaaSkadestidspunktet: true,
      };
      const model = deriveLoenindkomstVm(buildInput([af], { kravPaaTabtArbejdsfortjeneste: 'Ja' }));
      expect(model.showSygeferiegodtgoerelseSection(af)).toBe(true);
    });

    it('er false når der ikke er krav på TAF', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        ansatPaaSkadestidspunktet: true,
      };
      const model = deriveLoenindkomstVm(buildInput([af], { kravPaaTabtArbejdsfortjeneste: 'Nej' }));
      expect(model.showSygeferiegodtgoerelseSection(af)).toBe(false);
    });

    it('er false når skadelidte ikke var ansat på skadestidspunktet', () => {
      const af: Ansaettelsesforhold = {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        ansatPaaSkadestidspunktet: false,
      };
      const model = deriveLoenindkomstVm(buildInput([af], { kravPaaTabtArbejdsfortjeneste: 'Ja' }));
      expect(model.showSygeferiegodtgoerelseSection(af)).toBe(false);
    });
  });

  describe('getSfggReferenceperiodeAvailability', () => {
    it('returnerer ingen-fejl-tilstand når der ikke kan opgøres en referenceperiode', () => {
      const af = createDefaultLoenindkomstAnsaettelsesforhold();
      const model = deriveLoenindkomstVm(buildInput([af]));
      const availability = model.getSfggReferenceperiodeAvailability(af, undefined);
      expect(availability).toEqual({
        maxFravaersdage: undefined,
        hasNoRelevantDaysError: false,
        dayLabel: null,
      });
    });
  });

  describe('firstTafFraDato / sfggReferenceperiodeMaxDate', () => {
    it('udleder tidligste TAF-fra-dato og dagen før som referenceperiodens maks', () => {
      const af = createDefaultLoenindkomstAnsaettelsesforhold();
      const values = baseValues();
      const tafPerioder = values.tafPerioder.map((row, index) =>
        index === 0
          ? { ...row, fra: toISODateString('2024-05-02'), til: toISODateString('2024-05-31') }
          : row
      );
      const model = deriveLoenindkomstVm(buildInput([af], { tafPerioder }));
      expect(model.firstTafFraDato).toBe(toISODateString('2024-05-02'));
      expect(model.sfggReferenceperiodeMaxDate).toBe(toISODateString('2024-05-01'));
    });

    it('er undefined når ingen TAF-fra-datoer er udfyldt', () => {
      const af = createDefaultLoenindkomstAnsaettelsesforhold();
      const model = deriveLoenindkomstVm(buildInput([af]));
      expect(model.firstTafFraDato).toBeUndefined();
      expect(model.sfggReferenceperiodeMaxDate).toBeUndefined();
    });
  });
});
