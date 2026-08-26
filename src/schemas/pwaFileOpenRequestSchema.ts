import { z } from 'zod';

/**
 * File System Access-handles kan struktureres-klones til IndexedDB, men Zod kender ikke deres
 * browser-native type. Denne runtime-kontrol er derfor den eneste bevidste custom-del af schemaet.
 */
const fileSystemFileHandleSchema = z.custom<FileSystemFileHandle>(
  (value) => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as { kind?: unknown; getFile?: unknown };
    return candidate.kind === 'file' && typeof candidate.getFile === 'function';
  },
  { message: 'Værdien er ikke et gyldigt filhåndtag.' },
);

/** Schema for den device-lokale pending `.eo`-request, der skal overleve en app-opdatering. */
export const pwaFileOpenRequestSchema = z.object({
  // Id'et indeholder klientens session-id plus en monoton lokal tæller. En ren proceslokal tæller
  // begyndte igen på 1 efter reload, så en afsluttet request-markør kunne forveksles med en ny fil.
  id: z.string().regex(/^pwa-open-[a-z0-9-]+$/i),
  createdAtEpochMs: z.number().int().nonnegative(),
  fileHandle: fileSystemFileHandleSchema,
  fileName: z.string().trim().min(1),
  ignoredFileCount: z.number().int().nonnegative(),
});

export type PwaFileOpenRequest = z.infer<typeof pwaFileOpenRequestSchema>;
