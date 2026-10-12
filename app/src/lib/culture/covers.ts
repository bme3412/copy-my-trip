import type { CultureWork } from './schema';
// Provider display guidance checked 2026-10-12: https://openlibrary.org/dev/docs/api/covers
// Edition ISBNs come from the cited publisher records. Never search by title at runtime.
export function bookCover(work: CultureWork) {
  if (work.kind !== 'book') return undefined;
  const original: Record<string, {isbn:string; edition:string}> = {
    'giovannis-room': {isbn:'9780593688960',edition:'Deluxe paperback, 2024'},
    'roman-stories': {isbn:'9780593469903',edition:'Paperback, 2024'},
  };
  const isbn=work.edition?.match(/ISBN (\d{13})/)?.[1] ?? original[work.id]?.isbn;
  if (!isbn) return undefined;
  return {isbn, edition:work.edition ?? original[work.id].edition,
    src:`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`,
    source:`https://openlibrary.org/isbn/${isbn}`};
}
