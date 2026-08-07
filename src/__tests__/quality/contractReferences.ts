/**
 * Kontrakternes referencer til koden, læst ud af selve kontraktteksten.
 *
 * **Hvorfor modulet findes.** `contractCoverageMatrix.test.ts` er en LINKAGE-guard: den kontrollerer, at
 * de koblede testfiler og topologiens stier eksisterer, og at hver kontrakt har et
 * `**Senest verificeret mod kode:**`-felt i det rigtige FORMAT. Ingen af delene siger noget om, hvorvidt
 * kontraktens egne påstande om koden er sande. En kontrakt kunne navngive en fil eller et symbol, der var
 * omdøbt for en måned siden, og hele suiten ville stå grøn — netop den fejlklasse, `acceptanceMatrix.test.ts`
 * kalder «grøn af tomhed».
 *
 * Det er ikke hypotetisk. Ved gennemgangen 2026-08-07 fandtes to levende drift-tilfælde i kontrakter, der
 * begge var stemplet «Senest verificeret mod kode: 2026-08-01»:
 *
 *   - `mineo-field-pattern.md` navngav typen `SettledFieldState`; den hedder `SettledFieldView`.
 *   - `satser-contract.md` navngav `satserSchema.ts`; filen hedder `satserSchemas.ts` (og var stavet
 *     rigtigt i `schema-evolution.md`, så de to kontrakter modsagde hinanden).
 *
 * Begge er ét bogstav galt i en normativ kontrakt — usynligt for typecheck, lint, arkitektur-harnesset og
 * coverage-matrixen, fordi ingen af dem læser kontrakternes brødtekst.
 *
 * **Hvorfor ikke bare "enhver navngiven fil skal findes".** Kontrakterne bruger bevidst navne på ting, der
 * IKKE må findes — fraværsværn. `document-output-contract.md` skriver det eksplicit: «Der findes ingen
 * afviklende dokumentservice og ingen `documentService.ts` — navnet står her som fraværsværn.» En regel om,
 * at alt navngivet skal eksistere, ville tvinge de værn ud af kontrakterne og dermed fjerne den eneste
 * beskrivelse af, hvad der er revet ned. Derfor har hver reference en RETNING: `present` eller `absent`.
 * Begge håndhæves, så en genopstået `documentService.ts` bliver rød på lige fod med et dødt navn.
 *
 * **Hvorfor et eksplicit register og ikke en prosaparser.** Retningen kunne i princippet udledes af den
 * omgivende danske tekst («der findes ingen …», «blev fjernet»). Det ville være et værn, hvis korrekthed
 * afhang af sprogbrug i et dokument, mennesker omskriver — og repoet har allerede lært, at dansk prosa
 * bryder markørbaserede værn. Registret er derfor data: en påstand skrives ned én gang, og testen afgør,
 * om den er sand.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Retningen på en påstand: skal målet findes i koden, eller skal det netop IKKE findes? */
export type ReferenceDirection = 'present' | 'absent';

export type ContractReference = Readonly<{
  /** Repo-relativ kontraktfil, påstanden står i. */
  contract: string;
  /**
   * Referencen ORDRET som den står i kontrakten, uden backticks. Enten en repo-relativ sti
   * (`src/…`), et bart filnavn (`documentModel.ts`) eller et symbolnavn (`SettledFieldView`).
   */
  reference: string;
  direction: ReferenceDirection;
  /** Kort begrundelse. Obligatorisk for `absent`, så et fraværsværn ikke kan blive til en tastefejl. */
  note?: string;
}>;

const REPO_ROOT = process.cwd();

const exists = (relativePath: string): boolean =>
  fs.existsSync(path.resolve(REPO_ROOT, relativePath));

/**
 * Modulspecifikationer i kontrakterne står ofte uden endelse (`src/types/fieldErrors`), præcis som i en
 * import. Opslaget skal derfor prøve de endelser, en TS-import selv ville prøve — ellers ville et helt
 * legitimt referenceformat blive rapporteret som dødt.
 */
const MODULE_SUFFIXES = ['', '.ts', '.tsx', '.mjs', '.json', '/index.ts', '/index.tsx'] as const;

/**
 * Findes stien som fil, mappe eller modulspecifikation uden endelse?
 *
 * Bare filnavne prøves også mod repo-roden, fordi kontrakterne henviser til rodfiler som
 * `AGENTS.md` (auth-gate-kontraktens autoritative klartekst-kilde) uden sti.
 */
export const pathReferenceExists = (reference: string): boolean => {
  if (MODULE_SUFFIXES.some((suffix) => exists(`${reference}${suffix}`))) return true;
  // Bare `.md`-navne er kontrakternes indbyrdes krydsreferencer (`form-contract.md`) og rodfiler
  // (`AGENTS.md`). De skrives uden sti, fordi læseren står i mappen.
  if (!reference.endsWith('.md') || reference.includes('/')) return false;
  return exists(`src/contracts/${reference}`) || exists(`docs/architecture/${reference}`);
};

const SOURCE_DIRS = ['src', 'scripts', 'public'] as const;

const walk = (absoluteDir: string, visit: (absolutePath: string) => void): void => {
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(absolutePath, visit);
      continue;
    }
    visit(absolutePath);
  }
};

let basenameCache: ReadonlySet<string> | null = null;

/** Alle filnavne (uden sti) under kildemapperne — til de referencer, kontrakterne skriver bart. */
export const sourceBasenames = (): ReadonlySet<string> => {
  if (basenameCache !== null) return basenameCache;
  const names = new Set<string>();
  for (const dir of SOURCE_DIRS) {
    const absoluteDir = path.resolve(REPO_ROOT, dir);
    if (!fs.existsSync(absoluteDir)) continue;
    walk(absoluteDir, (absolutePath) => names.add(path.basename(absolutePath)));
  }
  basenameCache = names;
  return names;
};

/**
 * Fjerner blok-/linjekommentarer og strengliteraler, så et navn kun tæller som «findes», når det
 * bruges i kode. Rækkefølgen er vigtig: blokkommentarer først (de kan indeholde apostroffer, som
 * ellers ville starte en falsk streng), derefter linjekommentarer, til sidst literalerne.
 */
export const stripCommentsAndStrings = (source: string): string => {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
  // Et literal, der grænser op til `|` (unionsmedlem) eller efterfølges af `as const`, er en TYPE
  // og bevares. Alt andet strengindhold er data eller prosa og fjernes.
  const keepAsLiveCode = (match: string, offset: number, whole: string): string => {
    const before = whole.slice(Math.max(0, offset - 60), offset);
    const after = whole.slice(offset + match.length, offset + match.length + 20);
    // Unionsmedlem: `'a' | 'b'`.
    if (/\|\s*$/.test(before) || /^\s*\|/.test(after)) return match;
    // Diskriminant i en union-gren eller en sammenligning mod den: `{ kind: 'eo_import'; … }` og
    // `context.kind === 'eo_import'`. Literalet er en type-/kontrolflow-værdi, ikke prosa.
    if (/[A-Za-z_$][\w$]*\s*:\s*$/.test(before) || /[=!]==?\s*$/.test(before)) return match;
    // `as const`-literal.
    if (/^\s*as const/.test(after)) return match;
    // Initialiser til en navngiven konstant: `export const X = 'literal'`. Værdien ER koden — fx
    // storage-nøglen `mineo_app_settings_v1`, som `app-settings.md` med rette navngiver.
    if (/\b(const|let|var)\s+[A-Za-z_$][\w$]*\s*(?::[^=]*)?=\s*$/.test(before)) return match;
    // Modulspecifikation i en import/export: `from '../utils/pwaLaunchQueue'`. Stien ER koden —
    // et modul, der kun nås gennem sine importstier, ville ellers se dødt ud.
    if (/\b(from|import|require\()\s*$/.test(before)) return match;
    return match[0]!.repeat(2);
  };
  return withoutComments
    .replace(/'(?:[^'\\\n]|\\.)*'/g, keepAsLiveCode)
    .replace(/"(?:[^"\\\n]|\\.)*"/g, keepAsLiveCode)
    .replace(/`(?:[^`\\]|\\.)*`/g, keepAsLiveCode);
};

let sourceTextCache: string | null = null;

/**
 * Hele kildeteksten under `src/` og `scripts/` som ét opslag.
 *
 * Et symbolopslag her er bevidst SVAGT: det spørger kun, om navnet forekommer i kildegrafen — ikke om det
 * er en eksporteret deklaration. Det er det rigtige loft for netop denne kontrol. Kontrakterne navngiver
 * både typer, funktioner, konstanter, felter i objektliteraler, AST-regel-id'er i strenge og
 * generator-API'er som `document.writeTitle()`; en «skal være en eksporteret deklaration»-regel ville
 * afvise halvdelen af dem med falske fund. Kontrollen fanger den fejl, den er bygget til: navnet findes
 * slet ikke længere nogen steder, fordi det er omdøbt eller slettet.
 *
 * **Kun PRODUKTIONSKODE, og kun KODE — ikke kommentarer.** To udeladelser, begge load-bearing:
 *
 *   - `src/__tests__/**` udelades, så en kontrakts påstand om koden ikke kan bekræftes af en test, der
 *     blot nævner navnet.
 *   - Kommentarer og strengliteraler strippes, fordi kodebasen bevidst NAVNGIVER slettede mekanismer i
 *     sine kommentarer for at forbyde dem igen («ingen `useGridRowPersistenceCore`, `invalidDrafts`
 *     eller fingerprint»). Uden strippet ville hvert eneste fraværsværn se sit eget forbud som et bevis
 *     på, at det forbudte lever — verificeret på `StyledDateField`, `useSliceRowDrafts` og
 *     `useGridRowPersistenceCore`, der ALLE kun findes i sådanne kommentarer.
 *
 * Tilbage står den rene kodegraf, hvor «findes» betyder «bruges», ikke «omtales». Strippet er
 * bevidst simpelt (kommentarer og strengliteraler) frem for en fuld parse: det skal kun skille kode
 * fra prosa, og AST-harnesset ejer i forvejen den præcise håndhævelse af forbudte navne.
 *
 * **Undtaget fra streng-strippet: literale UNIONS-medlemmer.** Kontrakterne navngiver med rette
 * værdier som `missing_amount`, der kun findes som strengliteral — men i en TYPE (`issue: 'invalid'
 * | 'missing_amount'`), hvilket er ægte, levende kode og ikke prosa. Et literal, der optræder i en
 * unionstype eller som `as const`, bevares derfor.
 */
export const sourceText = (): string => {
  if (sourceTextCache !== null) return sourceTextCache;
  const chunks: string[] = [];
  for (const dir of ['src', 'scripts'] as const) {
    const absoluteDir = path.resolve(REPO_ROOT, dir);
    if (!fs.existsSync(absoluteDir)) continue;
    walk(absoluteDir, (absolutePath) => {
      if (!/\.(ts|tsx|mjs|js|json)$/.test(absolutePath)) return;
      // Kontrakt-MARKDOWN må ikke tælle som kilde — en påstand ville kunne bekræfte sig selv. Men
      // `contract-topology.json` ER maskinlæsbar kilde: kontrakterne henviser med rette til dens
      // felter (`domainContracts`, `crossCuttingContracts`), og de findes kun dér.
      if (absolutePath.includes(`${path.sep}contracts${path.sep}`) && !absolutePath.endsWith('.json')) return;
      if (absolutePath.endsWith('.json')) {
        chunks.push(fs.readFileSync(absolutePath, 'utf8'));
        return;
      }
      // Testkode udelades (se modulets hoved): et fraværsværn må hverken bekræftes af en test, der
      // nævner navnet, eller «genopstå», fordi et kvalitetsværn skriver det i sin egen kommentar.
      if (absolutePath.includes(`${path.sep}__tests__${path.sep}`)) return;
      chunks.push(stripCommentsAndStrings(fs.readFileSync(absolutePath, 'utf8')));
    });
  }
  sourceTextCache = chunks.join('\n');
  return sourceTextCache;
};

/**
 * Forekommer symbolnavnet som et helt ord i kildegrafen?
 *
 * Et navn, der bærer sit eget modul, tæller også som fundet, når modulfilen hedder det samme med
 * lille begyndelsesbogstav: kontrakterne skriver konceptet `EoFileCodec`, mens filen — efter husets
 * navnekonvention — hedder `eoFileCodec.ts`. Det er samme ting, ikke drift.
 */
export const symbolReferenceExists = (symbol: string): boolean => {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${escaped}\\b`).test(sourceText())) return true;
  const asModule = `${symbol.charAt(0).toLowerCase()}${symbol.slice(1)}`;
  return sourceBasenames().has(`${asModule}.ts`) || sourceBasenames().has(`${asModule}.tsx`);
};

/** Ser referencen ud som en sti eller et filnavn (frem for et symbol)? */
export const isPathLike = (reference: string): boolean =>
  reference.includes('/') || /\.(ts|tsx|mjs|json|md)$/.test(reference);

/** Er referencen sand — dvs. stemmer dens faktiske tilstand med den påstået retning? */
export const referenceHolds = (entry: ContractReference): boolean => {
  const found = isPathLike(entry.reference)
    ? pathReferenceExists(entry.reference) || sourceBasenames().has(entry.reference)
    : symbolReferenceExists(entry.reference);
  return entry.direction === 'present' ? found : !found;
};
