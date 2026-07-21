import type { GraphNode, Place, PlaceEntry, PlaceInfo, StartLoc } from '../types'

export const START: StartLoc = { name: 'your flat', area: 'Le Marais', lat: 48.858, lon: 2.362, src: null }

export const PLACES: Place[] = [
  { id: 'cafehugo', name: 'Café Hugo', area: 'Place des Vosges, 4e', lat: 48.8553, lon: 2.3663, dur: 40, meal: 'coffee', open: [8, 19], src: 'verified', visits: 5, last: 'May ’24', hood: 'Le Marais (3e–4e)', label: 'Coffee', group: 'food', themes: ['everyday'] },
  { id: 'tenbelles', name: 'Ten Belles', area: 'Canal Saint-Martin, 10e', lat: 48.8709, lon: 2.3663, dur: 30, meal: 'coffee', open: [8, 17], src: 'verified', visits: 5, last: 'Sep ’23', hood: 'Canal Saint-Martin (10e)', label: 'Coffee', group: 'food', themes: ['everyday'] },
  { id: 'vosges', name: 'Place des Vosges', area: 'Le Marais, 4e', lat: 48.8556, lon: 2.3655, dur: 45, meal: null, open: [0, 24], src: 'verified', visits: 7, last: 'May ’24', hood: 'Le Marais (3e–4e)', label: 'Square', group: 'sight', themes: ['neighborhood', 'historic'] },
  { id: 'carnavalet', name: 'Musée Carnavalet', area: 'Le Marais, 3e', lat: 48.8577, lon: 2.3626, dur: 90, meal: null, open: [10, 18], src: 'web', visits: 0, last: '', hood: 'Le Marais (3e–4e)', label: 'Museum', group: 'indoor', themes: ['historic', 'artistic'], closedOn: [1] },
  { id: 'marche', name: 'Marché des Enfants Rouges', area: 'Le Marais, 3e', lat: 48.863, lon: 2.3626, dur: 45, meal: 'lunch', open: [9, 14], src: 'verified', visits: 4, last: 'May ’24', hood: 'Le Marais (3e–4e)', label: 'Lunch · market', group: 'food', themes: ['everyday', 'neighborhood'] },
  { id: 'rosiers', name: 'Rue des Rosiers', area: 'Le Marais, 4e', lat: 48.8571, lon: 2.3592, dur: 40, meal: 'lunch', open: [11, 23], src: 'verified', visits: 6, last: 'May ’24', hood: 'Le Marais (3e–4e)', label: 'Lunch · falafel', group: 'food', themes: ['neighborhood', 'everyday'] },
  { id: 'mouffetard', name: 'Rue Mouffetard', area: 'Latin Quarter, 5e', lat: 48.842, lon: 2.3496, dur: 45, meal: 'lunch', open: [9, 14], src: 'verified', visits: 3, last: 'Sep ’23', hood: 'Latin Quarter (5e)', label: 'Lunch · market', group: 'food', themes: ['everyday', 'neighborhood'] },
  { id: 'saintechapelle', name: 'Sainte-Chapelle', area: 'Île de la Cité', lat: 48.8554, lon: 2.345, dur: 45, meal: null, open: [9, 17], src: 'web', visits: 0, last: '', hood: 'The Islands (1er–4e)', label: 'Monument', group: 'indoor', themes: ['historic'], timed: true },
  { id: 'berthillon', name: 'Berthillon', area: 'Île Saint-Louis', lat: 48.8517, lon: 2.357, dur: 30, meal: null, open: [10, 20], src: 'verified', visits: 8, last: 'May ’24', hood: 'The Islands (1er–4e)', label: 'Sweet stop', group: 'sight', best: [12, 20], themes: ['everyday'] },
  { id: 'tournelle', name: 'Pont de la Tournelle', area: 'by the islands', lat: 48.8508, lon: 2.3548, dur: 40, meal: null, open: [0, 24], src: 'verified', visits: 5, last: 'May ’24', hood: 'The Islands (1er–4e)', label: 'Riverside', group: 'sight', best: [17, 22], themes: ['afterdark'] },
  { id: 'luxembourg', name: 'Jardin du Luxembourg', area: 'Latin Quarter, 6e', lat: 48.8462, lon: 2.3372, dur: 60, meal: null, open: [8, 20], src: 'verified', visits: 4, last: 'Sep ’23', hood: 'Saint-Germain (6e–7e)', label: 'Garden', group: 'park', themes: ['everyday'] },
  { id: 'shakespeare', name: 'Shakespeare & Co', area: 'Latin Quarter, 5e', lat: 48.8526, lon: 2.3471, dur: 40, meal: null, open: [10, 20], src: 'verified', visits: 5, last: 'Sep ’23', hood: 'Latin Quarter (5e)', label: 'Bookshop', group: 'indoor', themes: ['neighborhood', 'artistic'] },
  { id: 'canal', name: 'Canal Saint-Martin', area: '10e', lat: 48.8709, lon: 2.3663, dur: 50, meal: null, open: [0, 24], src: 'verified', visits: 5, last: 'Sep ’23', hood: 'Canal Saint-Martin (10e)', label: 'Long walk', group: 'park', themes: ['neighborhood', 'everyday'] },
  { id: 'sacre', name: 'Sacré-Cœur', area: 'Montmartre, 18e', lat: 48.8867, lon: 2.3431, dur: 40, meal: null, open: [6, 22], src: 'web', visits: 0, last: '', hood: 'Montmartre (18e)', label: 'Viewpoint', group: 'sight', themes: ['monumental', 'neighborhood'] },
  { id: 'pere', name: 'Père-Lachaise', area: '20e', lat: 48.861, lon: 2.3934, dur: 75, meal: null, open: [9, 18], src: 'verified', visits: 3, last: 'Jun ’22', hood: 'Bastille & the East (11e–12e–20e)', label: 'Long walk', group: 'park', themes: ['historic', 'everyday'] },
  { id: 'aligre', name: 'Marché d’Aligre', area: '12e', lat: 48.85, lon: 2.3789, dur: 50, meal: 'lunch', open: [9, 14], src: 'verified', visits: 3, last: 'Jun ’22', hood: 'Bastille & the East (11e–12e–20e)', label: 'Lunch · market', group: 'food', themes: ['everyday'] },
  { id: 'chezjanou', name: 'Chez Janou', area: 'Le Marais, 3e', lat: 48.859, lon: 2.366, dur: 90, meal: 'dinner', open: [19, 23], src: 'verified', visits: 3, last: 'May ’24', hood: 'Le Marais (3e–4e)', label: 'Dinner · Provençal', group: 'food', themes: ['afterdark', 'everyday'] },
  { id: 'baronrouge', name: 'Le Baron Rouge', area: '12e', lat: 48.85, lon: 2.3789, dur: 75, meal: 'dinner', open: [10, 22], src: 'web', visits: 0, last: '', hood: 'Bastille & the East (11e–12e–20e)', label: 'Dinner · wine bar', group: 'food', themes: ['afterdark', 'everyday'] },
  // ── The icons — added from the archive drop (the photos prove the visits) ──
  { id: 'notredame', name: 'Notre-Dame', area: 'Île de la Cité', lat: 48.853, lon: 2.3499, dur: 60, meal: null, open: [8, 19], src: 'verified', visits: 5, last: 'Jan ’25', hood: 'The Islands (1er–4e)', label: 'Cathedral', group: 'sight', themes: ['historic', 'monumental'] },
  { id: 'vertgalant', name: 'Square du Vert-Galant', area: 'Pont Neuf, 1er', lat: 48.8573, lon: 2.341, dur: 30, meal: null, open: [0, 24], src: 'verified', visits: 4, last: 'Dec ’24', hood: 'The Islands (1er–4e)', label: 'Riverside', group: 'park', themes: ['everyday', 'afterdark'] },
  { id: 'pontdesarts', name: 'Pont des Arts', area: 'by the Institut, 6e', lat: 48.8583, lon: 2.3375, dur: 25, meal: null, open: [0, 24], src: 'verified', visits: 3, last: 'Dec ’24', hood: 'Saint-Germain (6e–7e)', label: 'Bridge', group: 'sight', themes: ['afterdark'] },
  { id: 'louvre', name: 'Cour Napoléon, Louvre', area: '1er', lat: 48.8611, lon: 2.3358, dur: 45, meal: null, open: [0, 24], src: 'verified', visits: 3, last: 'Jun ’24', hood: 'Louvre & Opéra (1er–2e)', label: 'Courtyard', group: 'sight', themes: ['monumental', 'artistic'] },
  { id: 'pompidou', name: 'Centre Pompidou', area: 'Beaubourg, 4e', lat: 48.8607, lon: 2.3522, dur: 75, meal: null, open: [11, 21], src: 'verified', visits: 2, last: 'Jun ’24', hood: 'Le Marais (3e–4e)', label: 'Museum', group: 'indoor', themes: ['artistic'], closedOn: [2] },
  { id: 'stgermain', name: 'Saint-Germain-des-Prés', area: 'the café corner, 6e', lat: 48.854, lon: 2.3333, dur: 45, meal: 'coffee', open: [8, 22], src: 'verified', visits: 4, last: 'Jul ’24', hood: 'Saint-Germain (6e–7e)', label: 'Coffee · terraces', group: 'food', themes: ['neighborhood', 'everyday'] },
  { id: 'alexiii', name: 'Pont Alexandre III', area: 'Grand Palais, 8e', lat: 48.8639, lon: 2.3136, dur: 25, meal: null, open: [0, 24], src: 'verified', visits: 2, last: 'Dec ’24', hood: 'Champs-Élysées (8e)', label: 'Bridge', group: 'sight', best: [16, 22], themes: ['monumental', 'afterdark'] },
  { id: 'arc', name: 'Arc de Triomphe', area: 'top of the Champs, 8e', lat: 48.8738, lon: 2.295, dur: 40, meal: null, open: [10, 22], src: 'verified', visits: 2, last: 'Jun ’24', hood: 'Champs-Élysées (8e)', label: 'Viewpoint', group: 'sight', themes: ['monumental', 'afterdark'] },
  { id: 'eiffel', name: 'Eiffel Tower, from Trocadéro', area: '16e', lat: 48.8615, lon: 2.2893, dur: 50, meal: null, open: [0, 24], src: 'verified', visits: 6, last: 'Dec ’24', hood: 'Eiffel & Invalides (7e–16e)', label: 'The tower', group: 'sight', best: [16, 24], themes: ['monumental', 'afterdark'] },
  // ── First-trip coverage places (web-filled until photographed) ──
  { id: 'louvremus', name: 'The Louvre, inside', area: '1er · book the first entry', hood: 'Louvre & Opéra (1er–2e)', lat: 48.8606, lon: 2.3376, dur: 180, meal: null, open: [9, 18], src: 'web', visits: 0, last: '', label: 'Museum · anchor', group: 'indoor', role: 'anchor', themes: ['artistic'], timed: true, closedOn: [2] },
  { id: 'orsay', name: 'Musée d’Orsay', area: '7e · the Impressionists', hood: 'Saint-Germain (6e–7e)', lat: 48.86, lon: 2.3266, dur: 150, meal: null, open: [9, 18], src: 'web', visits: 0, last: '', label: 'Museum · anchor', group: 'indoor', role: 'anchor', themes: ['artistic'], timed: true, closedOn: [1] },
  { id: 'tuileries', name: 'Jardin des Tuileries', area: '1er', hood: 'Louvre & Opéra (1er–2e)', lat: 48.8635, lon: 2.3275, dur: 45, meal: null, open: [7, 21], src: 'web', visits: 0, last: '', label: 'Garden', group: 'park', themes: ['everyday', 'monumental'] },
  { id: 'palaisroyal', name: 'Palais-Royal', area: 'the colonnades, 1er', hood: 'Louvre & Opéra (1er–2e)', lat: 48.8637, lon: 2.3371, dur: 40, meal: null, open: [8, 22], src: 'web', visits: 0, last: '', label: 'Courtyards', group: 'sight', themes: ['neighborhood', 'artistic'] },
  { id: 'rodin', name: 'Musée Rodin', area: '7e · sculpture & gardens', hood: 'Eiffel & Invalides (7e–16e)', lat: 48.8553, lon: 2.3158, dur: 90, meal: null, open: [10, 18], src: 'web', visits: 0, last: '', label: 'Museum · small', group: 'indoor', themes: ['artistic', 'everyday'], closedOn: [1] },
  { id: 'invalides', name: 'Les Invalides', area: '7e', hood: 'Eiffel & Invalides (7e–16e)', lat: 48.856, lon: 2.3126, dur: 90, meal: null, open: [10, 18], src: 'web', visits: 0, last: '', label: 'Museum · history', group: 'indoor', themes: ['historic', 'monumental'] },
  { id: 'ruecler', name: 'Rue Cler', area: 'market street, 7e', hood: 'Eiffel & Invalides (7e–16e)', lat: 48.8578, lon: 2.3061, dur: 45, meal: 'lunch', open: [8, 19], src: 'web', visits: 0, last: '', label: 'Lunch · market', group: 'food', themes: ['everyday'] },
  { id: 'orangerie', name: 'Musée de l’Orangerie', area: 'the Nymphéas, 1er', hood: 'Louvre & Opéra (1er–2e)', lat: 48.8638, lon: 2.3226, dur: 75, meal: null, open: [9, 18], src: 'web', visits: 0, last: '', label: 'Museum · small', group: 'indoor', themes: ['artistic'], timed: true, closedOn: [2] },
  { id: 'abbesses', name: 'Rue des Abbesses', area: 'Montmartre’s real street, 18e', hood: 'Montmartre (18e)', lat: 48.8845, lon: 2.3385, dur: 40, meal: null, open: [8, 22], src: 'web', visits: 0, last: '', label: 'The slopes', group: 'sight', themes: ['neighborhood', 'everyday'] },
  { id: 'versailles', name: 'Versailles', area: 'the whole day · RER C', hood: 'Beyond Paris', lat: 48.8049, lon: 2.1204, dur: 420, meal: null, open: [9, 18], src: 'web', visits: 0, last: '', label: 'Day trip', group: 'sight', role: 'anchor', themes: ['historic', 'artistic', 'monumental'], timed: true, closedOn: [1], dayTrip: true },
]


export const INFO: Record<string, PlaceInfo> = {
  cafehugo: { price: '$$', menu: 'https://www.google.com/search?q=Caf%C3%A9+Hugo+Place+des+Vosges+menu', lang: 'FR' },
  tenbelles: { price: '$', menu: 'https://tenbelles.com/', lang: 'EN' },
  marche: { price: '$', menu: 'https://www.google.com/search?q=March%C3%A9+des+Enfants+Rouges+stalls', lang: 'FR' },
  rosiers: { price: '$', menu: 'https://www.google.com/search?q=L%27As+du+Fallafel+menu', lang: 'FR' },
  mouffetard: { price: '$', menu: 'https://www.google.com/search?q=Rue+Mouffetard+market+stalls', lang: 'FR' },
  aligre: { price: '$', menu: 'https://www.google.com/search?q=March%C3%A9+d%27Aligre', lang: 'FR' },
  berthillon: { price: '$', menu: 'https://www.berthillon.fr/en/', lang: 'EN' },
  chezjanou: { price: '$$', menu: 'https://www.google.com/search?q=Chez+Janou+Paris+menu', lang: 'FR' },
  baronrouge: { price: '$$', menu: 'https://www.google.com/search?q=Le+Baron+Rouge+Paris+menu', lang: 'FR' },
}

export const ENTRY: Record<string, PlaceEntry> = {
  carnavalet: { cost: 'Free', url: 'https://www.carnavalet.paris.fr/en', needed: false, note: 'timed slot' },
  saintechapelle: { cost: '€13', url: 'https://www.sainte-chapelle.fr/en', needed: true, note: '' },
  sacre: { cost: '€7 dome', url: 'https://www.sacre-coeur-montmartre.com/english/', needed: true, note: 'basilica free' },
  pere: { cost: 'Free', url: null, needed: false, note: '' },
  luxembourg: { cost: 'Free', url: null, needed: false, note: '' },
  shakespeare: { cost: 'Free', url: null, needed: false, note: '' },
  vosges: { cost: 'Free', url: null, needed: false, note: '' },
  tournelle: { cost: 'Free', url: null, needed: false, note: '' },
  canal: { cost: 'Free', url: null, needed: false, note: '' },
}

export const HOOD_ORDER = ['Le Marais (3e–4e)', 'The Islands (1er–4e)', 'Latin Quarter (5e)', 'Saint-Germain (6e–7e)', 'Louvre & Opéra (1er–2e)', 'Champs-Élysées (8e)', 'Eiffel & Invalides (7e–16e)', 'Montmartre (18e)', 'Canal Saint-Martin (10e)', 'Bastille & the East (11e–12e–20e)']


export const NODES: GraphNode[] = [
  { name: 'Place des Vosges', hood: 'Le Marais (3e–4e)', day: 1, x: 46, y: 40, v: true },
  { name: 'Marché des Enfants Rouges', hood: 'Le Marais (3e–4e)', day: 1, x: 35, y: 25, v: true },
  { name: 'Musée Carnavalet', hood: 'Le Marais (3e–4e)', day: 1, x: 56, y: 33, v: false },
  { name: 'Sainte-Chapelle', hood: 'The Islands (1er–4e)', day: 1, x: 39, y: 53, v: false },
  { name: 'Berthillon', hood: 'The Islands (1er–4e)', day: 1, x: 61, y: 56, v: true },
  { name: 'Pont de la Tournelle', hood: 'The Islands (1er–4e)', day: 1, x: 56, y: 67, v: true },
  { name: 'Jardin du Luxembourg', hood: 'Saint-Germain (6e–7e)', day: 2, x: 26, y: 75, v: true },
  { name: 'Shakespeare & Co', hood: 'Latin Quarter (5e)', day: 2, x: 45, y: 64, v: true },
  { name: 'Rue Mouffetard', hood: 'Latin Quarter (5e)', day: 2, x: 33, y: 88, v: true },
  { name: 'Canal Saint-Martin', hood: 'Canal Saint-Martin (10e)', day: 3, x: 67, y: 12, v: true },
  { name: 'Sacré-Cœur', hood: 'Montmartre (18e)', day: 3, x: 49, y: 8, v: false },
  { name: 'Marché d’Aligre', hood: 'Bastille & the East (11e–12e–20e)', day: 4, x: 83, y: 70, v: true },
  { name: 'Père-Lachaise', hood: 'Bastille & the East (11e–12e–20e)', day: 4, x: 87, y: 47, v: true },
  // Archive-only nodes — in the graph and the builder, not on a curated day.
  { name: 'Notre-Dame', hood: 'The Islands (1er–4e)', x: 46, y: 62, v: true },
  { name: 'Square du Vert-Galant', hood: 'The Islands (1er–4e)', x: 32, y: 57, v: true },
  { name: 'Pont des Arts', hood: 'Saint-Germain (6e–7e)', x: 27, y: 50, v: true },
  { name: 'Cour Napoléon, Louvre', hood: 'Louvre & Opéra (1er–2e)', x: 23, y: 40, v: true },
  { name: 'Centre Pompidou', hood: 'Le Marais (3e–4e)', x: 48, y: 27, v: true },
  { name: 'Saint-Germain-des-Prés', hood: 'Saint-Germain (6e–7e)', x: 20, y: 65, v: true },
  { name: 'Pont Alexandre III', hood: 'Champs-Élysées (8e)', x: 13, y: 42, v: true },
  { name: 'Arc de Triomphe', hood: 'Champs-Élysées (8e)', x: 8, y: 26, v: true },
  { name: 'Eiffel Tower, from Trocadéro', hood: 'Eiffel & Invalides (7e–16e)', x: 7, y: 60, v: true },
  { name: 'Café Hugo', hood: 'Le Marais (3e–4e)', day: 1, x: 51, y: 45, v: true },
  { name: 'Rue des Rosiers', hood: 'Le Marais (3e–4e)', x: 41, y: 35, v: true },
  { name: 'Ten Belles', hood: 'Canal Saint-Martin (10e)', day: 3, x: 73, y: 18, v: true },
  { name: 'Chez Janou', hood: 'Le Marais (3e–4e)', x: 53, y: 21, v: true },
  { name: 'Le Baron Rouge', hood: 'Bastille & the East (11e–12e–20e)', day: 4, x: 78, y: 77, v: false },
  { name: 'The Louvre, inside', hood: 'Louvre & Opéra (1er–2e)', x: 22, y: 37, v: false },
  { name: 'Musée d’Orsay', hood: 'Saint-Germain (6e–7e)', x: 18, y: 52, v: false },
  { name: 'Jardin des Tuileries', hood: 'Louvre & Opéra (1er–2e)', x: 18, y: 36, v: false },
  { name: 'Palais-Royal', hood: 'Louvre & Opéra (1er–2e)', x: 25, y: 32, v: false },
  { name: 'Musée Rodin', hood: 'Eiffel & Invalides (7e–16e)', x: 12, y: 52, v: false },
  { name: 'Les Invalides', hood: 'Eiffel & Invalides (7e–16e)', x: 10, y: 48, v: false },
  { name: 'Rue Cler', hood: 'Eiffel & Invalides (7e–16e)', x: 8, y: 52, v: false },
  { name: 'Musée de l’Orangerie', hood: 'Louvre & Opéra (1er–2e)', x: 15, y: 38, v: false },
  { name: 'Rue des Abbesses', hood: 'Montmartre (18e)', x: 45, y: 10, v: false },
]
