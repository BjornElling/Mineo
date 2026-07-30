import { persistedPageHasViewModelRule } from './rules/formRules';
import { makeSyntheticEntry } from './sourceGraph';

const navigation = makeSyntheticEntry(
  'src/config/pageNavigation.ts',
  `export const APP_PAGE_DEFINITIONS = {
    stamdata: { route: '/stamdata', componentFile: 'Stamdata.tsx' },
  } as const;`
);

const page = (source: string) => makeSyntheticEntry('src/components/pages/Stamdata.tsx', source);

describe('persistedPageHasViewModelRule', () => {
  it('accepterer præcis ét kald til den page-lokale kanoniske viewmodel', () => {
    const findings = persistedPageHasViewModelRule.evaluate([
      navigation,
      page(`
        import { useStamdataViewModel } from './stamdata/useStamdataViewModel';
        export const Stamdata = () => {
          const vm = useStamdataViewModel();
          return <main>{vm.title}</main>;
        };
      `),
    ]);

    expect(findings).toEqual([]);
  });

  it('afviser to konkurrerende page-viewmodels, selv om den kanoniske er iblandt dem', () => {
    const findings = persistedPageHasViewModelRule.evaluate([
      navigation,
      page(`
        import { useStamdataViewModel } from './stamdata/useStamdataViewModel';
        import { useParallelViewModel } from './stamdata/useParallelViewModel';
        export const Stamdata = () => {
          const vm = useStamdataViewModel();
          const parallel = useParallelViewModel();
          return <main>{vm.title}{parallel.title}</main>;
        };
      `),
    ]);

    expect(findings.map((finding) => finding.message).join('\n')).toContain(
      'fandt 2 page-viewmodel-kald'
    );
  });

  it('afviser et tomt kompatibilitetskald og en direkte orkestreringsport', () => {
    const findings = persistedPageHasViewModelRule.evaluate([
      navigation,
      page(`
        import { useStamdataViewModel } from './forkert/useStamdataViewModel';
        import { useInputEvaluation } from '../../inputCore/react/useInputEvaluation';
        export const Stamdata = () => {
          useStamdataViewModel();
          const revision = useInputEvaluation();
          return <main>{revision}</main>;
        };
      `),
    ]);
    const messages = findings.map((finding) => finding.message).join('\n');

    expect(messages).toContain('skal importere og kalde præcis én useStamdataViewModel');
    expect(messages).toContain('kalder orkestreringsporten useInputEvaluation direkte');
  });
});
