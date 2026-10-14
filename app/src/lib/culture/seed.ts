import television from './tv-selection.json' with {type:'json'};
import music from './music-selection.json' with {type:'json'};
import batch from './paris-batch.json' with {type:'json'};
import podcasts from './podcast-selection.json' with {type:'json'};
import books from './book-selection.json' with {type:'json'};
import films from './film-selection.json' with {type:'json'};
import { enrichExistingWork } from './catalog-metadata.js';
import { reviewedSources, reviewedWorks } from './reviewed-selection.js';
import { audioSources, audioWorks } from './audio-selection.js';
import { parseCatalog, validatePlaylistTracks } from './schema.js';
// Original short descriptions and factual citations only: no cover art, scraped prose,
// provider payloads, exact locations, embeddings or curator endorsement.
export const cultureCatalog = parseCatalog({
  schemaVersion: 3, revision: 'paris-atlas-batch-1',
  destinations: [
    {id:'paris',name:'Paris',country:'France',archive:'original',introduction:'Start with the streets. Stay for the stories. Explore Paris through original photographs, books and films, then find your own way into the city.'},
    {id:'rome',name:'Rome',country:'Italy',archive:'none',introduction:'A city seen through different lives. Begin with fiction and cinema, then explore the researched place catalog. The personal photo archive has not reached Rome yet.'},
  ],
  sources: [
    ...batch.sources,
    ...reviewedSources,
    ...audioSources,
    ...podcasts.sources,
    ...books.sources,
    ...films.sources,
    ...music.sources,
    ...television.sources,
    {id:'baldwin-prh',title:"Penguin Random House · Giovanni’s Room reading guide",url:'https://www.penguinrandomhouse.com/books/669846/giovannis-room-deluxe-edition-by-james-baldwin/readers-guide/',checkedAt:'2026-10-11',policy:'citation-and-facts-only'},
    {id:'cleo-criterion',title:'The Criterion Collection · Cléo from 5 to 7',url:'https://www.criterion.com/films/244-cleo-from-5-to-7',checkedAt:'2026-10-11',policy:'citation-and-facts-only'},
    {id:'lahiri-prh',title:'Penguin Random House · Roman Stories',url:'https://www.penguinrandomhouse.com/books/717579/roman-stories-by-jhumpa-lahiri/',checkedAt:'2026-10-11',policy:'citation-and-facts-only'},
    {id:'beauty-criterion',title:'The Criterion Collection · The Great Beauty',url:'https://www.criterion.com/films/28604-the-great-beauty',checkedAt:'2026-10-11',policy:'citation-and-facts-only'},
  ],
  works: [
    ...batch.works,
    ...reviewedWorks,
    ...audioWorks,
    ...podcasts.works,
    ...books.works,
    ...films.works,
    ...music.works,
    ...television.works,
    {id:'giovannis-room',title:'Giovanni’s Room',creator:'James Baldwin',kind:'book',year:1956,yearLabel:'First published',form:'Novel',language:'English',destinationId:'paris',description:'An American in Paris confronts desire and the difficulty of knowing himself.',relationship:{type:'primarily_set_in',scope:'city',statement:'The publisher’s reading guide places the central love affair in 1950s Paris.',sourceId:'baldwin-prh',review:'source_reported'},sourceIds:['baldwin-prh'],immersion:'unreviewed'},
    {id:'cleo-from-5-to-7',title:'Cléo from 5 to 7',creator:'Agnès Varda',kind:'film',year:1962,yearLabel:'Film released',form:'Feature film',language:'French',destinationId:'paris',description:'A singer moves through Paris while waiting for news that could change her life.',relationship:{type:'primarily_set_in',scope:'city',statement:'Criterion describes Cléo’s journey through Paris as she waits for medical test results.',sourceId:'cleo-criterion',review:'source_reported'},sourceIds:['cleo-criterion'],immersion:'unreviewed'},
    {id:'roman-stories',title:'Roman Stories',creator:'Jhumpa Lahiri',kind:'book',year:2023,yearLabel:'English edition',form:'Short stories',language:'Italian · English translation',destinationId:'rome',description:'Nine stories bring different lives into view across Rome.',relationship:{type:'primarily_set_in',scope:'city',statement:'The publisher identifies Rome as the central city of this nine-story collection.',sourceId:'lahiri-prh',review:'source_reported'},sourceIds:['lahiri-prh'],immersion:'unreviewed'},
    {id:'the-great-beauty',title:'The Great Beauty',creator:'Paolo Sorrentino',kind:'film',year:2013,yearLabel:'Film released',form:'Feature film',language:'Italian',destinationId:'rome',description:'A writer looks beyond Rome’s parties and social rituals to reconsider his life.',relationship:{type:'primarily_set_in',scope:'city',statement:'Criterion’s synopsis places Jep’s social life and reflections in Rome.',sourceId:'beauty-criterion',review:'source_reported'},sourceIds:['beauty-criterion'],immersion:'unreviewed'},
  ].map(enrichExistingWork),
});

validatePlaylistTracks(cultureCatalog);
