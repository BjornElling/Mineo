/** Minimal Web Locks-fixture: callbackens levetid ejer låsen som i browseren. */
export const installFileOperationLocks = (): (() => void) => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'locks');
  const held = new Set<string>();
  const request = async (
    name: string,
    _options: LockOptions,
    callback: (lock: Readonly<{ name: string; mode: 'exclusive' }> | null) => Promise<void>,
  ): Promise<void> => {
    // En simuleret reload skal først slippe forgængerens afsluttede callback.
    await Promise.resolve();
    if (held.has(name)) {
      await callback(null);
      return;
    }
    held.add(name);
    try {
      await callback({ name, mode: 'exclusive' });
    } finally {
      held.delete(name);
    }
  };
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
  return () => {
    if (previous) Object.defineProperty(navigator, 'locks', previous);
    else Reflect.deleteProperty(navigator, 'locks');
  };
};
