import {
  APP_ROUTES,
  getRouteForPageKey,
  routeToPageId,
  PAGE_DEFAULT_TAB,
  type AppRoute,
} from '../../config/pageNavigation';
import { PERSISTED_SECTION_KEYS, type PersistedSectionKey } from '../../config/persistenceRegistry';

describe('pageNavigation — kanonisk route/fane-kilde', () => {
  describe('APP_ROUTES', () => {
    it('navngiver hver route som "/<pageKey>" (ingen afvigende stier)', () => {
      for (const [pageKey, route] of Object.entries(APP_ROUTES)) {
        expect(route).toBe(`/${pageKey}`);
      }
    });

    it('dækker præcis de routebærende pageKeys (alle StorageKeys undtagen faellesAarsloen)', () => {
      // Completeness-guard: tilføjes en ny side (PersistedSectionKey) uden en APP_ROUTES-entry, fanger
      // denne test det. faellesAarsloen er bevidst undtaget (delt sektion uden egen route).
      const allPageKeys = PERSISTED_SECTION_KEYS;
      const expectedRouted = allPageKeys.filter((key) => key !== 'faellesAarsloen').sort();
      const actualRouted = Object.keys(APP_ROUTES).sort();
      expect(actualRouted).toEqual(expectedRouted);
    });
  });

  describe('getRouteForPageKey', () => {
    it('returnerer den faste route for sider med egen route', () => {
      expect(getRouteForPageKey('stamdata')).toBe('/stamdata');
      expect(getRouteForPageKey('erstatningsopgoerelse')).toBe('/erstatningsopgoerelse');
      expect(getRouteForPageKey('erhvervsevnetab')).toBe('/erhvervsevnetab');
      expect(getRouteForPageKey('satser')).toBe('/satser');
      expect(getRouteForPageKey('renteberegning')).toBe('/renteberegning');
      expect(getRouteForPageKey('varigemen')).toBe('/varigemen');
      expect(getRouteForPageKey('forsoergertab')).toBe('/forsoergertab');
      expect(getRouteForPageKey('aarsloen')).toBe('/aarsloen');
    });

    it('returnerer null for faellesAarsloen (delt sektion uden egen route)', () => {
      expect(getRouteForPageKey('faellesAarsloen')).toBeNull();
    });
  });

  describe('routeToPageId', () => {
    it('stripper ledende skråstreg', () => {
      expect(routeToPageId('/erstatningsopgoerelse')).toBe('erstatningsopgoerelse');
      expect(routeToPageId('/satser')).toBe('satser');
    });

    it('falder tilbage til stamdata for root/tom route', () => {
      expect(routeToPageId('/')).toBe('stamdata');
      expect(routeToPageId('')).toBe('stamdata');
      expect(routeToPageId('///')).toBe('stamdata');
    });

    it('er invers af getRouteForPageKey for alle routebærende sider (round-trip)', () => {
      const routedPageKeys: PersistedSectionKey[] = [
        'stamdata',
        'erstatningsopgoerelse',
        'erhvervsevnetab',
        'satser',
        'renteberegning',
        'varigemen',
        'forsoergertab',
        'aarsloen',
      ];
      for (const pageKey of routedPageKeys) {
        const route = getRouteForPageKey(pageKey) as AppRoute;
        expect(routeToPageId(route)).toBe(pageKey);
      }
    });
  });

  describe('PAGE_DEFAULT_TAB', () => {
    it('matcher de standard-faner siderne faktisk åbner på', () => {
      // Disse værdier SKAL holdes i sync med defaultTab i de respektive page-komponenter
      // (Erstatningsopgoerelse/Erhvervsevnetab/Renteberegning/VarigeMen). setActiveTabForPage
      // ignorerer stille en ukendt fane-nøgle, så et drift her ville give en tavs no-op.
      expect(PAGE_DEFAULT_TAB.erstatningsopgoerelse).toBe('eo_oplysninger');
      expect(PAGE_DEFAULT_TAB.erhvervsevnetab).toBe('eet-oplysninger');
      expect(PAGE_DEFAULT_TAB.renteberegning).toBe('calculation');
      expect(PAGE_DEFAULT_TAB.varigemen).toBe('menberegning');
    });
  });
});
