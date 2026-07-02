/**
 * Tests for Loen Types - Phase 5.1 (rettet)
 */

import { toISODateString } from '../../../types/branded';
import type {
  LoenComponentType,
  LoenComponentSource,
  LoenComponent,
  DailyLoen,
  DailySvieSmerte,
  LoenTimeline,
} from '../../../domain/eoInspektion/eoInspektionLoenTypes';

describe('eoInspektionLoenTypes - Phase 5.1 (Type Definitions)', () => {
  describe('LoenComponentType', () => {
    it('accepterer gyldige component types', () => {
      const types: LoenComponentType[] = [
        'grundloen',
        'feriegodtgorelse',
        'fritvalg',
        'shSo',
        'storeBededag',
        'pension',
      ];

      expect(types.length).toBe(6);
    });
  });

  describe('LoenComponentSource', () => {
    it('accepterer gyldige kilder', () => {
      const sources: LoenComponentSource[] = ['overenskomst', 'manuel', 'regel'];
      expect(sources.length).toBe(3);
    });
  });

  describe('LoenComponent', () => {
    it('kan konstrueres med korrekt struktur', () => {
      const component: LoenComponent = {
        type: 'grundloen',
        amount: 1000,
        source: 'overenskomst',
      };

      expect(component.type).toBe('grundloen');
      expect(component.amount).toBe(1000);
      expect(component.source).toBe('overenskomst');
    });
  });

  describe('DailyLoen', () => {
    it('kan konstrueres med tom komponent-liste', () => {
      const dailyLoen: DailyLoen = {
        iso: toISODateString('2024-01-01') as any,
        components: [],
        dailyTotal: 0,
      };

      expect(dailyLoen.components.length).toBe(0);
      expect(dailyLoen.dailyTotal).toBe(0);
    });
  });

  describe('DailySvieSmerte', () => {
    it('kan konstrueres med korrekt struktur', () => {
      const daily: DailySvieSmerte = {
        iso: toISODateString('2024-01-01') as any,
        niveau: 'Fuld',
        amount: 230,
      };

      expect(daily.niveau).toBe('Fuld');
      expect(daily.amount).toBe(230);
    });
  });

  describe('LoenTimeline', () => {
    it('kan konstrueres med tomme lister', () => {
      const timeline: LoenTimeline = {
        loenDays: [],
        svieSmerteDays: [],
      };

      expect(timeline.loenDays.length).toBe(0);
      expect(timeline.svieSmerteDays.length).toBe(0);
    });
  });
});
