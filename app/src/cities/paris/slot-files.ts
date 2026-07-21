import type { City } from '../types'

/**
 * Matches the archive drop in public/media/paris/ to the interface's slots,
 * by content. Original filenames are kept — this map is the join. Slots not
 * listed keep their placeholders: a placeholder is more honest than a photo
 * of the wrong place (audited — identifiable landmarks only fill their own
 * stops; e.g. Deux Magots no longer stands in for Café de la Mairie).
 *
 * `_gen-*` files are derived (video stills / H.264 web conversions) via
 * ffmpeg — regenerate freely, never edit.
 */
export const PARIS_SLOT_FILES: NonNullable<City['slotFiles']> = {
  // ── Day 1 · Marais & the two islands ──
  'vosges-2': { img: '_gen-vosges-garden.jpg' }, // still from paris-place-des-vosges.mov
  'marche-1': { img: 'paris-pastries.jpeg' }, // the stall trays
  'marche-2': { img: 'paris-tarte-framboise.jpeg' }, // "The plate"
  'berthillon-1': { img: 'paris-ile-st-louis-berthillon.jpeg' }, // the storefront, line included
  'berthillon-2': { img: 'paris-ile-st-louis-sign.jpeg' }, // Rue Saint-Louis-en-l'Île

  // ── Day 3 · Canal Saint-Martin & Montmartre ──
  'd3-martyrs-2': { img: 'sacre-coueur-bottom-hill.jpeg' }, // "Up the hill" — the climb the street points at
  'd3-sacre-1': { img: 'sacre-coeur-steps-view.jpeg' }, // the view from the terrace
  'd3-sacre-2': { img: 'paris-sacre-coeur-mid.jpeg' },

  // ── Day 4 · The east side & a last river light ──
  'd4-vosges-2': { img: '_gen-vosges-fountain.jpg' }, // still from paris-place-des-vosges.mov

  // ── Builder-day extras ──
  'janou-1': { img: 'chez-janou-interior.jpeg' },
  'janou-2': { img: 'chez-janou-entrance.jpeg' },

  // ── Neighbourhood headers ──
  'hood-marais': { img: 'chez-janou.jpeg' }, // Marais corner (the arcades themselves still unphotographed)
  'hood-islands': { img: 'paris-ile-st-louis-restaurant-red.jpeg' },
  'hood-stgermain': { img: 'paris-saint-german-bonaparte.jpeg' },
  'hood-louvre': { img: 'paris-louvre-pyramid.jpeg' },
  'hood-champs': { img: 'paris-champs-elysee.jpeg' },
  'hood-eiffel': { img: 'paris-eiffel-tower-trocadero-lights.jpeg' },
  'hood-montmartre': { img: '_gen-maison-rose.jpg' }, // from paris-montmartre-maison-rose.mov

  // ── The icons (archive-only places) ──
  'nd-1': { img: 'paris-notre-dame-seine.jpeg' },
  'nd-2': { img: 'paris-notre-dame-interior.jpeg' },
  'nd-3': { img: 'paris-notre-dame-empty.jpeg', video: '_gen-notre-dame-pano.mp4' },
  'nd-4': { img: 'paris-notre-dame.jpeg' }, // scaffolding & crane — the restoration years
  'nd-5': { img: 'paris-notre-dame-interior-2.jpeg' },
  'nd-6': { img: 'paris-notre-dame-interior-3.jpeg' },
  'nd-7': { img: 'paris-notre-dame-january.jpeg' }, // EXIF says Dec 26 — Boxing Day
  'vg-1': { img: 'paris-vert-gallant.jpeg' },
  'vg-2': { img: 'pais-vert-gallant.jpeg', video: '_gen-vert-galant-pano.mp4' },
  'pda-1': { img: 'paris-pont-neuf-dec26.jpeg' }, // the quai by the Institut, December
  'pda-2': { img: '_gen-pont-des-arts.jpg', video: '_gen-pont-des-arts.mp4' },
  'louvre-1': { img: 'paris-louvre-pyramid.jpeg' },
  'pomp-1': { img: 'paris-centre-pompidou.jpeg' },
  'pomp-2': { img: '_gen-pompidou.jpg', video: '_gen-pompidou.mp4' },
  'sg-1': { img: 'paris-saint-germain-deux-magots.jpeg' },
  'sg-2': { img: 'paris-saint-german-bonaparte.jpeg' },
  'sg-3': { img: '_gen-st-germain-christmas.jpg', video: '_gen-st-germain-christmas.mp4' },
  'alexiii-1': { img: 'paris-bridge-palais.jpeg' },
  'alexiii-2': { img: 'paris-eiffel-tower-sunset-seine.jpeg' },
  'arc-1': { img: 'paris-champs-elysee.jpeg' },
  'arc-2': { img: 'paris-arc-triomphe-eiffel.jpeg', video: '_gen-arc-pano.mp4' },
  'eiffel-1': { img: 'paris-eiffel-tower-trocadero-lights.jpeg' },
  'eiffel-2': { img: 'paris-eiffel-tower-rings.jpeg' },
  'eiffel-3': { img: 'paris-eiffel-tower-bottom-lights.jpeg' },
  'eiffel-4': { img: 'paris-eiffel-tower-sunset.jpeg' },
  'eiffel-5': { img: 'paris-eiffel-tower-quai.jpeg' },
  'eiffel-6': { img: 'paris-eiffel-tower-rings-2.jpeg' },
}
