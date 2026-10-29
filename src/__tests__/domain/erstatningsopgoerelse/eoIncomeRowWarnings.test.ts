import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import {
  eoOffentligeYdelserFraDatoField,
  eoOffentligeYdelserTilDatoField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  resolveLoenindkomstRowWarnings,
  resolveOffentligeYdelserRowWarnings,
} from '../../../domain/erstatningsopgoerelse/validation/eoIncomeRowWarnings';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { createEmptyStandardLoenRow } from '../../../domain/aarsloen/standardLoenRowInitialValues';
import { createEoStandardLoenFieldSet } from '../../../domain/erstatningsopgoerelse/eoStandardLoenFieldSet';
import { periodCells } from '../../../domain/standardLoen/standardLoenRowWarnings';

const amount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = toISODateString;

const ydelse = (id: string, overrides: Partial<OffentligeYdelserRow>): OffentligeYdelserRow => ({
  id,
  fraDato: iso('2026-06-01'),
  tilDato: iso('2026-06-30'),
  ydelse: amount(9000),
  tillaeg: undefined,
  ydelsestype: 'kontanthjaelp',
  ...overrides,
});

const addresses = (cells: readonly Readonly<{ address: Parameters<typeof serializeFieldAddress>[0] }>[]) =>
  cells.map((cell) => serializeFieldAddress(cell.address));

describe('resolveOffentligeYdelserRowWarnings', () => {
  it('ser en ydelsestype gemt med sin label som samme type ved dubletkontrollen (BB-364)', () => {
    const warnings = resolveOffentligeYdelserRowWarnings([
      ydelse('a', { ydelsestype: 'Kontanthjælp' }),
      ydelse('b', { ydelsestype: 'kontanthjaelp' }),
    ]);

    expect(warnings.map((warning) => [warning.rowId, warning.kind])).toEqual([['b', 'duplicateRow']]);
  });

  it('advarer, når perioden af en arbejdsdagsydelse ingen arbejdsdage har – ring på datoerne (BB-365)', () => {
    const warnings = resolveOffentligeYdelserRowWarnings([
      ydelse('w', { fraDato: iso('2026-06-06'), tilDato: iso('2026-06-07'), ydelse: amount(3000), ydelsestype: 'feriepenge' }),
    ]);

    expect(warnings).toEqual([expect.objectContaining({
      kind: 'ingenArbejdsdage',
      rowId: 'w',
      summaryMessage: 'Ydelsen Feriepenge 06-06-2026 - 07-06-2026 indeholder ingen arbejdsdage – kontrollér datoerne. Beløbet medregnes i perioden.',
      cellMessage: 'Perioden indeholder ingen arbejdsdage – kontrollér datoerne. Beløbet medregnes i perioden.',
    })]);
    expect(addresses(warnings[0]!.cells)).toEqual([
      serializeFieldAddress(eoOffentligeYdelserFraDatoField.bind('w').address),
      serializeFieldAddress(eoOffentligeYdelserTilDatoField.bind('w').address),
    ]);
  });

  it('advarer ikke om arbejdsdage for en kalenderdagsydelse eller en række uden beløb', () => {
    const warnings = resolveOffentligeYdelserRowWarnings([
      ydelse('k', { fraDato: iso('2026-06-06'), tilDato: iso('2026-06-07'), ydelsestype: 'kontanthjaelp' }),
      ydelse('t', { fraDato: iso('2026-06-13'), tilDato: iso('2026-06-14'), ydelse: undefined, ydelsestype: 'feriepenge' }),
    ]);

    expect(warnings.filter((warning) => warning.kind === 'ingenArbejdsdage')).toEqual([]);
  });
});

describe('resolveLoenindkomstRowWarnings', () => {
  it('giver løn i en periode uden arbejdsdage gul ring på periodecellerne og samme linje som før (BB-365)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet dagsløn';
    const employment = { ...createDefaultLoenindkomstAnsaettelsesforhold(), fuldLoenUnderFerie: 'Nej' as const };
    employment.indtaegtsoplysningerTableData = [
      { ...createEmptyStandardLoenRow('row-1'), col0_maaned: '7', col1_maaned: '2024', col2: amount(1000) },
    ];
    values.loenindkomstAnsaettelsesforhold = [employment];
    values.ferieperioder = [{ id: 'ferie-1', fra: iso('2024-07-01'), til: iso('2024-07-31') }];
    values.tafPerioder = [{ id: 'taf-1', fra: iso('2024-07-01'), til: iso('2024-07-31'), loseFeriedage: undefined }];

    const warnings = resolveLoenindkomstRowWarnings(values, employment, iso('2024-01-01'), iso('2026-10-29'))
      .filter((warning) => warning.kind === 'ingenArbejdsdage');

    const fieldSet = createEoStandardLoenFieldSet(employment.id);
    expect(warnings).toEqual([expect.objectContaining({
      rowId: 'row-1',
      summaryMessage: 'Perioden (01-07-2024 - 31-07-2024) indeholder løn, men ingen arbejdsdage. Lønnen medregnes i indkomsten, men perioden forøger ikke antallet af arbejdsdage.',
    })]);
    expect(addresses(warnings[0]!.cells)).toEqual(addresses(periodCells(fieldSet, 'row-1', 'maaned')));
  });
});
