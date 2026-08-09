/**
 * Liveness-værn for kontrakternes egne påstande om koden.
 *
 * **Hullet, dette lukker.** `contractCoverageMatrix.test.ts` er en linkage-guard: den kontrollerer, at
 * koblede TESTFILER og topologiens stier eksisterer, og at hver kontrakt har et
 * `**Senest verificeret mod kode:**`-felt i det rigtige FORMAT. Den læser aldrig kontrakternes brødtekst.
 * Alle ~230 fil- og ~430 symbolreferencer INDE i kontrakterne — det, en læser faktisk slår op i — stod
 * derfor helt uden dækning: hverken typecheck, lint, arkitektur-harnesset eller coverage-matrixen kan se
 * dem, fordi ingen af dem åbner en `.md`-fil.
 *
 * Hullet var ikke teoretisk. Gennemgangen 2026-08-07 fandt to levende drift-tilfælde, begge i kontrakter
 * stemplet «Senest verificeret mod kode: 2026-08-01»: `mineo-field-pattern.md` navngav `SettledFieldState`
 * (hedder `SettledFieldView`), og `satser-contract.md` navngav `satserSchema.ts` (hedder `satserSchemas.ts`
 * — og var stavet rigtigt i `schema-evolution.md`, så to kontrakter modsagde hinanden om samme fil). Ét
 * bogstav galt i en normativ kontrakt, usynligt for hele værktøjskæden.
 *
 * **Hvorfor referencerne UDLEDES frem for at stå i et register.** Et håndholdt register over ~660
 * referencer ville selv skulle vedligeholdes, og en glemt post ville være et nyt hul af samme slags. Derfor
 * udtrækkes referencerne af kontraktteksten, og kun UNDTAGELSERNE skrives ned. En ny kontrakt er dermed
 * dækket i samme øjeblik den oprettes — ingen registrering, intet at glemme.
 *
 * **Hvorfor undtagelserne skal skrives ned.** Kontrakterne navngiver bevidst ting, der IKKE må findes
 * (fraværsværn), og bruger navne-MØNSTRE (`XxxVmProvider`) som ikke er symboler. En regel om, at alt
 * navngivet skal eksistere, ville presse fraværsværnene ud af kontrakterne og dermed slette den eneste
 * beskrivelse af, hvad der er revet ned. Hver undtagelse bærer derfor en retning og en begrundelse — og
 * `absent`-retningen HÅNDHÆVES: genopstår `documentService.ts`, bliver denne test rød.
 *
 * **Afgrænsning.** Kun sti-/filnavnereferencer og camelCase-/PascalCase-/SCREAMING_CASE-symboler kontrolleres.
 * Rene små bogstaver i backticks er i kontrakterne overvejende enum-værdier og dansk prosa (`ready`,
 * `dag`, `bounds`); de ville give falske fund uden at fange en eneste reel drift.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  isPathLike,
  pathReferenceExists,
  referenceHolds,
  sourceBasenames,
  symbolReferenceExists,
  type ContractReference,
} from './contractReferences';

const CONTRACTS_DIR = 'src/contracts';

const readFile = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const contractFiles = (): readonly string[] =>
  fs
    .readdirSync(path.resolve(process.cwd(), CONTRACTS_DIR))
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => `${CONTRACTS_DIR}/${fileName}`)
    .sort();

/** Repo-relative stier og bare filnavne: `src/…`, `scripts/…`, `public/…`, `documentModel.ts`. */
const PATH_PATTERN = /`((?:src|scripts|public|docs)\/[A-Za-z0-9_./-]+|[A-Za-z0-9_-]+\.(?:ts|tsx|mjs|json|md))`/g;

/**
 * Symboler kendes på et STORT bogstav eller en understregning inde i navnet — `SettledFieldView`,
 * `computeEoSnapshot`, `NEW_CASE_DEFAULT_SETTINGS_KEYS`. Et navn med udelukkende små bogstaver er i
 * kontrakternes sprogbrug næsten altid en enum-værdi eller et dansk ord og udelades bevidst.
 */
const SYMBOL_PATTERN = /`([A-Za-z_][A-Za-z0-9_]*(?:[A-Z_][A-Za-z0-9_]*)+)`/g;

/**
 * Punkterede referencer — `EOInspektionSnapshot.fieldErrors`, `handle.disabledReason`. Kun TYPE-/
 * objektdelen kontrolleres: medlemsnavne som `fieldErrors` findes i mange urelaterede typer, så et
 * opslag på dem ville hverken kunne bekræfte eller afkræfte noget om netop denne type.
 *
 * Formen har sin egen regel, fordi `SYMBOL_PATTERN` stopper ved punktummet og derfor ALDRIG så disse
 * referencer. Det var ikke teoretisk: `error-contract.md:90` og `form-contract.md:375` skrev begge
 * `EoInspektionSnapshot` (typen hedder `EOInspektionSnapshot` med versalt O), og den drift overlevede
 * den første udgave af netop dette værn.
 */
const DOTTED_PATTERN = /`([A-Z][A-Za-z0-9_]*)\.[A-Za-z_][A-Za-z0-9_]*`/g;

/**
 * Filendelser, der ligner et medlemsnavn. Uden dem ville `` `AGENTS.md` `` blive læst som typen
 * `AGENTS` med medlemmet `md` — et opdigtet symbol, der aldrig kan findes.
 */
const FILE_EXTENSION_TAILS = /\.(md|ts|tsx|mjs|json|js|css|html|docx|pdf|eo|xlsx?|svg|png)`/;

const matchAll = (content: string, pattern: RegExp): readonly string[] =>
  [...content.matchAll(pattern)].map((match) => match[1]!);

/** Punkterede referencer, hvor halen er en filendelse — de er filnavne, ikke `Type.member`. */
const dottedSymbols = (line: string): readonly string[] =>
  [...line.matchAll(DOTTED_PATTERN)]
    .filter((match) => !FILE_EXTENSION_TAILS.test(match[0]!))
    .map((match) => match[1]!);

type ExtractedReference = Readonly<{ contract: string; reference: string; line: number }>;

const extractReferences = (): readonly ExtractedReference[] => {
  const found: ExtractedReference[] = [];
  for (const contract of contractFiles()) {
    // Skabelonen beskriver formen, ikke koden: dens `src/…`-eksempler er illustrationer.
    if (contract.endsWith('contract-template.md')) continue;
    const lines = readFile(contract).split(/\r?\n/);
    lines.forEach((line, index) => {
      const referencesOnLine = [
        ...matchAll(line, PATH_PATTERN),
        ...matchAll(line, SYMBOL_PATTERN),
        ...dottedSymbols(line),
      ];
      for (const reference of new Set(referencesOnLine)) {
        found.push({ contract, reference, line: index + 1 });
      }
    });
  }
  return found;
};

/**
 * De referencer, der IKKE skal findes i koden, eller som ikke er kodenavne.
 *
 * Hver post er en påstand, testen håndhæver — ikke en undertrykkelse. `absent` betyder «dette må ikke
 * genopstå», og en genopstået fil gør testen rød.
 */
const REFERENCE_EXCEPTIONS: readonly ContractReference[] = [
  {
    contract: 'src/contracts/document-output-contract.md',
    reference: 'documentService.ts',
    direction: 'absent',
    note: 'Eksplicit fraværsværn: afviklingen bor i definition/documentLifecycle.ts. Kontrakten skriver selv, at navnet står her som fraværsværn.',
  },
  {
    contract: 'src/contracts/error-contract.md',
    reference: 'useFormFieldErrorReporter',
    direction: 'absent',
    note: 'Slettet reporter-vej. Kontrakten navngiver den for at forbyde dens genkomst.',
  },
  {
    contract: 'src/contracts/form-contract.md',
    reference: 'useFormFieldErrorReporter',
    direction: 'absent',
    note: 'Samme fraværsværn som i error-contract.md, §12s liste over slettede legacy-symboler.',
  },
  {
    contract: 'src/contracts/persistence-contract.md',
    reference: 'persistData',
    direction: 'absent',
    note: 'Slettet offentlig broker-API. Nævnes for at forbyde en ny generel skrivevej.',
  },
  {
    contract: 'src/contracts/persistence-contract.md',
    reference: 'commitInvalidDraft',
    direction: 'absent',
    note: 'Slettet sammen med invalidDrafts-modellen; greenfield bruger rejectedInputs.',
  },
  {
    contract: 'src/contracts/undo-redo-contract.md',
    reference: 'captureValueCommit',
    direction: 'absent',
    note: 'Slettet history-capture-primitiv; §9s fraværsregel.',
  },
  {
    contract: 'src/contracts/undo-redo-contract.md',
    reference: 'captureCoalescing',
    direction: 'absent',
    note: 'Slettet history-capture-primitiv; §9s fraværsregel.',
  },
  {
    contract: 'src/contracts/indskudte-loentillaeg-contract.md',
    reference: 'SAERLIGT_FERIETILLAEG_PCT_FOER',
    direction: 'absent',
    note: 'Særligt ferietillæg er forbudt i koden; satsdataene blev slettet 2026-07-31 og må ikke genindføres.',
  },
  {
    contract: 'src/contracts/indskudte-loentillaeg-contract.md',
    reference: '_EFTER',
    direction: 'absent',
    note: 'Halen af `SAERLIGT_FERIETILLAEG_PCT_FOER`/`_EFTER`-skrivemåden; samme fraværsværn.',
  },
  {
    contract: 'src/contracts/indskudte-loentillaeg-contract.md',
    reference: 'SAERLIGT_FERIETILLAEG_FORHOEJELSE_START',
    direction: 'absent',
    note: 'Samme fraværsværn som ovenfor.',
  },
  {
    contract: 'src/contracts/eo-snapshot-contract.md',
    reference: 'periodeTilBeregningFra',
    direction: 'absent',
    note: 'Tidligere persisteret feltnavn, omdøbt til tafBeregningsperiodeFra. Står i §11s bagudinkompatibilitetsnote.',
  },
  {
    contract: 'src/contracts/eo-snapshot-contract.md',
    reference: 'periodeTilBeregningTil',
    direction: 'absent',
    note: 'Som ovenfor; omdøbt til tafBeregningsperiodeTil.',
  },
  {
    contract: 'src/contracts/error-contract.md',
    reference: 'src/types/fieldErrors',
    direction: 'absent',
    note: 'Fraværsværn: den centrale skrivbare feltfejl-bus er slettet, og modulet må ikke genopstå.',
  },
  {
    contract: 'src/contracts/form-contract.md',
    reference: 'src/types/fieldErrors',
    direction: 'absent',
    note: 'Samme fraværsværn som i error-contract.md; §12s liste over den slettede legacy-feltvej.',
  },
  // De otte slettede `Styled<type>Field`-komponenter. §12 opremser dem netop for at forbyde deres
  // genkomst; `input/deleted-legacy-architecture-import` håndhæver importstierne, og AST-reglen kan
  // — modsat dette tekstbaserede opslag — skelne kode fra kommentar.
  // Alle otte er slettede. `StyledTextField` medregnes: ordgrænse-opslaget matcher IKKE inde i den
  // bevarede `StyledTextFieldBase`, så navnet er reelt fraværende i levende kode.
  ...(['StyledTextField', 'StyledDateField', 'StyledAmountField', 'StyledIntegerField',
    'StyledPercentField', 'StyledFractionField', 'StyledWeekField', 'StyledYearField'] as const).map(
    (name) => ({
      contract: 'src/contracts/form-contract.md',
      reference: name,
      direction: 'absent' as const,
      note: 'Slettet felt-familie. §12 navngiver den for at forbyde genkomst; erstattet af src/inputCore/react/fields/.',
    })
  ),
  /**
   * De slettede mekanismers navne, som kontrakterne opremser NETOP for at forbyde dem.
   *
   * Listen er den største gruppe undtagelser, og det er forventeligt: en greenfield-omlægning, der
   * river en hel inputmodel ned, efterlader nødvendigvis kontrakter, hvis vigtigste udsagn er «dette
   * findes ikke længere». Hver post håndhæves som en påstand — genopstår navnet i produktionskode,
   * bliver testen rød.
   */
  ...([
    ['blocksSave', 'Forbudt issue-flag: consumerkonsekvensen udledes strukturelt, ikke af en boolean på issuet.'],
    ['blocksProjection', 'Forbudt issue-flag; samme begrundelse som blocksSave.'],
    ['onFieldError', 'Slettet feltfejl-callback. Der findes ingen skrivbar feltfejl-bus.'],
    ['collectPresentFieldErrors', 'Slettet opsamler for feltfejl-bussen.'],
    ['EoInputIssueSource', 'Slettet source-register; §11 forbyder source-dimensionen eksplicit.'],
    ['EoFieldIssuesBySource', 'Slettet source-register; samme forbud.'],
    ['invalidDrafts', 'Slettet draft-model. Greenfield persisterer afvist råtekst som rejectedInputs.'],
    ['draftRows', 'Slettet parallel rækkedraft-model; rækker lever i det ene aggregat.'],
    ['useTableInputCore', 'Slettet legacy tabel-input-hook.'],
    ['useRowDrafts', 'Slettet legacy rækkedraft-hook.'],
    ['useDraftField', 'Slettet legacy feltdraft-hook.'],
    ['useCellInvalidDraftChannel', 'Slettet celle-kanal for ugyldige drafts.'],
    ['fieldAddressVersion', 'Slettet adressebro. Envelopen har ét current-only format uden adresseoversættelse.'],
    ['FormPersistenceContext', 'Slettet broker-context; consumers får InputReader eller godkendte projektioner.'],
    ['SAERLIGT_FERIETILLAEG_SATSTRAPPE', 'Særligt ferietillæg er forbudt i koden; satsdataene blev slettet 2026-07-31.'],
  ] as const).flatMap(([name, note]) =>
    ([
      'src/contracts/error-contract.md',
      'src/contracts/form-contract.md',
      'src/contracts/mineo-field-pattern.md',
      'src/contracts/persistence-contract.md',
      'src/contracts/schema-evolution.md',
      'src/contracts/indskudte-loentillaeg-contract.md',
    ] as const).map((contract) => ({ contract, reference: name, direction: 'absent' as const, note }))
  ),
  {
    contract: 'src/contracts/eo-snapshot-contract.md',
    reference: 'taf_krav_graf_pdf',
    direction: 'absent',
    note: 'Bevidst fravær: grafen deler blokerings-target med taf_per_year_pdf, så et eget target kun ville duplikere gaten. §3.2 forklarer det.',
  },
  {
    contract: 'src/contracts/domain-boundary-contract.md',
    reference: 'faellesPersondata',
    direction: 'absent',
    note: 'Afskaffet sektion. Kontrakten navngiver den i sin egen sætning om, at den ER afskaffet.',
  },
  {
    contract: 'src/contracts/critical-action-contract.md',
    reference: 'useStyledFieldAdapter',
    direction: 'absent',
    note: 'Slettet forgænger. Kontrakten navngiver den, så en læser af ældre commits kan finde efterfølgeren.',
  },
  {
    contract: 'src/contracts/critical-action-contract.md',
    reference: 'useGridRowPersistenceCore',
    direction: 'absent',
    note: 'Slettet forgænger; må ikke forveksles med den aktive useGridCoreController. Navngivet netop for at afværge den forveksling.',
  },
  // §12s opremsning af `legacy/forbidden-identifier`-navnene. Hvert navn ER selve forbuddet.
  ...(['executeLegacyInputTransaction', 'useDraftLifecycle', 'legacyGridTransactionBridge',
    'useSliceRowDrafts', 'InputWriteAuthority', 'claimInputWriteAuthority', 'usePersistedForm',
    'useDraftField', 'useStyledFieldAdapter', 'inputRuntimeStore', 'formPersistenceStore',
    'FormPersistenceContext'] as const).map((name) => ({
    contract: 'src/contracts/form-contract.md',
    reference: name,
    direction: 'absent' as const,
    note: 'Slettet legacy-mekanisme. §12 navngiver den for at forbyde genkomst; håndhævet af legacy/forbidden-identifier eller input/deleted-legacy-architecture-import.',
  })),
  {
    contract: 'src/contracts/form-contract.md',
    reference: 'src/hooks/tableInput',
    direction: 'absent',
    note: 'Slettet legacy-mappe. Står på DELETED_LEGACY_INPUT_MODULE_PATHS og må ikke genopstå som importsti.',
  },
  {
    contract: 'src/contracts/form-contract.md',
    reference: 'src/rowDrafts/',
    direction: 'absent',
    note: 'Slettet legacy-mappe (rækkedrafts). Står på DELETED_LEGACY_INPUT_MODULE_PATHS og må ikke genopstå.',
  },
  {
    contract: 'src/contracts/page-component-contract.md',
    reference: 'xxxContext.ts',
    direction: 'absent',
    note: 'Navnemønster, ikke en fil: `xxx` er pladsholderen for sidens navn (stamdataContext.ts osv.).',
  },
  ...(['src/contracts/schema-evolution.md', 'src/contracts/page-component-contract.md'] as const).map(
    (contract) => ({
      contract,
      reference: 'useXxxViewModel',
      direction: 'absent' as const,
      note: 'Navnemønster, ikke et symbol: `Xxx` er pladsholderen for sidens navn (useAarsloenViewModel osv.).',
    })
  ),
  {
    contract: 'src/contracts/page-component-contract.md',
    reference: 'XxxVmProvider',
    direction: 'absent',
    note: 'Navnemønster, ikke et symbol: `Xxx` er pladsholderen for sidens navn (StamdataVmProvider osv.).',
  },
  {
    contract: 'src/contracts/eo-snapshot-contract.md',
    reference: 'tafBeregningsperiode',
    direction: 'absent',
    note: 'NavngivningsREGEL, ikke et symbol: kontrakten skriver «fx `tafBeregningsperiode`» som eksempel på taf-præfikset.',
  },
  {
    contract: 'src/contracts/renteberegning-contract.md',
    reference: 'InputProjection',
    direction: 'absent',
    note: 'Generisk begreb for en domæneprojektion foran motoren, ikke en navngiven type.',
  },
];

const exceptionKey = (contract: string, reference: string): string => `${contract}::${reference}`;

const EXCEPTION_INDEX = new Map(
  REFERENCE_EXCEPTIONS.map((entry) => [exceptionKey(entry.contract, entry.reference), entry])
);

describe('kontrakternes kodereferencer er levende', () => {
  it('udtrækker referencer fra alle kontrakter — parseren er ikke tom', () => {
    const references = extractReferences();
    // Gulv mod den stilfærdigste fejlmåde: et regex, der holder op med at matche, gør hele værnet
    // vakuøst uden at fejle. Tallene er konservative gulve, ikke et mål.
    expect(references.length).toBeGreaterThan(400);
    expect(new Set(references.map((entry) => entry.contract)).size).toBeGreaterThan(20);
  });

  it('hver navngiven fil og sti i en kontrakt findes i repoet', () => {
    const failures: string[] = [];
    for (const entry of extractReferences()) {
      if (!isPathLike(entry.reference)) continue;
      const exception = EXCEPTION_INDEX.get(exceptionKey(entry.contract, entry.reference));
      if (exception !== undefined) continue;
      if (pathReferenceExists(entry.reference) || sourceBasenames().has(entry.reference)) continue;
      failures.push(
        `${entry.contract}:${entry.line} navngiver "${entry.reference}", som ikke findes. `
          + 'Er filen omdøbt, ret kontrakten; er den bevidst slettet, tilføj en `absent`-post i '
          + 'REFERENCE_EXCEPTIONS med begrundelse.'
      );
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('hvert navngivet symbol i en kontrakt findes i kildegrafen', () => {
    const failures: string[] = [];
    for (const entry of extractReferences()) {
      if (isPathLike(entry.reference)) continue;
      const exception = EXCEPTION_INDEX.get(exceptionKey(entry.contract, entry.reference));
      if (exception !== undefined) continue;
      if (symbolReferenceExists(entry.reference)) continue;
      failures.push(
        `${entry.contract}:${entry.line} navngiver symbolet "${entry.reference}", som ikke findes i `
          + 'kildegrafen. Er det omdøbt, ret kontrakten; er det bevidst slettet, tilføj en '
          + '`absent`-post i REFERENCE_EXCEPTIONS med begrundelse.'
      );
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  /**
   * `absent` er en PÅSTAND, ikke en undertrykkelse. Uden denne test ville et fraværsværn være en
   * bekvem måde at tie en reel drift ihjel på — og en genopstået `documentService.ts` ville passere
   * ubemærket, selv om kontrakten udtrykkeligt forbyder den.
   */
  it('hvert fraværsværn holder — det navngivne er faktisk væk', () => {
    const failures: string[] = [];
    for (const entry of REFERENCE_EXCEPTIONS) {
      if (entry.direction !== 'absent') continue;
      if (referenceHolds(entry)) continue;
      failures.push(
        `${entry.contract}: "${entry.reference}" er erklæret som fraværsværn, men findes nu i koden. `
          + `Begrundelse i registret: ${entry.note ?? '(ingen)'} — enten er en forbudt konstruktion `
          + 'genopstået, eller også er værnet forældet og skal fjernes bevidst.'
      );
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('hver undtagelse peger på en kontrakt, der findes, og har en begrundelse', () => {
    const contracts = new Set(contractFiles());
    for (const entry of REFERENCE_EXCEPTIONS) {
      expect(contracts.has(entry.contract), `ukendt kontrakt i undtagelse: ${entry.contract}`).toBe(true);
      expect(
        (entry.note ?? '').length,
        `undtagelsen ${entry.contract}::${entry.reference} mangler begrundelse`
      ).toBeGreaterThan(20);
    }
  });

  /**
   * Ingen døde undtagelser. En undtagelse, hvis reference ikke længere STÅR i kontrakten, er en post,
   * der beskytter ingenting — og som ved næste omdøbning ville dække over et reelt fund.
   */
  it('hver undtaget reference står stadig i mindst én kontrakt', () => {
    // Kontrolleres pr. REFERENCE og ikke pr. (kontrakt, reference): flere kontrakter opremser med
    // vilje de samme slettede navne, og undtagelserne dækker derfor et krydsprodukt. Det, der skal
    // fanges, er en reference, INGEN kontrakt længere nævner — da beskytter posten ingenting og ville
    // ved næste omdøbning skjule et reelt fund.
    const present = new Set(extractReferences().map((entry) => entry.reference));
    for (const reference of new Set(REFERENCE_EXCEPTIONS.map((entry) => entry.reference))) {
      expect(
        present.has(reference),
        `død undtagelse: "${reference}" står ikke længere i nogen kontrakt — fjern posten`
      ).toBe(true);
    }
  });
});

/**
 * Prædikaterne skal kunne SVARE BEGGE VEJE. Et opslag, der altid svarer «findes», ville gøre hele
 * værnet grønt uden at kontrollere noget — præcis den vakuøse form, `acceptanceMatrix.test.ts` afviste.
 */
describe('kontrakt-reference-prædikaterne er ikke vakuøse', () => {
  it('skelner en eksisterende sti fra en opdigtet', () => {
    expect(pathReferenceExists('src/contracts/contract-topology.json')).toBe(true);
    expect(pathReferenceExists('src/dette/findes/beviseligt/ikke.ts')).toBe(false);
  });

  it('slår modulspecifikationer uden endelse op, som en import ville', () => {
    // `src/types/fieldEvents` findes kun som `.ts`; uden endelsesopslaget ville et helt legitimt
    // referenceformat blive rapporteret som dødt.
    expect(pathReferenceExists('src/types/fieldEvents')).toBe(true);
    expect(pathReferenceExists('src/types/fieldEvents.ts')).toBe(true);
  });

  it('skelner et levende symbol fra et slettet', () => {
    expect(symbolReferenceExists('computeEoSnapshot')).toBe(true);
    expect(symbolReferenceExists('SettledFieldView')).toBe(true);
    // Den faktiske drift, værnet blev bygget efter: det gamle navn findes ikke.
    expect(symbolReferenceExists('SettledFieldState')).toBe(false);
    expect(symbolReferenceExists('detteSymbolFindesBevisligtIkke')).toBe(false);
  });

  it('matcher symboler på HELE ord, så et delnavn ikke kan bekræfte et forkert navn', () => {
    // `satserSchema` er en ægte delstreng af `satserSchemas` — netop den forveksling, der lod
    // `satser-contract.md` skrive filnavnet forkert. Ordgrænsen er derfor load-bearing.
    expect(sourceBasenames().has('satserSchemas.ts')).toBe(true);
    expect(sourceBasenames().has('satserSchema.ts')).toBe(false);
  });

  it('skelner sti-lignende referencer fra symbolnavne', () => {
    expect(isPathLike('src/document/model/documentModel.ts')).toBe(true);
    expect(isPathLike('documentModel.ts')).toBe(true);
    expect(isPathLike('DocumentComposer')).toBe(false);
  });
});
