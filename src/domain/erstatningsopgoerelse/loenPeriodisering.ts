import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';

export const LOEN_PERIODISERING = {
  KALENDERDAGE: 'kalenderdage',
  ARBEJDSDAGE: 'arbejdsdage',
} as const;

export type LoenPeriodisering = (typeof LOEN_PERIODISERING)[keyof typeof LOEN_PERIODISERING];

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

/**
 * Løn periodiseres pr. ansættelsesforhold:
 * - Kalenderdage når fuld løn under ferie = Ja og løn på helligdage = Almindelig løn
 * - Ellers arbejdsdage
 */
export const resolveLoenPeriodiseringForAnsaettelsesforhold = (
  ansaettelsesforhold: Readonly<Ansaettelsesforhold>
): LoenPeriodisering => {
  const usesKalenderdage =
    ansaettelsesforhold.fuldLoenUnderFerie === 'Ja' &&
    ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn';

  return usesKalenderdage ? LOEN_PERIODISERING.KALENDERDAGE : LOEN_PERIODISERING.ARBEJDSDAGE;
};
