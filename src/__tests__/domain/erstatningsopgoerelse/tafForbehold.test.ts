import {
  EET_KLAGE_FORBEHOLD_LINJE,
  resolveTafYdelsesforbeholdLinje,
  TAF_FORBEHOLD_YDELSESTYPER,
} from '../../../domain/erstatningsopgoerelse/helpers/tafForbehold';

describe('tafForbehold', () => {
  it('har den faste EET-klageforbeholdstekst og de to ydelsestyper', () => {
    expect(EET_KLAGE_FORBEHOLD_LINJE).toContain('verserende klagesag');
    expect([...TAF_FORBEHOLD_YDELSESTYPER]).toEqual([
      'kontanthjaelp',
      'ressourceforloebsydelse',
    ]);
  });

  it.each([
    [[], null],
    [['kontanthjaelp'], 'Skadelidte har modtaget kontanthjælp i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'],
    [['ressourceforloebsydelse'], 'Skadelidte har modtaget ressourceforløbsydelse i erstatningsperioden. Kræves ydelsen tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'],
    [['kontanthjaelp', 'ressourceforloebsydelse'], 'Skadelidte har modtaget kontanthjælp og ressourceforløbsydelse i erstatningsperioden. Kræves ydelserne tilbagebetalt som følge af erstatningsudbetaling, vil kravet blive forhøjet.'],
  ] as const)('resolverer %s korrekt', (ydelser, expected) => {
    expect(resolveTafYdelsesforbeholdLinje(ydelser)).toBe(expected);
  });
});
