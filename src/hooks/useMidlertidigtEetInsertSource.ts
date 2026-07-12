import React from 'react';
import {
  erhvervsevnetabSchema,
  faellesAarsloenSchema,
  stamdataSchema,
} from '../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { formPersistenceStore } from '../stores/formPersistenceStore';
import type { EetImportSource } from '../domain/erhvervsevnetab/eetImportPort';
import type { EetIssue } from '../domain/erhvervsevnetab/eetTypes';
import type { z } from 'zod';
import { getSectionRevisionSnapshot } from '../stores/formPersistenceReadModel';

const subscribeToFormPersistenceStore = formPersistenceStore.subscribe;

const hasIssueAtPath = (issues: readonly z.ZodIssue[], path: readonly (string | number)[]): boolean =>
  issues.some((issue) =>
    issue.path.length === path.length &&
    path.every((segment, index) => issue.path[index] === segment)
  );

const hasIssueUnderPath = (issues: readonly z.ZodIssue[], path: readonly (string | number)[]): boolean =>
  issues.some((issue) =>
    issue.path.length >= path.length &&
    path.every((segment, index) => issue.path[index] === segment)
  );

const hasSectionLevelIssue = (issues: readonly z.ZodIssue[]): boolean =>
  issues.some((issue) => issue.path.length === 0);

const resolveErhvervsevnetabImportSchemaMessage = (issues: readonly z.ZodIssue[]): string => {
  const eetPctInvalid = hasIssueUnderPath(issues, ['aslAfgoerelser'])
    && issues.some((issue) => issue.path[2] === 'eetPct');

  if (eetPctInvalid || hasIssueAtPath(issues, ['ealEetPct'])) {
    return 'EET-procenten er ikke gyldig.';
  }

  if (hasSectionLevelIssue(issues) || hasIssueAtPath(issues, ['aslAfgoerelser'])) {
    return 'Der mangler en afgørelse med EET-procent.';
  }

  return 'Afgørelsen er ikke gyldigt udfyldt.';
};

const resolveFaellesAarsloenImportSchemaMessage = (issues: readonly z.ZodIssue[]): string => {
  if (hasIssueAtPath(issues, ['aslAarsloen'])) {
    return 'Årslønnen er ikke gyldig.';
  }

  if (hasSectionLevelIssue(issues)) {
    return 'Årsløn er ikke indtastet.';
  }

  return 'Årslønnen er ikke gyldigt udfyldt.';
};

let cachedSnapshot:
  | {
      stamdata: ReturnType<typeof formPersistenceStore.getState>['sections']['stamdata'];
      erhvervsevnetab: ReturnType<typeof formPersistenceStore.getState>['sections']['erhvervsevnetab'];
      faellesAarsloen: ReturnType<typeof formPersistenceStore.getState>['sections']['faellesAarsloen'];
      value: EetImportSource;
    }
  | null = null;

const getMidlertidigtEetInsertSourceSnapshot = (): EetImportSource => {
  const sections = formPersistenceStore.getState().sections;
  const stamdata = sections.stamdata;
  const erhvervsevnetab = sections.erhvervsevnetab;
  const faellesAarsloen = sections.faellesAarsloen;

  if (
    cachedSnapshot &&
    cachedSnapshot.stamdata === stamdata &&
    cachedSnapshot.erhvervsevnetab === erhvervsevnetab &&
    cachedSnapshot.faellesAarsloen === faellesAarsloen
  ) {
    return cachedSnapshot.value;
  }

  const parsedErhvervsevnetab = erhvervsevnetabSchema.safeParse(erhvervsevnetab);
  const parsedFaellesAarsloen = faellesAarsloenSchema.safeParse(faellesAarsloen);
  const parsedStamdata = stamdataSchema.safeParse(stamdata);
  const sourceIssues: EetIssue[] = [];
  if (!parsedErhvervsevnetab.success) {
    sourceIssues.push({
      id: 'midlertidigt-eet-source-schema-invalid',
      severity: 'error',
      message: resolveErhvervsevnetabImportSchemaMessage(parsedErhvervsevnetab.error.issues),
    });
  }
  if (!parsedFaellesAarsloen.success) {
    sourceIssues.push({
      id: 'midlertidigt-eet-faelles-aarsloen-schema-invalid',
      severity: 'error',
      message: resolveFaellesAarsloenImportSchemaMessage(parsedFaellesAarsloen.error.issues),
    });
  }
  if (!parsedStamdata.success) {
    sourceIssues.push({
      id: 'midlertidigt-eet-stamdata-schema-invalid',
      severity: 'error',
      message: 'Stamdata kunne ikke valideres og kan derfor ikke importeres som midlertidigt EET.',
    });
  }

  const value: EetImportSource = {
    revision: [
      getSectionRevisionSnapshot('stamdata'),
      getSectionRevisionSnapshot('erhvervsevnetab'),
      getSectionRevisionSnapshot('faellesAarsloen'),
    ].join('-'),
    // Midlertidigt EET import er read-only og bygger på samme committed, schema-sikrede
    // tværsektion-data som EET-siden. Snapshot'et caches på sektionsreferencer, så
    // urelaterede store-opdateringer ikke udløser nye safeParse-kørsler eller rerenders.
    eetValues: {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      ...(parsedErhvervsevnetab.success ? parsedErhvervsevnetab.data : ERHVERVSEVNETAB_INITIAL_VALUES),
      ...FAELLES_AARSLOEN_INITIAL_VALUES,
      ...(parsedFaellesAarsloen.success ? parsedFaellesAarsloen.data : FAELLES_AARSLOEN_INITIAL_VALUES),
      skadelidteFodselsdato: parsedStamdata.success ? parsedStamdata.data.skadelidteFodselsdato : undefined,
    },
    skadedato: parsedStamdata.success ? parsedStamdata.data.skadedato : undefined,
    ...(sourceIssues.length > 0 ? { issues: sourceIssues } : {}),
  };

  cachedSnapshot = {
    stamdata,
    erhvervsevnetab,
    faellesAarsloen,
    value,
  };

  return value;
};

export const resetMidlertidigtEetInsertSourceCacheForTesting = (): void => {
  cachedSnapshot = null;
};

export const useMidlertidigtEetInsertSource = (): EetImportSource => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    getMidlertidigtEetInsertSourceSnapshot,
    getMidlertidigtEetInsertSourceSnapshot
  );
};
