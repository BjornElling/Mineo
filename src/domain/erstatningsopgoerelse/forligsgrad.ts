import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';

export type Forligsgrad = Readonly<{
  factor: number;
  label: string;
}> | null;

export const parseForligsgrad = (
  values: Pick<ErstatningsopgoerelseValues, 'forligAnsvarsgradProcent' | 'forligAnsvarsgradBroek'>
): Forligsgrad => {
  const procentValue = values.forligAnsvarsgradProcent;
  if (typeof procentValue === 'number' && Number.isFinite(procentValue) && procentValue > 0 && procentValue <= 100) {
    return {
      factor: procentValue / 100,
      label: `${procentValue}%`,
    };
  }

  const broekValue = values.forligAnsvarsgradBroek;
  if (typeof broekValue === 'string' && broekValue.trim() !== '') {
    const trimmed = broekValue.trim();
    const match = trimmed.match(/^(\d+)\/(\d+)$/);
    if (match) {
      const taeller = Number.parseInt(match[1], 10);
      const naevner = Number.parseInt(match[2], 10);
      if (taeller > 0 && naevner > 0 && taeller <= naevner) {
        return {
          factor: taeller / naevner,
          label: trimmed,
        };
      }
    }
  }

  return null;
};
