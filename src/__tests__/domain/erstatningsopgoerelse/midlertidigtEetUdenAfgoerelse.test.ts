import {
  MIDLERTIDIGT_EET_UDEN_AFGOERELSE_HENTET_ID,
  MIDLERTIDIGT_EET_UDEN_AFGOERELSE_INTET_HENTET_ID,
  resolveMidlertidigtEetUdenAfgoerelseIssue,
} from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetTransientInjection';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { getEoBilagAvailability } from '../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { resolveMidlertidigtEetIssueNavigation } from '../../../domain/erhvervsevnetab/eetIssueNavigation';
import { eoMidlertidigtEETAfgorelseField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { toISODateString } from '../../../types/branded';

const group = { afgoerelsesdato: toISODateString('2026-06-01'), eetPct: 50, rows: [], perioder: [] } as MidlertidigtEetAfgoerelseGroup;

const values = (midlertidigtEETAfgorelse: 'Ja' | 'Nej', midlertidigtEetFraEetSiden: 'Ja' | 'Nej' = 'Ja') =>
  ({ midlertidigtEETAfgorelse, midlertidigtEetFraEetSiden });

describe('resolveMidlertidigtEetUdenAfgoerelseIssue (BB-372)', () => {
  it('siger, at intet fradrages, når togglen intet henter', () => {
    const issue = resolveMidlertidigtEetUdenAfgoerelseIssue({ values: values('Nej'), result: { groups: [], issues: [] } });
    expect(issue).toMatchObject({
      id: MIDLERTIDIGT_EET_UDEN_AFGOERELSE_INTET_HENTET_ID,
      severity: 'warning',
      message: 'Midlertidigt EET hentes fra Erhvervsevnetab-siden, men der er ikke angivet en midlertidig EET-afgørelse – der fradrages intet midlertidigt EET',
      focusTarget: { kind: 'fieldAddress', address: eoMidlertidigtEETAfgorelseField.bind().address },
    });
  });

  it('påpeger uoverensstemmelsen, når togglen henter en afgørelse', () => {
    const issue = resolveMidlertidigtEetUdenAfgoerelseIssue({ values: values('Nej'), result: { groups: [group], issues: [] } });
    expect(issue?.id).toBe(MIDLERTIDIGT_EET_UDEN_AFGOERELSE_HENTET_ID);
    expect(issue?.message).toBe(
      'Erhvervsevnetab-siden har en midlertidig afgørelse, men der er ikke angivet en midlertidig EET-afgørelse på EO oplysninger'
    );
  });

  it('tier ved en angivet afgørelse, en slået-fra toggle eller en blokerende importfejl', () => {
    const tom = { groups: [], issues: [] };
    expect(resolveMidlertidigtEetUdenAfgoerelseIssue({ values: values('Ja'), result: tom })).toBeUndefined();
    expect(resolveMidlertidigtEetUdenAfgoerelseIssue({ values: values('Nej', 'Nej'), result: tom })).toBeUndefined();
    expect(resolveMidlertidigtEetUdenAfgoerelseIssue({
      values: values('Nej'),
      result: { groups: [], issues: [{ id: 'x', severity: 'error', message: 'Fejl' }] },
    })).toBeUndefined();
  });

  it('linker til «AES-afgørelser» på EO oplysninger', () => {
    expect(resolveMidlertidigtEetIssueNavigation({ id: MIDLERTIDIGT_EET_UDEN_AFGOERELSE_INTET_HENTET_ID })).toMatchObject({
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'eo_oplysninger',
      sectionTitle: 'AES-afgørelser',
    });
  });
});

describe('bilagsvalget «Midlertidigt EET», når togglen intet henter (BB-372)', () => {
  const eoValues = {
    ...createErstatningsopgoerelseInitialValues(),
    kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
    midlertidigtEetFraEetSiden: 'Ja' as const,
  };

  it('er inaktivt med en grund, når der intet hentes', () => {
    expect(getEoBilagAvailability({ eoValues, midlertidigtEetGroups: [] }).midlertidigEet).toEqual({
      enabled: false,
      disabledReason: 'Der hentes ingen midlertidige EET-ydelser fra Erhvervsevnetab-siden',
    });
  });

  it('er aktivt, når der hentes en afgørelse – og når beregningen ikke foreligger', () => {
    expect(getEoBilagAvailability({ eoValues, midlertidigtEetGroups: [group] }).midlertidigEet.enabled).toBe(true);
    expect(getEoBilagAvailability({ eoValues }).midlertidigEet.enabled).toBe(true);
  });
});
