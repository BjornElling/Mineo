import {
  evaluateForligAnsvarsgradRules,
  FORLIG_BEGGE_UDFYLDT_FEJL,
  FORLIG_DATO_KRAEVER_ANSVARSGRAD_FEJL,
} from '../../../domain/erstatningsopgoerelse/validation/forligAnsvarsgradRules';
import type { ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => value as ISODateString;

describe('evaluateForligAnsvarsgradRules', () => {
  it('flagger ikke noget når intet er udfyldt', () => {
    const result = evaluateForligAnsvarsgradRules({
      forligAnsvarsgradProcent: undefined,
      forligAnsvarsgradBroek: undefined,
      forligDato: undefined,
    });
    expect(result.beggeUdfyldt).toBe(false);
    expect(result.beggeUdfyldtFejl).toBeUndefined();
    expect(result.forligDatoFejl).toBeUndefined();
  });

  it('flagger "begge udfyldt" når både procent og brøk er sat', () => {
    const result = evaluateForligAnsvarsgradRules({
      forligAnsvarsgradProcent: 50,
      forligAnsvarsgradBroek: '1/3',
      forligDato: undefined,
    });
    expect(result.beggeUdfyldt).toBe(true);
    expect(result.beggeUdfyldtFejl).toBe(FORLIG_BEGGE_UDFYLDT_FEJL);
    // Dato-reglen er ikke i spil, når ansvarsgrad er angivet.
    expect(result.forligDatoFejl).toBeUndefined();
  });

  it('flagger "begge udfyldt" selv når procenten er 0 (en sat procent tæller med)', () => {
    const result = evaluateForligAnsvarsgradRules({
      forligAnsvarsgradProcent: 0,
      forligAnsvarsgradBroek: '1/3',
      forligDato: undefined,
    });
    expect(result.beggeUdfyldt).toBe(true);
    expect(result.beggeUdfyldtFejl).toBe(FORLIG_BEGGE_UDFYLDT_FEJL);
  });

  it('flagger dato-reglen når forligDato er sat uden procent eller brøk', () => {
    const result = evaluateForligAnsvarsgradRules({
      forligAnsvarsgradProcent: undefined,
      forligAnsvarsgradBroek: undefined,
      forligDato: iso('2024-05-17'),
    });
    expect(result.forligDatoFejl).toBe(FORLIG_DATO_KRAEVER_ANSVARSGRAD_FEJL);
    expect(result.beggeUdfyldt).toBe(false);
  });

  it('flagger ikke dato-reglen når procent er angivet', () => {
    const result = evaluateForligAnsvarsgradRules({
      forligAnsvarsgradProcent: 50,
      forligAnsvarsgradBroek: undefined,
      forligDato: iso('2024-05-17'),
    });
    expect(result.forligDatoFejl).toBeUndefined();
  });

  it('flagger ikke dato-reglen når brøk er angivet', () => {
    const result = evaluateForligAnsvarsgradRules({
      forligAnsvarsgradProcent: undefined,
      forligAnsvarsgradBroek: '2/3',
      forligDato: iso('2024-05-17'),
    });
    expect(result.forligDatoFejl).toBeUndefined();
  });

  it('behandler whitespace-only brøk som tom', () => {
    const result = evaluateForligAnsvarsgradRules({
      forligAnsvarsgradProcent: 50,
      forligAnsvarsgradBroek: '   ',
      forligDato: undefined,
    });
    expect(result.beggeUdfyldt).toBe(false);
    expect(result.beggeUdfyldtFejl).toBeUndefined();
  });
});
