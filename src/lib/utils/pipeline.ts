export default class Pipeline<T, U = T> {
  #callbacks: ((chunk: unknown) => unknown)[] = [];

  pipe<R>(callback: (chunk: U) => R) {
    this.#callbacks.push(callback as (chunk: unknown) => unknown);
    return this as Pipeline<unknown> as Pipeline<T, R>;
  }

  write(chunk: T): U {
    let result: unknown = chunk;
    for (const callback of this.#callbacks) {
      result = callback(result);
    }
    return result as U;
  }

  clone() {
    const pipeline = new Pipeline<T>();
    this.pipe((chunk) => {
      pipeline.write(chunk as unknown as T);
      return chunk;
    });
    return pipeline;
  }
}
