import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(process.cwd(), 'src');
const EO_PAGE_ROOT = path.resolve(SRC_ROOT, 'components/pages/erstatningsopgoerelse');

const collectSourceFiles = (root: string): string[] => fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
  const absolutePath = path.resolve(root, entry.name);
  if (entry.isDirectory()) return collectSourceFiles(absolutePath);
  return /\.(?:ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
});

const eoSurfaceFiles = (): string[] => [
  path.resolve(SRC_ROOT, 'components/pages/Erstatningsopgoerelse.tsx'),
  ...collectSourceFiles(EO_PAGE_ROOT),
];

/**
 * Greenfields inputveje. En EO-fil, der overhovedet tager imod input, skal gå gennem én af dem:
 * feltskallerne (der modtager `field`/`location`), surface-hookene eller collection-adapteren.
 */
const GREENFIELD_INPUT_PATHS = [
  'useFieldEditor',
  'useFormFieldSurface',
  'useGridCellSurface',
  'useCollectionTable',
  'useCollectionRows',
  'inputCore/react',
] as const;

/** Tegn på at filen overhovedet ER en inputflade (og ikke ren visning/beregning). */
const INPUT_SURFACE_SIGNALS = [/\bfield=\{/, /\blocation=\{/, /onCommit=\{/, /onDraftChange=\{/] as const;

/**
 * Den transiente familie er den ENE bevidste ikke-sagsdata-flade (overlays/dialoger), hvis værdier
 * aldrig persisteres ([[project_transient_input_family]]). Den skal netop IKKE ligge på
 * greenfield-inputvejen — at kræve det ville være at bede den om at skrive sagsdata.
 *
 * Undtagelsen er ikke et hul: `input/transient-cannot-write-case-data` i arkitektur-manifestet
 * håndhæver den anden vej, at en transient control ikke KAN importere en sagsinput-skrivevej.
 */
const TRANSIENT_SURFACE = /\bTransient(?:Amount|Date|Text)Input\b/;

/**
 * Fase 6 omskrev denne guard fra NEGATIV til POSITIV.
 *
 * Den forrige udgave listede otte tekstmarkører fra legacy-formmotoren (`usePersistedForm(`,
 * `useRowDrafts(`, `setEOValues`, `CellInvalidDraftScopeProvider` …) og krævede, at ingen EO-fil
 * indeholdt dem. Efter greenfield-cutoveren er ALLE otte døde i produktionen — de findes kun i
 * historik-kommentarer — og filglobben `Greenfield*.tsx` matchede desuden nul filer, fordi de navne
 * blev fjernet fra produktionen. Guarden kunne altså ikke længere fejle: den var grøn af tomhed,
 * præcis den fejlklasse dødt-værn-detektoren blev bygget for at fange.
 *
 * Forbuddet mod legacy-navnene er ikke mistet — `legacy/forbidden-identifier` i arkitektur-manifestet
 * håndhæver dem nu som AST-identifiers over HELE kilde-grafen, hvilket er bredere end denne fils
 * tekstsøgning i ét undertræ.
 *
 * Det, den brede kontrol IKKE dækker, er det positive: at EO's egne inputflader faktisk ligger på
 * greenfield-vejen. Det er hvad guarden beviser nu, og det er en påstand, der kan fejle — en ny
 * EO-fil med en håndrullet inputflade uden om editoren ville flage.
 */
describe('erstatningsopgørelse greenfield-overflade', () => {
  it('enhver EO-inputflade går gennem greenfield-inputvejen', () => {
    const offenders = eoSurfaceFiles().flatMap((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      const isInputSurface = INPUT_SURFACE_SIGNALS.some((signal) => signal.test(source));
      if (!isInputSurface) return [];
      const onGreenfieldPath = GREENFIELD_INPUT_PATHS.some((marker) => source.includes(marker));
      if (onGreenfieldPath) return [];
      // Undtagelsen gælder KUN en ren transient flade. Bærer filen også et persisteret felt
      // (`field={…}`), skal den på greenfield-vejen — ellers kunne en violation gemme sig bag ét
      // transient input.
      const isPurelyTransient = TRANSIENT_SURFACE.test(source) && !/\bfield=\{/.test(source);
      return isPurelyTransient ? [] : [path.relative(SRC_ROOT, filePath)];
    });

    expect(
      offenders,
      'EO-filer med en inputflade, der ikke går gennem inputCore (felt-/surface-/collection-vejen).'
    ).toEqual([]);
  });

  it('EO-overfladen har faktisk inputflader at kontrollere (guarden er ikke tom)', () => {
    const inputSurfaces = eoSurfaceFiles().filter((filePath) => {
      const source = fs.readFileSync(filePath, 'utf8');
      return INPUT_SURFACE_SIGNALS.some((signal) => signal.test(source));
    });

    // Uden denne assertion ville guarden bestå trivielt, hvis EO-siderne blev flyttet eller omdøbt.
    expect(inputSurfaces.length, 'ingen EO-inputflader fundet — er filglobben forældet?').toBeGreaterThanOrEqual(5);
  });

  it('detektoren afviser en EO-inputflade uden greenfield-vej', () => {
    const violating = 'const C = () => <Input field={x} onChange={(e) => setLocal(e.target.value)} />;';
    expect(INPUT_SURFACE_SIGNALS.some((signal) => signal.test(violating))).toBe(true);
    expect(GREENFIELD_INPUT_PATHS.some((marker) => violating.includes(marker))).toBe(false);
  });
});
