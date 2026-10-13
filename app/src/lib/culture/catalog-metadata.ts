import type {CultureWork} from './schema';
/** Additive normalization of existing facts; never replace work IDs or recording dates. */
export function enrichExistingWork(value:unknown):unknown {
  const work=value as CultureWork;
  if(work.geography)return work; // reviewed batch records already carry field-specific evidence
  const sourceId=work.relationship.sourceId;
  const publication=work.kind==='book'?(work.yearLabel==='First published'?{originalYear:work.year,sourceId}:work.yearLabel==='Cited edition'?{edition:{year:work.year!,label:work.edition!,sourceId,...(work.edition?.match(/ISBN (\d{13})/)?.[1]?{isbn:work.edition.match(/ISBN (\d{13})/)![1]}:{})},sourceId}:undefined):undefined;
  // Legacy source-attributed Paris records already assert a city connection, not exclusive geography.
  const geography=work.destinationId==='paris'?{area:work.id==='impossible-city'?'both':'paris_city',note:work.id==='impossible-city'?'The publisher discusses Paris and its relationship with the suburbs.':work.id==='the-seine'?'Paris is one focus of a river history that also extends beyond the city.':'Paris connection reported by the cited source. Other settings may also appear.',sourceId}:undefined;
  return {...work,...(publication?{publication}:{}),...(geography?{geography}:{})};
}
