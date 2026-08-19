/**
 * `schema-evolution.md` §2.2 er en håndholdt tabel over de persisterede sagssektioner: én række pr.
 * sektion med schema, initial values, primær page og undermappe. Kontrakten skrev om sig selv, at den
 * «skal holdes i sync med registry» – en påstand uden mekanisme, altså præcis den fejlklasse, repoet
 * ellers har lært at lukke: to steder der skal være enige, uden noget der holder dem det.
 *
 * **Hvorfor de eksisterende værn ikke dækker det.** `contractReferenceLiveness.test.ts` læser hver linje
 * i hver kontrakt og kræver, at navngivne stier findes – så tabellens FIRE stikolonner er allerede
 * dækket mod en omdøbt fil. Men den udtrækker referencer som et fladt sæt pr. linje og kender hverken
 * rækker, kolonner eller sektionsnøgler; nøglecellerne (`erstatningsopgoerelse`, `varigemen`, …) er
 * desuden rent små bogstaver og udelades bevidst af dens symbolmønster. Ingen af delene kan derfor se,
 * at der MANGLER en række – og en manglende række er netop den farlige retning: et nyt persisted felt
 * i en sektion, kontrakten ikke nævner, gennemgås ikke mod §2.1's tjekliste.
 *
 * **Hvorfor det ikke er grønt af tomhed.** Testen sammenligner to uafhængige kilder: markdown-tabellen,
 * som et menneske skriver, og `PERSISTED_SECTION_KEYS`, som er afledt af `persistenceSchemas`. Det er
 * samme præcedens som `persistenceRegistry.test.ts`, der bevidst skriver den forventede nøglemængde ud
 * i hånden frem for at sammenligne registret med sig selv. Parseren kontrolleres desuden mod et
 * gulv: finder den ingen rækker, er tabellen omskrevet til en form, mønsteret ikke længere ser, og
 * sammenligningen ville ellers lykkes vakuøst mod et tomt sæt.
 *
 * **Hvad testen IKKE påstår.** Den kontrollerer nøgleMÆNGDEN, ikke parringen. Byttes to rækkers
 * schema-celler om, forbliver den grøn – parringen kan ikke udledes maskinelt, fordi registret kun
 * bærer schema-SYMBOLET (via barrel-eksporten), og fordi hverken initial values, page eller undermappe
 * kan afledes af nøglen: `varigemen` → `varigeMenSchemas.ts` (versalt M), `erstatningsopgoerelse` →
 * `persistedErstatningsopgoerelseSchema` (præfiks) og `faellesAarsloen` →
 * `src/domain/aslEalAarsloen/…` (mappenavn uden fælles led) bryder hver sin nærliggende konvention.
 * Kontrakten skriver selv, at parringen er et læseansvar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PERSISTED_SECTION_KEYS } from '../../config/persistenceRegistry';

const CONTRACT_PATH = 'src/contracts/schema-evolution.md';

/**
 * En tabelrække i §2.2 begynder med sektionsnøglen i backticks som første celle:
 * `| \`aarsloen\` | … |`. Ankret til linjestart, så en nøgle nævnt midt i brødteksten ikke tælles
 * som en række.
 */
const TABLE_ROW_KEY_PATTERN = /^\|\s*`([A-Za-z][A-Za-z0-9_]*)`\s*\|/;

/**
 * §2.2's tabel er ikke filens eneste tabel – Del 5 har en referencetabel over felttyper. Rækkerne
 * læses derfor kun inden for §2.2's egen overskrift og frem til næste overskrift på samme niveau.
 */
const readDomainTableKeys = (): readonly string[] => {
  const lines = fs
    .readFileSync(path.resolve(process.cwd(), CONTRACT_PATH), 'utf8')
    .split(/\r?\n/);

  const start = lines.findIndex((line) => /^###\s+2\.2\s/.test(line));
  expect(
    start,
    `${CONTRACT_PATH}: fandt ikke §2.2-overskriften – er afsnittet omdøbt eller fjernet?`
  ).toBeGreaterThanOrEqual(0);

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{2,3}\s/.test(line));
  const section = end < 0 ? rest : rest.slice(0, end);

  return section
    .map((line) => TABLE_ROW_KEY_PATTERN.exec(line)?.[1])
    .filter((key): key is string => key !== undefined);
};

describe('schema-evolution §2.2 dækker registrets sektioner', () => {
  it('tabellens nøgler er præcis de persisterede sektionsnøgler', () => {
    const tableKeys = readDomainTableKeys();

    // Værn mod grøn-af-tomhed: en omskrevet tabel, parseren ikke længere ser, ville ellers
    // sammenlignes som to tomme mængder og lykkes.
    //
    // Gulvet er BEVIDST 1 og ikke antallet af sektioner: et gulv på sektionsantallet ville fange en
    // slettet række først – med en besked om, at parseren er i stykker. Det er den forkerte diagnose
    // af den mest sandsynlige fejl. Her måler gulvet kun «ser parseren overhovedet en tabel», og den
    // egentlige uenighed rapporteres af sammenligningen nedenfor, som kan navngive nøglen.
    expect(
      tableKeys.length,
      `${CONTRACT_PATH} §2.2: parseren fandt ingen tabelrækker. Tabellen er omskrevet til en form, `
        + 'mønsteret ikke genkender – ret parseren, ellers holder værnet op med at måle noget.'
    ).toBeGreaterThanOrEqual(1);

    expect(
      [...tableKeys].sort(),
      `${CONTRACT_PATH} §2.2 og persistenceRegistry er uenige om, hvilke sagssektioner der findes. `
        + 'En sektion uden række gennemgås ikke mod §2.1-tjeklisten, når den får et nyt felt; en række '
        + 'uden sektion sender arbejdet mod et domæne, der ikke persisteres. Ret tabellen ELLER registret '
        + '– de må ikke stå uenige.'
    ).toEqual([...PERSISTED_SECTION_KEYS].sort());
  });

  it('hver tabelrække nævner nøglen præcis én gang', () => {
    const tableKeys = readDomainTableKeys();

    expect(
      new Set(tableKeys).size,
      `${CONTRACT_PATH} §2.2: samme sektionsnøgle står i to rækker. To rækker om samme sektion kan `
        + 'drive fra hinanden og give hvert sit svar på, hvor feltet hører hjemme.'
    ).toBe(tableKeys.length);
  });
});
