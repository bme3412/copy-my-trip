import type { City, FinishedDay, GraphNode, Hood, Place, PlaceEntry, PlaceInfo, PlaceMedia, StartLoc } from '../types'
import cityJson from './data/city.json'
import placesJson from './data/places.json'
import infoJson from './data/info.json'
import entryJson from './data/entry.json'
import nodesJson from './data/nodes.json'
import hoodsJson from './data/hoods.json'
import curatedDaysJson from './data/curated-days.json'
import mediaJson from './data/media.json'
import slotFilesJson from './data/slot-files.json'
import mediaDatesJson from './data/media-dates.json'

/* Rome has no archive yet: every place is web-sourced and rendered as such.
 * The data contract is identical to Paris — `npm run validate:cities` is the
 * guarantee; the archive (photos, visits, measured walks) lands per place as
 * the city gets walked. */
export const ROME: City = {
  ...(cityJson as unknown as Omit<City, 'places' | 'info' | 'entry' | 'nodes' | 'hoods' | 'curatedDays' | 'media' | 'slotFiles' | 'mediaDates'> & { start: StartLoc }),
  timeZone: 'Europe/Rome',
  places: placesJson as unknown as Place[],
  info: infoJson as Record<string, PlaceInfo>,
  entry: entryJson as Record<string, PlaceEntry>,
  nodes: nodesJson as unknown as GraphNode[],
  hoods: hoodsJson as Hood[],
  curatedDays: curatedDaysJson as unknown as FinishedDay[],
  media: mediaJson as unknown as Record<string, PlaceMedia>,
  slotFiles: slotFilesJson as Record<string, { img?: string; video?: string }>,
  mediaDates: mediaDatesJson as Record<string, string>,
}
