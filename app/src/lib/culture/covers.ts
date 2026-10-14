import matchedCovers from './book-covers.json';
import type { CultureWork } from './schema';
// Provider display guidance checked 2026-10-12: https://openlibrary.org/dev/docs/api/covers
// Edition ISBNs come from the cited publisher records. Never search by title at runtime.
export function bookCover(work: CultureWork) {
  if (work.kind !== 'book') return undefined;
  const matched=(matchedCovers as Record<string,{coverId:number;editionId:string}>)[work.id];
  if(matched) return {isbn:undefined,edition:`Open Library edition ${matched.editionId}; cover may differ from the cited edition`,
    src:`https://covers.openlibrary.org/b/id/${matched.coverId}-M.jpg?default=false`,
    source:`https://openlibrary.org/books/${matched.editionId}`};
  // Existing publisher-identified editions remain available as fallbacks.
  const approvedIds = new Set(["the-only-street-in-paris", "the-seine", "paris-paris", "the-other-paris", "impossible-city", "a-waiter-in-paris", "the-flaneur", "the-most-beautiful-walk-in-the-world", "the-new-paris", "my-paris-dream", "the-sweet-life-in-paris", "pancakes-in-paris", "giovannis-room", "roman-stories"]);
  if (work.kind !== 'book' || !approvedIds.has(work.id)) return undefined;
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
