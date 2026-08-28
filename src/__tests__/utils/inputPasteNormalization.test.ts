import {
  normalizeClipboardText,
  normalizeAmountPaste,
  normalizeDatePaste,
  normalizeFractionPaste,
  normalizeIntegerPaste,
  normalizePercentPaste,
  normalizeWeekPaste,
  normalizeYearPaste,
} from '../../utils/inputPasteNormalization';
import { yearAdmission } from '../../components/inputs/draftAdmission';
import { spliceDraftWithPaste } from '../../inputCore/react/pasteSplice';

describe('inputPasteNormalization', () => {
  it('normaliserer clipboard-tekst på tværs af whitespace-varianter uden at trimme', () => {
    expect(normalizeClipboardText('  A\r\n\u00a0B\t\u200b  C\uFEFF\u00AD ')).toBe(' A B C ');
  });

  it('bevarer linjeskift i flerlinjet tekst, men kollapser gentagne mellemrum', () => {
    expect(normalizeClipboardText('A\r\n\u202f\tB\rC', { preservesLineBreaks: true })).toBe('A\n B\nC');
    expect(normalizeClipboardText('A\r\nB')).toBe('A B');
  });

  it('normaliserer dato efter cifferlængde og fortsætter gennem ugyldige tegn', () => {
    expect(normalizeDatePaste('adffergregs//sgd1712,56//')).toBe('17-12-56');
    expect(normalizeDatePaste('a1b2c1999')).toBe('1-2-1999');
    expect(normalizeDatePaste('17121956')).toBe('17-12-1956');
    expect(normalizeDatePaste('01012024')).toBe('01-01-2024');
  });

  it('håndhæver kun cifferlængde, springer gentagne separatorer over og fortsætter', () => {
    expect(normalizeDatePaste('32122020')).toBe('32-12-2020');
    expect(normalizeDatePaste('17132020')).toBe('17-13-2020');
    expect(normalizeDatePaste('00122020')).toBe('00-12-2020');
    expect(normalizeDatePaste('3112202')).toBe('31-12-202');
    expect(normalizeDatePaste('12-345-2020')).toBe('12-34-2020');
    expect(normalizeDatePaste('---12--2----------2026')).toBe('12-2-2026');
  });

  it('springer ugyldige heltalstegn over uden at fortolke separatorer', () => {
    expect(normalizeIntegerPaste('adffergregs//sgd1712,56//', { maxDigits: 4 })).toBe('1712');
    expect(normalizeIntegerPaste('12,99')).toBe('1299');
    expect(normalizeIntegerPaste('-12.99', { allowNegative: true })).toBe('-1299');
    expect(normalizeIntegerPaste('ab1712cd', { maxDigits: 3 })).toBe('171');
    expect(normalizeIntegerPaste('12 34')).toBe('1234');
  });

  it('lader talværdi-grænser gå videre til canonical validering', () => {
    expect(normalizeIntegerPaste('9999', { maxValue: 100 })).toBe('9999');
    expect(normalizeIntegerPaste('-9999', { allowNegative: true, minValue: -100 })).toBe('-9999');
  });

  it('bevarer beløbsudtryk, men fortolker aldrig tegn som formattering', () => {
    expect(normalizeAmountPaste('abc12,')).toBe('12,');
    expect(normalizeAmountPaste('foo 100+25')).toBe('100+25');
    expect(normalizeAmountPaste('2X3')).toBe('23');
    expect(normalizeAmountPaste('12,987', { maxDecimalDigits: 2 })).toBe('12,98');
    expect(normalizeAmountPaste('foo - 100,25 bar', { allowNegative: true })).toBe('-100,25');
    expect(normalizeAmountPaste('12.5')).toBe('125');
    expect(normalizeAmountPaste('12 5')).toBe('125');
  });

  it('lader syntaktiske fejl og talværdi-grænser stå til settle', () => {
    expect(normalizeAmountPaste('12345,67', { maxIntegerDigits: 3 })).toBe('123,67');
    expect(normalizeAmountPaste('100+25', { maxValue: 100 })).toBe('100+25');
  });

  /**
   * BB-118: decimalkommaet må ALDRIG springes over.
   *
   * Assertionen her pinnede tidligere selve fejlen (`'123,99'` → `'12399'`). Reglen «spring det ulovlige
   * tegn over» er rigtig for et bogstav, men forkert for det tegn, der ADSKILLER de to dele af et tal: de
   * to decimalcifre gled op i heltalsdelen, og `400.000,00` – et beløb, som det står skrevet på dansk –
   * blev til `4.000.000` uden et ord. Et decimalløst felt tager nu imod decimalen og afrunder den ved
   * settle, så draften bevarer det, brugeren skrev.
   */
  it('bevarer decimalkommaet også i et felt uden decimaler (BB-118)', () => {
    expect(normalizeAmountPaste('123,99', { allowDecimals: false })).toBe('123,99');
    expect(normalizeAmountPaste('400.000,00', { allowDecimals: false })).toBe('400000,00');
    expect(normalizeAmountPaste('400.000 kr.', { allowDecimals: false })).toBe('400000');
  });

  it('håndhæver beløbets ciffergrænse separat for hvert talled', () => {
    expect(normalizeAmountPaste('99999999+2')).toBe('9999999+2');
    expect(normalizeAmountPaste('1+99999999+3')).toBe('1+9999999+3');
    expect(normalizeAmountPaste('9999999,999+2,999')).toBe('9999999,99+2,99');
  });

  it('filtrerer procent tegn for tegn uden formatteringsfortolkning', () => {
    expect(normalizePercentPaste('abc1007', { maxValue: 100 })).toBe('100');
    expect(normalizePercentPaste('abc999', { maxValue: 8 })).toBe('999');
    expect(normalizePercentPaste('12,987', { allowDecimals: true, maxDecimalDigits: 2 })).toBe('12,98');
    // BB-118: også et decimalløst procentfelt bevarer kommaet – «15,00 %» blev før til `1500`.
    expect(normalizePercentPaste('12,987', { allowDecimals: false, maxDecimalDigits: 2 })).toBe('12,98');
    expect(normalizePercentPaste('-999', { allowNegative: true, minValue: -100 })).toBe('-999');
    expect(normalizePercentPaste('12.5', { allowDecimals: true })).toBe('125');
    expect(normalizePercentPaste('12 5', { allowDecimals: true })).toBe('125');
  });

  it('bevarer brøkens formatfejl, når de består af tilladte tegn', () => {
    expect(normalizeFractionPaste('foo12,5/bar8,25baz')).toBe('12,5/8,25');
    expect(normalizeFractionPaste('foo12,5bar')).toBe('12,5');
    expect(normalizeFractionPaste('12345,678/98765,432', { maxDigits: 3 }))
      .toBe('123,678/987,432');
    expect(normalizeFractionPaste('123,9/987,8', { maxDigits: 3, requireIntegerFraction: true }))
      .toBe('123/987');
    expect(normalizeFractionPaste('1,/2')).toBe('1,/2');
    expect(normalizeFractionPaste('1./2')).toBe('1/2');
  });

  // ─── Uge og år: paste = tastning, tegn for tegn (§1.2a) ─────────────────────────────────────────
  //
  // Begge familier havde indtil 2026-08-18 hver sin paste-ONLY fortolker: «find den første ciffergruppe,
  // og forkort den, indtil resultatet ligger inden for årsgrænserne». Testene nedenfor pinnede den
  // adfærd og er skrevet om sammen med den. Se `TVAERGAAENDE.md` M-14 og brugerfundet BB-031.

  it('uge-paste behandler tegnene som tastning og bevarer separatoren til settle', () => {
    // Ulovlige tegn springes, og resten fortsætter – også når de står FØR tallet.
    expect(normalizeWeekPaste('uge 23/2025')).toBe('23/2025');
    // Enhver lovlig separator bevares som den er; settle normaliserer den til `/`.
    expect(normalizeWeekPaste('23,2025')).toBe('23,2025');
    expect(normalizeWeekPaste('23.2025')).toBe('23.2025');
    expect(normalizeWeekPaste('17-12')).toBe('17-12');
    // Mellemrum er IKKE en separator (udviklerbeslutning 2026-08-18) og springes som ethvert andet
    // ulovligt tegn. Cifrene løber derfor sammen og afvises ved settle – samme udfald som tastning.
    expect(normalizeWeekPaste('23 2025')).toBe('23');
    // Et tredje ugeciffer uden separator er ulovligt og springes; det afbryder ikke resten, men de
    // følgende cifre kan så heller ikke optages. Resultatet er de to første cifre.
    expect(normalizeWeekPaste('abc532035')).toBe('53');
    // Længdeloftet håndhæves undervejs, ikke ved at forkorte bagefter.
    expect(normalizeWeekPaste('abc53/2025', { maxDraftLength: 6 })).toBe('53/202');
  });

  it('uge-paste kan efterlade en draft, settle afviser – frem for at omtolke den', () => {
    // `//` foran tallet gør det FØRSTE `/` til separator i en draft uden ugenummer; resten af cifrene
    // lander derfor i årssegmentet. Draften `/1712` afvises ved settle («Ugyldigt format»), og det er
    // det rigtige udfald: tastning af de samme tegn giver præcis samme draft. Den gamle fortolker gav
    // her `17/12` – en pæn værdi, brugeren aldrig havde kunnet taste sig frem til.
    expect(normalizeWeekPaste('adffergregs//sgd1712,56//')).toBe('/1712');
  });

  it('uge-paste forkorter IKKE et årstal for at få det inden for årsgrænserne', () => {
    // Den gamle fortolker gav '53/20' her: årsgrænsen forkortede 2035 til 20 → 2020. Årsgrænser er
    // bounds og ejes af feltvalidatoren (§1.6) – de må ikke ændre den indsatte tekst. Med separator
    // bevares året nu uændret, så feltet kan markere det rødt.
    expect(normalizeWeekPaste('abc53/2035', { maxYear: 2030, twoDigitYearPolicy: 'infer' }))
      .toBe('53/2035');
  });

  it('års-paste behandler tegnene som tastning: cifre optages, alt andet springes', () => {
    expect(normalizeYearPaste('adffergregs//sgd1712,56//')).toBe('1712');
    expect(normalizeYearPaste('Satsår 2026 (gældende)')).toBe('2026');
    // Cifre samles på tværs af separatorer, præcis som når brugeren taster dem selv. Det er derfor
    // `2.026` bliver `2026` – brugerens eget arbejdseksempel for reglen.
    expect(normalizeYearPaste('2.026')).toBe('2026');
    // Fire cifre er loftet; resten springes uden at afbryde.
    expect(normalizeYearPaste('99999')).toBe('9999');
    expect(normalizeYearPaste('abc56def2020')).toBe('5620');
    // En dato indsat i et ÅRSfelt giver de fire første cifre – ikke et årstal fisket ud af teksten.
    // Det er tilsigtet: en «find årstallet»-regel ville være en ny fortolkningsvej ved siden af
    // tastning, og netop to konkurrerende veje var fejlen.
    expect(normalizeYearPaste('01-02-2026')).toBe('0102');
  });

  it('års-paste forkorter IKKE et årstal for at få det inden for årsgrænserne', () => {
    // Begge gav før noget andet: 'infer' forkortede til '20' (→ 2020), 'reject' gav ''. Nu bevares
    // teksten, så settle kan afvise den eller markere den rødt (§1.2a punkt 5).
    expect(normalizeYearPaste('2035', { maxYear: 2030, twoDigitYearPolicy: 'infer' })).toBe('2035');
    expect(normalizeYearPaste('2035', { maxYear: 2030, twoDigitYearPolicy: 'reject' })).toBe('2035');
  });

  it('samme indsatte tekst giver samme resultat i et tomt og i et udfyldt felt', () => {
    // Kernen i BB-031. `normalizePasteForDraft` kalder KUN codecets normalisering, når draften er tom;
    // et udfyldt felt får splice-vejens tegn-for-tegn-filter. Så længe de to læser samme prædikat, er
    // resultatet ens – og det er præcis den lighed, denne test er sat til at bevogte.
    const cases = ['2.026', '01-02-2026', 'Skadedato 15-03-2019', '2026\n2025', '99999', '2035', '20'];
    for (const text of cases) {
      const intoEmptyField = normalizeYearPaste(text, { twoDigitYearPolicy: 'infer' });
      const intoFilledField = spliceDraftWithPaste('2015', text, 0, 4, 4, yearAdmission()).draft;
      expect(intoFilledField, `paste af ${JSON.stringify(text)}`).toBe(intoEmptyField);
    }
  });
});
