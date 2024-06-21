export default function json(data: unknown) {
  return JSON.stringify(data, undefined, 2);
}
