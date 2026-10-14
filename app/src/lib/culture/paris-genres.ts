import musicCategories from './music-categories.json';
import type { CultureWork } from './schema';
// Browsing categories derived from existing editorial notes, not provider genre metadata.
const rules:Record<string,readonly (readonly [string,RegExp])[]>={
 book:[['Fiction',/\b(novel|fiction)\b/i],['Memoir & biography',/memoir|autobiograph|biograph|expatriate life/i],['History',/histor|occupation|resistance|liberation/i],['Art & culture',/art, design|philosophy|visual paris|art history/i],['Food & travel',/food|cookbook|culinary|travel|walking/i]],
 film:[['Documentary',/documentar|essay film/i],['Romance',/romance|romantic|love story/i],['Comedy',/comedy|comic|satire/i],['Crime & thriller',/crime|thriller|police|heist|noir/i],['Animation & fantasy',/animat|fantasy|sci-fi/i],['Historical & literary',/historical|literary|adaptation/i],['French New Wave',/new wave/i]],
};
export function parisGenres(work:CultureWork):string[]{
 if(work.kind==='song')return (musicCategories as Record<string,string[]>)[work.id]??['Other'];
 const text=[work.form,work.description,...(work.context??[])].join(' ');
 const matches=(rules[work.kind==='tv_show'?'film':work.kind]??[]).filter(([,pattern])=>pattern.test(text)).map(([label])=>label);
 return matches.length?matches:['Other'];
}
export function parisGenreCounts(works:CultureWork[]) {
 const counts=new Map<string,number>();
 for(const work of works)for(const genre of parisGenres(work))counts.set(genre,(counts.get(genre)??0)+1);
 return [...counts].sort(([a],[b])=>a==='Other'?1:b==='Other'?-1:a.localeCompare(b));
}
