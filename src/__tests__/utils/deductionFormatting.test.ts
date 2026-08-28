import {
  formatDeduction,
  formatDeductionKr,
  formatDeductionPercent,
} from '../../utils/deductionFormatting';

/**
 * BB-129/BB-130: et fortegn påstår en retning, og et nul har ingen. Fradragslinjerne satte minusset som en
 * fast del af skabelonen, så «Kapitalbeløb (efter ASL) - 0 kr.» stod på samme skærm som «Kapitalbeløb
 * 0 kr.» for samme værdi.
 */
describe('deductionFormatting', () => {
  describe('formatDeductionKr', () => {
    it('sætter minus foran et beløb, der faktisk trækkes fra', () => {
      expect(formatDeductionKr(421731)).toBe('- 421.731 kr.');
    });

    it('viser nul uden fortegn', () => {
      expect(formatDeductionKr(0)).toBe('0 kr.');
    });

    /**
     * Vagten skal måle det, brugeren FÅR AT SE. En test på råværdien (`=== 0`) ville lade en værdi, der
     * afrundes til nul, få et minus foran et synligt nul – præcis den fejl, reglen skal forhindre.
     */
    it('viser en værdi, der AFRUNDES til nul, uden fortegn', () => {
      expect(formatDeductionKr(0.004)).toBe('0 kr.');
      expect(formatDeductionKr(0.4)).toBe('0 kr.');
    });

    it('respekterer kalderens præcision i både visning og vagt', () => {
      expect(formatDeductionKr(0.004, 2)).toBe('0,00 kr.');
      expect(formatDeductionKr(0.02, 2)).toBe('- 0,02 kr.');
    });
  });

  /**
   * `formatDeduction` findes for de linjer, der formaterer selv (fx trimmet valuta med hårdt mellemrum).
   * Målte vagten altid mod sin egen formatter, kunne dokumentet skrive «- 0 kr.», hvor skærmen skriver
   * «0 kr.» – BB-130's selvmodsigelse flyttet ét lag ned.
   */
  describe('formatDeduction', () => {
    it('bruger kalderens egen formatering, men programmets fortegnsregel', () => {
      expect(formatDeduction(1234, '1.234 kr.')).toBe('- 1.234 kr.');
      expect(formatDeduction(0, '0 kr.')).toBe('0 kr.');
    });
  });

  describe('formatDeductionPercent', () => {
    it('sætter kun fortegn på en reduktion forskellig fra nul', () => {
      expect(formatDeductionPercent(16, '16 %')).toBe('- 16 %');
      expect(formatDeductionPercent(0, '0 %')).toBe('0 %');
    });
  });
});
