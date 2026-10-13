import { PARIS } from '../cities/paris';
import { slug } from './slug';

// Only existing archive plates with an explicit file mapping become gallery items.
// Research-only images and unmapped placeholders never imply firsthand photography.
export const parisArchiveItems = PARIS.places.flatMap(place =>
  (PARIS.media[place.id]?.plates ?? []).flatMap((plate, order) => {
    const files = PARIS.slotFiles?.[plate.id];
    return files?.img || files?.video ? [{
      id: plate.id, place, order, caption: `${files.video ? 'Original video' : 'Original photograph'} ${order + 1}`, image: files.img, video: files.video,
      date: PARIS.mediaDates?.[files.video ?? files.img ?? ''],
    }] : [];
  }),
).filter((item, index, all) => all.findIndex(other => (other.video ?? other.image) === (item.video ?? item.image)) === index).sort((a, b) => a.order - b.order);
export type ParisArchiveItem = typeof parisArchiveItems[number];
export const archiveNeighborhoods = [...new Set(parisArchiveItems.map(item => item.place.hood))];
export function archivePlace(reference: string | null) {
  return PARIS.places.find(place => place.id === reference || slug(place.name) === reference);
}
export function archiveDay(placeId: string) {
  const place = PARIS.places.find(p => p.id === placeId);
  return PARIS.nodes.find(node => node.name === place?.name)?.day;
}
