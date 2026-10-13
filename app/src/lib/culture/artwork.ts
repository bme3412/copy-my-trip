import type { CultureCatalog } from './schema';

// Work identity and image permission are reviewed separately. Pending entries
// deliberately have no image URL; finding an image is not publication approval.
export type WorkArtwork = {
  status: 'pending' | 'approved'; identity: string; source: string; credit: string;
  permission: string; restrictions: string; checkedAt: string;
  src?: string; alt?: string; permissionSource?: string;
};
const pending = (identity: string, source: string, credit: string, permission: string, restrictions: string): WorkArtwork => ({status:'pending',identity,source,credit,permission,restrictions,checkedAt:'2026-10-12'});
export const workArtwork: Record<string, WorkArtwork> = {
  'a-moveable-feast': pending('Scribner selected edition · ISBN 9780684833637', 'https://www.simonandschuster.com/books/A-Moveable-Feast/Ernest-Hemingway/9780684833637', 'Scribner / Simon & Schuster; cover designer credit unresolved', 'Publisher image located; republication permission not established.', 'Verify supplied file against the selected ISBN; preserve the entire cover.'),
  'before-sunset': pending('Before Sunset · Richard Linklater · 2004', 'https://www.criterion.com/films/28693-before-sunset', 'Criterion / applicable artwork rights holder; individual asset credit unresolved', 'Official edition artwork located; Elsewhere display permission unresolved.', 'Use this film’s artwork, not a trilogy box cover or an unrelated still.'),
  'call-my-agent': pending('Call My Agent! · TV series · Netflix title 80133335', 'https://media.netflix.com/en/only-on-netflix/80133335', 'Netflix / applicable asset rights holder; supplied credit required', 'Media Center terms found; exact press asset, access and accompanying credit remain unconfirmed.', 'Media Center license is conditional; unmodified asset, required credit, no endorsement. Do not use the later film.'),
  'sous-le-ciel-de-paris': pending('Édith Piaf · existing official audio SC06NyI6KKU', 'https://www.youtube.com/watch?v=SC06NyI6KKU', 'Recording and artwork rights holder unresolved', 'Matching commercial release artwork and reuse permission not established.', 'No Zaho de Sagazan substitution, unrelated Piaf portrait or scraped video thumbnail.'),
  'an-intro-to-jazz-in-paris': pending('The Earful Tower · Oliver Gee with Alex Freiman · 22 June 2020', 'https://sites.libsyn.com/97575/an-intro-to-jazz-in-paris', 'The Earful Tower; artwork artist credit unresolved', 'Publisher episode source known; artwork and reuse terms could not be verified in this pass.', 'Episode artwork preferred; show artwork only with permission and visible episode title.'),
  'the-painter-of-modern-life': pending('Penguin selected edition · ISBN 9780141956435 · P. E. Charvet', 'https://www.penguin.co.uk/books/177555/the-painter-of-modern-life-by-baudelaire-charles/9780141956435', 'Penguin Books; cover artwork credit unresolved', 'Edition cover located; Penguin permissions process found, approval not obtained.', 'The historical essay’s age does not establish rights in this edition’s cover.'),
};
export function approvedArtwork(id: string) {
  const art = workArtwork[id];
  return art?.status === 'approved' && art.src && art.alt && art.credit && art.permissionSource ? art : undefined;
}
export function validateArtwork(catalog: CultureCatalog, manifest = workArtwork) {
  for (const [id, art] of Object.entries(manifest)) {
    if (!catalog.works.some(w => w.id === id)) throw Error(`Artwork has unknown work: ${id}`);
    for (const value of [art.identity,art.source,art.credit,art.permission,art.restrictions,art.checkedAt]) if (!value?.trim()) throw Error(`Incomplete artwork evidence: ${id}`);
    if (!/^https:\/\//.test(art.source)) throw Error(`Invalid artwork source: ${id}`);
    if (art.status !== 'pending' && art.status !== 'approved') throw Error(`Invalid artwork review: ${id}`);
    if (art.status === 'pending' && art.src) throw Error(`Pending artwork exposed: ${id}`);
    if (art.status === 'approved' && (!art.src?.startsWith('/culture/artwork/') || !art.alt || !art.permissionSource?.startsWith('https://'))) throw Error(`Uncleared artwork: ${id}`);
  }
}
