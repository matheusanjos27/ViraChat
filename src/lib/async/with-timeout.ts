/** Evita Promise pendurada travar polling/UI até o próximo F5. */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label = "request",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timeout after ${ms}ms`));
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
