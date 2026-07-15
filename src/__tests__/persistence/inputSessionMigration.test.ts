// @vitest-environment jsdom
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import {
  getInputEnvelopeStorageKey,
  getInvalidDraftsStorageKey,
  getStorageKey,
} from '../../config/storageManifest';
import { INVALID_DRAFTS_ENVELOPE_VERSION } from '../../config/invalidDraftsVersion';
import { parseInputEnvelope, serializeInputEnvelope } from '../../input/inputEnvelope';
import { createFieldAddress, serializeFieldAddress } from '../../input/fieldAddress';
import { loadOrMigrateInputSession } from '../../persistence/inputSessionMigration';
import { createEmptyRuntimeInput } from '../../stores/inputRuntimeStore';

const legacySection = (data: unknown): string => JSON.stringify({
  version: PERSISTED_DATA_VERSION,
  timestamp: 1,
  data,
});

describe('loadOrMigrateInputSession', () => {
  beforeEach(() => sessionStorage.clear());

  it('læser current envelope uden at berøre legacy-nøgler', () => {
    const empty = createEmptyRuntimeInput();
    const input = { ...empty, sections: { ...empty.sections, satser: { aargang: 2025 } } };
    const raw = serializeInputEnvelope(input);
    sessionStorage.setItem(getInputEnvelopeStorageKey(), raw);
    sessionStorage.setItem(getStorageKey('satser'), 'legacy-bevares');

    const result = loadOrMigrateInputSession();

    expect(result.input.sections.satser).toEqual({ aargang: 2025 });
    expect(sessionStorage.getItem(getStorageKey('satser'))).toBe('legacy-bevares');
  });

  it('accepterer en strukturel current-adresse for et migreret top-level felt', () => {
    // Fase-4-keystone: den transitionelle envelope godtager nu strukturelle current-adresser (ikke kun
    // legacy-bro-adresser), så et migreret top-level felts rejected input indlæses uændret.
    const empty = createEmptyRuntimeInput();
    const address = serializeFieldAddress(createFieldAddress({
      section: 'satser',
      path: [],
      field: 'aargang',
    }));
    const rawEnvelope = JSON.parse(serializeInputEnvelope(empty)) as Record<string, unknown>;
    rawEnvelope.input = {
      sections: empty.sections,
      rejectedInputs: { [address]: { raw: '20x' } },
    };
    sessionStorage.setItem(getInputEnvelopeStorageKey(), JSON.stringify(rawEnvelope));

    const result = loadOrMigrateInputSession();

    expect(result.notice?.type).not.toBe('error');
    expect(result.writesBlocked).toBe(false);
    expect(result.input.rejectedInputs[address]).toEqual({ raw: '20x' });
  });

  it('afviser en envelope med en misdannet serialiseret feltadresse', () => {
    // Storage-integritet: en rejected-nøgle, der ikke deserialiserer til en velformet feltadresse,
    // blokerer fortsat writes og efterlader kilden urørt (intet delvist snapshot anvendes).
    const empty = createEmptyRuntimeInput();
    const rawEnvelope = JSON.parse(serializeInputEnvelope(empty)) as Record<string, unknown>;
    rawEnvelope.input = {
      sections: empty.sections,
      rejectedInputs: { 'ikke-en-adresse': { raw: '20x' } },
    };
    sessionStorage.setItem(getInputEnvelopeStorageKey(), JSON.stringify(rawEnvelope));

    const result = loadOrMigrateInputSession();

    expect(result.notice?.type).toBe('error');
    expect(result.writesBlocked).toBe(true);
    expect(result.input.rejectedInputs).toEqual({});
    expect(sessionStorage.getItem(getInputEnvelopeStorageKey())).not.toBeNull();
  });

  it('migrerer sektioner og ugyldigt input før legacy-sletning', () => {
    sessionStorage.setItem(getStorageKey('satser'), legacySection({ aargang: 2024 }));
    sessionStorage.setItem(getInvalidDraftsStorageKey(), JSON.stringify({
      version: INVALID_DRAFTS_ENVELOPE_VERSION,
      data: { satser: { aargang: '20x' } },
    }));

    const result = loadOrMigrateInputSession();

    expect(result.input.sections.satser).toEqual({ aargang: 2024 });
    expect(result.writesBlocked).toBe(false);
    expect(Object.values(result.input.rejectedInputs)).toEqual([{ raw: '20x' }]);
    expect(sessionStorage.getItem(getStorageKey('satser'))).toBeNull();
    expect(sessionStorage.getItem(getInvalidDraftsStorageKey())).toBeNull();
    expect(parseInputEnvelope(sessionStorage.getItem(getInputEnvelopeStorageKey())!).input).toEqual(result.input);
  });

  it('anvender intet delvist snapshot og bevarer alle kilder ved inkompatibel sektion', () => {
    const stamdata = legacySection({ skadelidte: 'Bevar mig' });
    const renteberegning = legacySection({ rentekravRows: 'forkert' });
    sessionStorage.setItem(getStorageKey('stamdata'), stamdata);
    sessionStorage.setItem(getStorageKey('renteberegning'), renteberegning);

    const result = loadOrMigrateInputSession();

    expect(result.notice?.type).toBe('error');
    expect(result.writesBlocked).toBe(true);
    expect(result.input.sections.stamdata).toBeNull();
    expect(sessionStorage.getItem(getStorageKey('stamdata'))).toBe(stamdata);
    expect(sessionStorage.getItem(getStorageKey('renteberegning'))).toBe(renteberegning);
    expect(sessionStorage.getItem(getInputEnvelopeStorageKey())).toBeNull();
  });

  it('fail-closer og bevarer legacy-kilder ved læsefejl på ugyldigt input', () => {
    const invalidKey = getInvalidDraftsStorageKey();
    const raw = JSON.stringify({
      version: INVALID_DRAFTS_ENVELOPE_VERSION,
      data: { satser: { aargang: '20x' } },
    });
    sessionStorage.setItem(invalidKey, raw);
    const prototype = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const originalGet = prototype.getItem;
    const get = vi.spyOn(prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key === invalidKey) throw new Error('læsefejl');
      return originalGet.call(this, key);
    });

    const result = loadOrMigrateInputSession();
    get.mockRestore();

    expect(result.notice?.type).toBe('error');
    expect(result.writesBlocked).toBe(true);
    expect(sessionStorage.getItem(invalidKey)).toBe(raw);
    expect(sessionStorage.getItem(getInputEnvelopeStorageKey())).toBeNull();
  });

  it('ruller envelope og slettede legacy-nøgler tilbage hvis cleanup fejler', () => {
    const satser = legacySection({ aargang: 2026 });
    sessionStorage.setItem(getStorageKey('satser'), satser);
    const prototype = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const originalRemove = prototype.removeItem;
    let removals = 0;
    const remove = vi.spyOn(prototype, 'removeItem').mockImplementation(function (this: Storage, key) {
      removals += 1;
      if (removals === 2) throw new Error('cleanup-fejl');
      return originalRemove.call(this, key);
    });

    const result = loadOrMigrateInputSession();
    remove.mockRestore();

    expect(result.notice?.type).toBe('error');
    expect(result.input.sections.satser).toBeNull();
    expect(sessionStorage.getItem(getStorageKey('satser'))).toBe(satser);
    expect(sessionStorage.getItem(getInputEnvelopeStorageKey())).toBeNull();
  });
});
