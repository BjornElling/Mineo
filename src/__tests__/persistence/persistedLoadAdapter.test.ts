import {
  adaptPersistedFileDataForLoad,
  adaptPersistedSectionForLoad,
} from '../../persistence/persistedLoadAdapter';

describe('persistedLoadAdapter', () => {
  it('bruger samme godkendte tavse undtagelse før filoptælling og ved sektionsload', () => {
    const source = {
      stamdata: { journalnr: 'J-1' },
      erstatningsopgoerelse: {
        opsagtFraStilling: 'Ja',
        sfggSygeperioderFoer2015: [{ id: 'historisk' }],
        beholdtFelt: 'bevares',
      },
    };

    const fileData = adaptPersistedFileDataForLoad(source);
    const section = adaptPersistedSectionForLoad(
      'erstatningsopgoerelse',
      source.erstatningsopgoerelse,
      '3.12'
    );

    expect(fileData).toEqual({
      stamdata: { journalnr: 'J-1' },
      erstatningsopgoerelse: { beholdtFelt: 'bevares' },
    });
    expect(section.value).toEqual(fileData.erstatningsopgoerelse);
    expect(source.erstatningsopgoerelse).toHaveProperty('opsagtFraStilling', 'Ja');
  });

  it('lader fremmede felter urørte, så den almindelige preflight fortsat kan rapportere dem', () => {
    const adapted = adaptPersistedFileDataForLoad({
      fremmedSektion: { værdi: true },
      erstatningsopgoerelse: { ukendtFelt: 'skal rapporteres' },
    });

    expect(adapted).toEqual({
      fremmedSektion: { værdi: true },
      erstatningsopgoerelse: { ukendtFelt: 'skal rapporteres' },
    });
  });
});
