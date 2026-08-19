/**
 * Testtræets kommentarer beskriver programmet, som det ER – ikke rejsen dertil.
 *
 * `productionLanguageGuard` håndhæver allerede dette for produktionskode og kontrakter, men den
 * udelader bevidst `src/__tests__/**` (den måler produktionssprog). I det hul kan der samle sig
 * kommentarer, som forankrer ægte begrundelser i lukkede arbejdsdokumenter: work-item-numre,
 * fund-id'er, faser, etaper og runder. Dokumenterne findes ikke, så en læser kan ikke følge
 * henvisningen – og den WHY, kommentaren faktisk bar, er dermed gjort uopslåelig.
 *
 * Værnet er ikke kosmetik. En kommentar, der udskyder et kendt dækningshul til et nummereret
 * arbejdsdokument, ligner et SPORET forhold – men findes dokumentet ikke, er hullet reelt
 * utrackéret. Det er samme fejlklasse, som resten af kvalitetsværnene findes for at udelukke: en
 * påstand uden dækning.
 *
 * **Hvorfor AST og ikke et linjefilter:** i testtræet er præcis disse ord legitime som KODE.
 * `productionLanguageGuard` og `testNamingConvention` bærer dem som regex-literaler, `deletionLedger`
 * som slettede stinavne i data, og fraværsreglerne som forbudte symbolnavne i allowlists. Et
 * tekstfilter kan ikke skelne dem fra prosa og ville kræve filundtagelser præcis dér, hvor en ægte
 * overtrædelse kunne gemme sig ([[project_structural_questions_need_ast]]). Scanneren læser derfor kun
 * kommentar-trivia via `./sourceComments`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { sourceComments } from './sourceComments';

const TEST_ROOT = 'src/__tests__';

/**
 * Markører for et lukket arbejdsforløb.
 *
 * Listen er bevidst SMALLERE end `productionLanguageGuard`s. Ord som `greenfield` og `cutover` er
 * udeladt her, fordi de har levende betydninger i testtræet: fraværsværn navngiver med vilje de
 * slettede greenfield-symboler, og `cutover` er et DOMÆNEBEGREB i erhvervsevnetab (skæringsdatoen
 * mellem en midlertidig og en endelig afgørelse). Et værn, hvis undtagelsesliste bliver længere end
 * dens fund, måler ikke længere noget.
 */
const CLOSED_WORKSTREAM_MARKERS: readonly RegExp[] = [
  /\bWI-\d+\b/i,
  /\b[A-Z][A-Z0-9]*-F\d+\b/,
  /\bOBS-\d+\b/,
  /\bBF-\d+\b/,
  /\bFase\s+\d+(?:\.\d+)?\b/i,
  /\betape\s+\d+\b/i,
  /\brunde\s+\d+\b/i,
  /\bpass\s+\d+\b/i,
  /\breview[- ]?(?:plan|fund|punkt|spor|historik)\b/i,
  /\bacceptmatrix\b/i,
  /\btrin\s+13\b/i,
];

/**
 * De begrundede undtagelser, som en NØJAGTIG kommentar-tekststump.
 *
 * Formen er en substring og ikke et mønster: en regex-undtagelse ville også fritage fremtidige
 * kommentarer, som ingen har vurderet. Hver post er én besluttet undtagelse.
 */
const ALLOWED: readonly Readonly<{ fragment: string; why: string }>[] = [
  {
    fragment: 'Fase 1: kun preflight-dialogen',
    why: 'Load-apply-transaktionens to faser er en LEVENDE mekanisme (persistence-contract §10): '
      + 'en SYNKRON fase 1 og en ASYNKRON fase 2. Ordet er det korrekte navn på det, der testes.',
  },
  {
    fragment: 'Fase 2: preflight lukket',
    why: 'Samme løbende load-apply-transaktion som ovenfor.',
  },
  {
    fragment: 'den asynkrone fase er et selvstændigt kald',
    why: 'Beskriver load-applys fase 1/fase 2-opdeling (persistence-contract §10), ikke et projektforløb.',
  },
  {
    fragment: 'Fase 1 fejler → kalderen kaster',
    why: 'Samme load-apply-transaktion: fase 1 fejler → uændret state (persistence-contract §10).',
  },
];

const collectTestFiles = (dir: string, out: string[] = []): string[] => {
  for (const name of fs.readdirSync(path.resolve(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (fs.statSync(path.resolve(process.cwd(), rel)).isDirectory()) collectTestFiles(rel, out);
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
};

const files = collectTestFiles(TEST_ROOT);
const commentsByFile = new Map(
  files.map((file) => [
    file,
    sourceComments(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'), file),
  ] as const)
);

describe('testtræets kommentarer beskriver sluttilstanden', () => {
  it('testfladen findes – værnet kan ikke være grønt af tomhed', () => {
    // Uden gulvet ville en flyttet eller omdøbt testrod gøre hele reglen tavs grøn.
    expect(files.length, `ingen testfiler fundet under ${TEST_ROOT}`).toBeGreaterThan(400);
  });

  it('scanneren læser kommentarer og IKKE kode med samme indhold', () => {
    // Selvtesten er værnets kerne: kan den ikke skelne, er hvert fund nedenfor upålideligt.
    const probe = [
      'const PATTERN = /\\bWI-\\d+\\b/;',
      'const dead = ["src/input/legacyBridge.ts"]; // fase 4',
      'it("WI-013 er et testnavn, ikke en kommentar", () => {});',
      '/** Ægte prosa om Fase 7. */',
    ].join('\n');
    const found = sourceComments(probe, 'probe.ts').filter(
      (comment) => CLOSED_WORKSTREAM_MARKERS.some((pattern) => pattern.test(comment.text))
    );
    // Regex-literalen og testnavnet er kode; de to kommentarer er prosa.
    expect(found.map((comment) => comment.line)).toEqual([2, 4]);
  });

  /**
   * Selvtestens ANDET ben: udtrækket skal holde på en RIGTIG fil, ikke kun på en kort probe.
   *
   * En kommentarlæser kan bestå probet ovenfor og alligevel tabe langt de fleste kommentarer i en
   * rigtig kildefil – kommentarer er trivia, og en implementering, der forventer dem som selvstændige
   * tokens, finder kun de få, der tilfældigvis står, hvor den kigger. Et sådant værn er tavst grønt.
   * Gulvet her er derfor målt mod en fil, hvis kommentartæthed er kendt og høj.
   */
  it('udtrækket finder kommentarerne i en RIGTIG kildefil (ikke tavst grønt)', () => {
    const realFile = 'src/__tests__/quality/architecture/rules/domainRules.ts';
    const content = fs.readFileSync(path.resolve(process.cwd(), realFile), 'utf8');
    const found = sourceComments(content, realFile);

    expect(found.length, `${realFile} har mange kommentarer – udtrækket fandt kun ${found.length}`)
      .toBeGreaterThan(80);
    // Og de skal være PROSA, ikke tomme strenge fra et forkert strip.
    expect(found.filter((comment) => comment.text.trim().length > 20).length).toBeGreaterThan(40);
  });

  it('ingen kommentar forankrer sin begrundelse i et lukket arbejdsdokument', () => {
    const findings: string[] = [];

    for (const file of files) {
      for (const comment of commentsByFile.get(file) ?? []) {
        if (ALLOWED.some((entry) => comment.text.includes(entry.fragment))) continue;
        // HVER ramt linje rapporteres, ikke kun den første i blokken. En JSDoc-blok kan bære flere
        // henvisninger, og et fund pr. blok ville få de øvrige til at se rettede ud, så snart den
        // første var væk – værnet ville dermed under-rapportere præcis dér, hvor der er mest at rydde op i.
        comment.text.split(/\r?\n/).forEach((candidate, offset) => {
          const marker = CLOSED_WORKSTREAM_MARKERS.find((pattern) => pattern.test(candidate));
          if (marker === undefined) return;
          findings.push(`${file}:${comment.line + offset}  ${candidate.trim()}  – rammer ${marker.source}`);
        });
      }
    }

    expect(
      findings,
      'Kommentarer henviser til lukkede arbejdsdokumenter. Skriv begrundelsen om, så den står på egne '
      + 'ben som en beskrivelse af programmets nuværende tilstand:\n' + findings.join('\n')
    ).toEqual([]);
  });

  it('hver undtagelse svarer til en kommentar, der faktisk findes', () => {
    // Anti-rot: en undtagelse for prosa, ingen længere skriver, er en fritagelse for ingenting.
    const live = files.flatMap((file) => (commentsByFile.get(file) ?? []).map((comment) => comment.text));
    const dead = ALLOWED
      .filter((entry) => !live.some((text) => text.includes(entry.fragment)))
      .map((entry) => entry.fragment);
    expect(dead, 'undtagelser uden en levende kommentar – fjern dem').toEqual([]);
  });
});
