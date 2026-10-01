import {
  assessPeriodeDatoMangler,
  buildPeriodeRaekkeNavn,
  buildTafLoseFeriedageMaxMessage,
  harTafPeriodeIngenArbejdsdage,
  resolveTafLoseFeriedageMaksimum,
} from '../../../domain/erstatningsopgoerelse/validation/tafRowRules';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('buildPeriodeRaekkeNavn', () => {
  it('navngiver en helt tom række uden datoer eller løse feriedage', () => {
    expect(buildPeriodeRaekkeNavn('TAF-perioden', {})).toBe('TAF-perioden uden datoer');
  });

  it('navngiver dato- og løse-feriedage-partitionerne', () => {
    expect(buildPeriodeRaekkeNavn('Ferieperioden', { fra: iso('2024-01-01'), til: iso('2024-01-31') })).toBe('Ferieperioden 01-01-2024 - 31-01-2024');
    expect(buildPeriodeRaekkeNavn('TAF-perioden', { fra: iso('2024-01-01') })).toBe('TAF-perioden fra 01-01-2024');
    expect(buildPeriodeRaekkeNavn('TAF-perioden', { til: iso('2024-01-31') })).toBe('TAF-perioden til 31-01-2024');
    expect(buildPeriodeRaekkeNavn('TAF-perioden', { loseFeriedage: 1 })).toBe('TAF-perioden med 1 løs ferie-/feriefridag');
    expect(buildPeriodeRaekkeNavn('TAF-perioden', { loseFeriedage: 2 })).toBe('TAF-perioden med 2 løse ferie-/feriefridage');
  });
});

describe('TAF-rækkens direkte regler', () => {
  it('bygger max-beskeden og finder maksimum for løse feriedage', () => {
    const row = { id: 'taf-1', fra: iso('2024-01-08'), til: iso('2024-01-12'), loseFeriedage: 6 };
    const values = {
      ferieperioder: [],
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
    };

    expect(resolveTafLoseFeriedageMaksimum(row, values, iso('2024-01-01'))).toBe(5);
    expect(buildTafLoseFeriedageMaxMessage(5)).toBe('Løse ferie-/feriefridage overstiger mulige arbejdsdage i perioden (maksimalt 5)');
  });

  it('returnerer ingen maksimumsfejl for tom, ugyldig eller gyldig størrelse', () => {
    const values = { ferieperioder: [], vedroererPeriodeFra: iso('2024-01-01'), vedroererPeriodeTil: iso('2024-01-31') };

    expect(resolveTafLoseFeriedageMaksimum({ id: 'tom', fra: iso('2024-01-08'), til: iso('2024-01-12'), loseFeriedage: undefined }, values, undefined)).toBeUndefined();
    expect(resolveTafLoseFeriedageMaksimum({ id: 'ugyldig', fra: iso('2024-02-01'), til: iso('2024-01-31'), loseFeriedage: 2 }, values, undefined)).toBeUndefined();
    expect(resolveTafLoseFeriedageMaksimum({ id: 'gyldig', fra: iso('2024-01-08'), til: iso('2024-01-12'), loseFeriedage: 2 }, values, undefined)).toBeUndefined();
  });

  it('skelner mellem weekend, hverdag og manglende clamp', () => {
    expect(harTafPeriodeIngenArbejdsdage(null)).toBe(false);
    expect(harTafPeriodeIngenArbejdsdage({ fra: iso('2024-01-06'), til: iso('2024-01-07') })).toBe(true);
    expect(harTafPeriodeIngenArbejdsdage({ fra: iso('2024-01-08'), til: iso('2024-01-08') })).toBe(false);
  });

  it('samler manglende fra- og til-datoer i den rigtige celle', () => {
    expect(assessPeriodeDatoMangler(true, true)).toBeUndefined();
    expect(assessPeriodeDatoMangler(false, false)).toEqual({ message: 'Fra- og til-dato er ikke angivet', field: 'fra' });
    expect(assessPeriodeDatoMangler(true, false)).toEqual({ message: 'Til-dato er ikke angivet', field: 'til' });
    expect(assessPeriodeDatoMangler(false, true)).toEqual({ message: 'Fra-dato er ikke angivet', field: 'fra' });
  });
});
