// Værn mod regression i grid-tabellernes row-id-fundament.
//
// HISTORIK — de to fejlklasser, værnet oprindeligt dækkede, og hvorfor kravet har ÆNDRET SIG:
//   1. RNG brugt til at danne en TOM rækkes id inde i en `setState`-updater. StrictMode dobbelt-invokerer
//      updateren → divergerende id'er → id-følsomt persist-fingerprint divergerede → en ryddet celle blev
//      aldrig gemt (datatab). (`project_table_row_id_persist_desync`.)
//   2. En resync-reconcile flyttede/aliaserede et id, så det duplikerede et senere incoming-id → to rækker
//      med samme id → React duplicate-key + datakorruption. (`project_reconcile_rowid_dup`.)
//
// BEGGE fejlklasser var egenskaber ved en arkitektur, der ikke længere findes: tomme rækker blev
// persisteret, `normalizeGridRows` skabte dem inde i en `setState`-updater, og
// `reconcileGridRowIdentityForRestore` graftede id'er mellem incoming og current. Alle tre er slettet.
//
// Determinismekravet var derfor IKKE en universel regel, men en konsekvens af, at id'et blev dannet i en
// dobbelt-invokeret updater. Greenfield danner placeholder-id'et i en `useMemo` bag en ref (den delte
// `usePlaceholderSlotIds`), og et RNG-id er der korrekt: fabrikken kaldes kun, når et slot mangler et id,
// og resultatet gemmes. At kræve `createEmptyRowId` her ville være at håndhæve en regel for en mekanisme,
// der er væk — og guardens egen første assertion sagde i forvejen, at ingen produktionstabel brugte
// `normalizeGridRows`, mens de følgende assertions fortsat bevogtede netop den døde vej.
//
// Værnet dækker nu de invarianter, den LEVENDE model faktisk hviler på:
//   A. Den slettede legacy-model er ikke genindført (fravær, jf. review-planens grundregel 6).
//   B. Ingen tabel har sin egen placeholder-identitets-pulje: livscyklussen er ÉN delt mekanisme. En lokal
//      kopi var netop det, der lod en promotion overskrive det id, et undo skal fokusere (UT-F03/GM-F14).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createPlaceholderSlotState, resolvePlaceholderSlotIds } from '../../inputCore/react/placeholderSlots';

const SRC_DIR = join(process.cwd(), 'src');
const TABLES_DIR = join(SRC_DIR, 'components', 'tables');
const SELF = 'src/__tests__/quality/gridRowIdContractGuard.test.ts';

/** Navne fra den slettede legacy-model. Genopstår de, er den gamle fejlklasse tilbage. */
const DELETED_LEGACY_ROW_MODEL = [
  'normalizeGridRows',
  'reconcileGridRowIdentityForRestore',
  'undoAliasRowIdsByRowId',
] as const;

/**
 * Mønstre for en LOKAL placeholder-identitets-pulje. En tabel må gerne have refs til andet, men den må
 * ikke selv holde placeholder-id'er: så findes livscyklussen i to udgaver, og kun den ene bliver rettet.
 */
const LOCAL_PLACEHOLDER_POOL = [
  /placeholderIdsRef\s*=/,
  /placeholderIdRef\s*=/,
] as const;

const collectTs = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectTs(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
};

const toRel = (file: string): string => file.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '');

describe('grid row-id-kontrakt (struktur-guard)', () => {
  const tableFiles = collectTs(TABLES_DIR);

  it('værnets mål findes: der ER tabelfiler at måle', () => {
    // Uden dette kunne assertions nedenfor blive grønne af tomhed, hvis mappen blev flyttet.
    expect(tableFiles.length).toBeGreaterThan(5);
  });

  it('den slettede legacy-rækkemodel er ikke genindført', () => {
    const offenders: string[] = [];
    for (const file of collectTs(SRC_DIR)) {
      // Værnet NÆVNER selv de slettede navne; det er dens formål som fraværsværn, så den udelader sig selv.
      if (toRel(file) === SELF) continue;
      const source = readFileSync(file, 'utf8');
      for (const name of DELETED_LEGACY_ROW_MODEL) {
        if (source.includes(name)) offenders.push(`${toRel(file)}: ${name}`);
      }
    }
    expect(offenders, `Slettet legacy-rækkemodel genindført:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('ingen tabel har sin egen placeholder-identitets-pulje', () => {
    const offenders: string[] = [];
    for (const file of tableFiles) {
      const source = readFileSync(file, 'utf8');
      for (const pattern of LOCAL_PLACEHOLDER_POOL) {
        if (pattern.test(source)) offenders.push(`${toRel(file)}: ${pattern.source}`);
      }
    }
    expect(
      offenders,
      'En lokal placeholder-pulje er en anden udgave af identitets-livscyklussen; brug '
      + `\`usePlaceholderSlotIds\` (UT-F03/GM-F14):\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('de tabeller, der viser placeholder-rækker, bruger den DELTE livscyklus', () => {
    // Positiv kontrol: at ingen har en lokal pulje er ikke nok — nogen skal faktisk bruge den delte, ellers
    // ville værnet være grønt, fordi mekanismen slet ikke var i brug.
    const users = tableFiles.filter((f) => /usePlaceholderSlotIds\s*\(/.test(readFileSync(f, 'utf8')));
    expect(users.length).toBeGreaterThanOrEqual(4);
  });

  describe('selv-test: mønstrene kan faktisk fejle', () => {
    it('fanger en lokal placeholder-pulje', () => {
      const violating = 'const placeholderIdsRef = React.useRef<string[]>([]);';
      expect(LOCAL_PLACEHOLDER_POOL.some((p) => p.test(violating))).toBe(true);
    });

    it('fanger også enkelt-id-varianten (den defekte model i UT-F03)', () => {
      const violating = 'const placeholderIdRef = React.useRef<string | undefined>(undefined);';
      expect(LOCAL_PLACEHOLDER_POOL.some((p) => p.test(violating))).toBe(true);
    });

    it('accepterer den delte livscyklus', () => {
      const clean = 'const placeholderIds = usePlaceholderSlotIds(committedIdSet, 1, createRowId);';
      expect(LOCAL_PLACEHOLDER_POOL.some((p) => p.test(clean))).toBe(false);
    });
  });

  // Bind værnet til den faktiske runtime-adfærd, så det ikke kun er et tekstmønster.
  it('runtime-bekræftelse: puljen holder id\'erne unikke OG genindtrædende', () => {
    // Den historiske fejlklasse 2 var to rækker med samme id. Puljen kan ikke producere det: hvert slot har
    // sit eget id, og et committet id springes over frem for at blive genbrugt som en anden rækkes.
    const state = createPlaceholderSlotState();
    let n = 0;
    const createRowId = () => { n += 1; return `row-${n}`; };

    const first = resolvePlaceholderSlotIds(state, new Set<string>(), 3, createRowId);
    expect(new Set(first).size).toBe(3);

    // Promotér den midterste; de øvrige beholder deres id, og der opstår ingen dublet.
    const afterPromotion = resolvePlaceholderSlotIds(state, new Set([first[1]!]), 3, createRowId);
    expect(new Set(afterPromotion).size).toBe(3);
    expect(afterPromotion).not.toContain(first[1]);

    // Undo: det promoverede id genindtræder — invarianten, fokusrestoren hviler på (UT-F03).
    const afterUndo = resolvePlaceholderSlotIds(state, new Set<string>(), 3, createRowId);
    expect(afterUndo).toContain(first[1]);
  });
});
