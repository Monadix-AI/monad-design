export interface SharedOperationOptions<Arguments extends unknown[]> {
  freshnessMilliseconds?: number;
  key?: (...arguments_: Arguments) => string;
  now?: () => number;
}

export const createSharedOperation = <Arguments extends unknown[], Result>(
  operation: (...arguments_: Arguments) => Promise<Result>,
  options: SharedOperationOptions<Arguments> = {}
) => {
  const freshnessMilliseconds = options.freshnessMilliseconds ?? 0;
  const keyFor = options.key ?? (() => 'shared');
  const now = options.now ?? Date.now;
  const cached = new Map<string, { expiresAt: number; value: Result }>();
  const inFlight = new Map<string, Promise<Result>>();

  return (...arguments_: Arguments): Promise<Result> => {
    const key = keyFor(...arguments_);
    const cachedValue = cached.get(key);
    if (cachedValue && cachedValue.expiresAt > now()) return Promise.resolve(cachedValue.value);
    if (cachedValue) cached.delete(key);

    const existing = inFlight.get(key);
    if (existing) return existing;

    let pending: Promise<Result>;
    try {
      pending = operation(...arguments_)
        .then((value) => {
          if (freshnessMilliseconds > 0) {
            cached.set(key, { expiresAt: now() + freshnessMilliseconds, value });
          }
          return value;
        })
        .finally(() => {
          if (inFlight.get(key) === pending) inFlight.delete(key);
        });
    } catch (error) {
      return Promise.reject(error);
    }
    inFlight.set(key, pending);
    return pending;
  };
};
