import { getNavigationTargetFromRowId } from '../../../domain/debug/eoDebugNavigationMap';

describe('getNavigationTargetFromRowId', () => {
  it('navigerer lønindkomst-rækker til Lønindkomst-fanen og sektionen', () => {
    expect(getNavigationTargetFromRowId('loenindkomst.af-1.loenoplysninger')).toEqual({
      kind: 'erstatningsopgoerelse-tab',
      tabId: 'loenindkomst',
      sectionId: 'loenindkomst',
      tabName: 'Lønindkomst',
      sectionTitle: 'Lønindkomst',
    });
  });

  describe('stamdata-rækker', () => {
    it.each([
      ['stamdata.journalnr', 'Sagsinfo'],
      ['stamdata.advokatSagsbehandler', 'Sagsinfo'],
      ['stamdata.skadelidte', 'Skadelidte'],
      ['stamdata.skadestype', 'Skadelidte'],
      ['stamdata.skadedato', 'Skadelidte'],
    ])('mapper %s til Stamdata-siden (%s)', (rowId, sectionTitle) => {
      expect(getNavigationTargetFromRowId(rowId)).toEqual({
        kind: 'stamdata-page',
        pageName: 'Stamdata',
        sectionTitle,
      });
    });
  });

  describe('erstatningsopgørelse-faner og -sektioner', () => {
    it.each([
      [
        'erstatningsopgoerelse.vedroererPeriodeFra',
        { tabId: 'eo_oplysninger', sectionId: undefined, tabName: 'EO oplysninger', sectionTitle: 'Erstatningsopgørelse' },
      ],
      [
        'loenindkomst.af-1.x',
        { tabId: 'loenindkomst', sectionId: 'loenindkomst', tabName: 'Lønindkomst', sectionTitle: 'Lønindkomst' },
      ],
      [
        'offentligeYdelser.row-1',
        { tabId: 'offentlige_ydelser', sectionId: undefined, tabName: 'Offentlige ydelser', sectionTitle: 'Offentlige ydelser' },
      ],
      [
        'forlig.forligsgrad',
        { tabId: 'eo_oplysninger', sectionId: 'forlig', tabName: 'EO oplysninger', sectionTitle: 'Forlig' },
      ],
      [
        'aes.midlertidigtEETAfgorelse',
        { tabId: 'eo_oplysninger', sectionId: 'aes', tabName: 'EO oplysninger', sectionTitle: 'AES-afgørelser' },
      ],
      [
        'sviesmerte.satserAar',
        { tabId: 'eo_oplysninger', sectionId: 'sviesmerte', tabName: 'EO oplysninger', sectionTitle: 'Svie- og smertegodtgørelse' },
      ],
      [
        'taf.beregningsgrundlag.indkomst',
        { tabId: 'eo_oplysninger', sectionId: 'taf-beregningsgrundlag', tabName: 'EO oplysninger', sectionTitle: 'Indtægt før skaden' },
      ],
      [
        'taf.ophoerSkyldes',
        { tabId: 'eo_oplysninger', sectionId: 'taf', tabName: 'EO oplysninger', sectionTitle: 'Tabt arbejdsfortjeneste' },
      ],
      [
        'sfgg.tabel.x.af-1',
        { tabId: 'loenindkomst', sectionId: 'loenindkomst', tabName: 'Lønindkomst', sectionTitle: 'Ansættelsesforhold' },
      ],
      [
        'oevrigekrav.row-1',
        { tabId: 'eo_oplysninger', sectionId: 'oevrige-krav', tabName: 'EO oplysninger', sectionTitle: 'Øvrige erstatningskrav' },
      ],
      [
        'bilagsnumre.x',
        { tabId: 'eo_oplysninger', sectionId: 'bilagsnumre', tabName: 'EO oplysninger', sectionTitle: 'Bilagsnumre' },
      ],
    ])('mapper %s til den rette fane/sektion', (rowId, expected) => {
      expect(getNavigationTargetFromRowId(rowId)).toEqual({
        kind: 'erstatningsopgoerelse-tab',
        ...expected,
      });
    });

    it('mapper saerligekommentarer (eksakt id, ikke prefix)', () => {
      expect(getNavigationTargetFromRowId('saerligekommentarer')).toEqual({
        kind: 'erstatningsopgoerelse-tab',
        tabId: 'eo_oplysninger',
        sectionId: 'saerlige-kommentarer',
        tabName: 'EO oplysninger',
        sectionTitle: 'Eventuelle særlige kommentarer',
      });
    });
  });

  describe('TAF-prefix-ordensafhængighed', () => {
    it('mapper taf.beregningsgrundlag.* til beregningsgrundlag-sektionen (ikke den generelle TAF-sektion)', () => {
      const target = getNavigationTargetFromRowId('taf.beregningsgrundlag.indkomst');
      expect(target.kind).toBe('erstatningsopgoerelse-tab');
      if (target.kind === 'erstatningsopgoerelse-tab') {
        expect(target.sectionId).toBe('taf-beregningsgrundlag');
      }
    });
  });

  describe('midlertidigt EET konsistens-advarsler', () => {
    it('mapper ydelerUdenAfgorelse til AES-sektionen', () => {
      expect(getNavigationTargetFromRowId('midlertidigtEetKonsistens.ydelerUdenAfgorelse')).toEqual({
        kind: 'erstatningsopgoerelse-tab',
        tabId: 'eo_oplysninger',
        sectionId: 'aes',
        tabName: 'EO oplysninger',
        sectionTitle: 'AES-afgørelser',
      });
    });

    it('mapper afgorelseUdenYdelser til Offentlige ydelser-fanen', () => {
      expect(getNavigationTargetFromRowId('midlertidigtEetKonsistens.afgorelseUdenYdelser')).toEqual({
        kind: 'erstatningsopgoerelse-tab',
        tabId: 'offentlige_ydelser',
        tabName: 'Offentlige ydelser',
        sectionTitle: 'Offentlige ydelser',
      });
    });
  });

  describe('ukendte ids', () => {
    it('returnerer unsupported uden at kaste for ukendt id', () => {
      expect(getNavigationTargetFromRowId('helt.ukendt.id')).toEqual({
        kind: 'unsupported',
        displayPath: 'helt.ukendt.id',
        reason: 'Navigation ikke implementeret for helt.ukendt.id',
      });
    });

    it('returnerer unsupported for tom streng', () => {
      const target = getNavigationTargetFromRowId('');
      expect(target.kind).toBe('unsupported');
    });
  });
});
