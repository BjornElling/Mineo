import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { eetCanonicalOutputSchema } from '../../../domain/erhvervsevnetab/eetCanonicalOutput';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';
import type { ErhvervsevnetabComposedValues, StamdataValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const values: ErhvervsevnetabComposedValues = {
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: iso('2026-03-19'),
  skadelidteFodselsdato: iso('1980-01-01'),
  aslAarsloen: { kind: 'number', value: 600000 },
  ealAarsloen: { kind: 'number', value: 600000 },
  ealEetPct: 25,
  aslAfgoerelser: [{
    id: 'endelig-1',
    afgoerelsesDato: iso('2025-09-15'),
    virkningsDato: iso('2025-07-01'),
    eetPct: 25,
    kapDato: iso('2025-09-15'),
    kapPct: 25,
    afgoerelseType: 'Endelig',
    tidlKapDato: undefined,
    fsTilbageholdtEet: 'Nej',
  }],
};

const stamdata: StamdataValues = {
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: '',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2024-07-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
};

const buildSnapshot = () => computeEetSnapshot({
  values,
  stamdata,
  fieldErrors: { stamdata: {}, erhvervsevnetab: {}, faellesAarsloen: {} },
});

describe('eetCanonicalOutput', () => {
  it('validerer hele det autoritative snapshot inklusive alle projektioner', () => {
    expect(eetCanonicalOutputSchema.safeParse(buildSnapshot()).success).toBe(true);
  });

  it('afviser et ikke-helt ørebeløb i en indlejret projektion', () => {
    const invalid = structuredClone(buildSnapshot()) as unknown as {
      efterEal: { computation: { ealKravOre: number } | null };
    };
    expect(invalid.efterEal.computation).not.toBeNull();
    invalid.efterEal.computation!.ealKravOre += 0.5;

    expect(eetCanonicalOutputSchema.safeParse(invalid).success).toBe(false);
  });

  it('afviser ukendte felter, så outputdrift failer lukket', () => {
    const invalid = { ...buildSnapshot(), ukendtProjektion: {} };
    expect(eetCanonicalOutputSchema.safeParse(invalid).success).toBe(false);
  });
});

