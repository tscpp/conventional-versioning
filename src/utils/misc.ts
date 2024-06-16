export function spliceValueFromArray<T>(array: T[], value: T) {
  const index = array.findIndex((v) => v === value);
  if (index !== -1) {
    array.splice(index, 1);
  }
}
