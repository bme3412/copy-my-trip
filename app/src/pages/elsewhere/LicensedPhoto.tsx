import { useState } from 'react';

// The same credited asset is reused on the hub and entity details. Originals and
// derivative licenses are documented in public/culture/artwork/CREDITS.md.
const photographs = {
  shakespeare: {
    caption: 'Shakespeare and Company, Paris · 2012',
    alt: 'The yellow and green Shakespeare and Company bookshop frontage beside a Wallace fountain',
    creator: 'Mike Peel', creatorUrl: 'https://www.mikepeel.net',
    source: 'https://commons.wikimedia.org/wiki/File:Shakespeare_and_Company,_Paris.jpg',
    license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    width: 1280, height: 853,
  },
  baldwin: {
    caption: 'James Baldwin, London · 1969',
    alt: 'Black and white portrait of James Baldwin by Allan Warren',
    creator: 'Allan Warren', creatorUrl: 'https://commons.wikimedia.org/wiki/User:Allan_Warren',
    source: 'https://commons.wikimedia.org/wiki/File:James_Baldwin_37_Allan_Warren.jpg',
    license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    width: 1280, height: 1156,
  },
};
export function LicensedPhoto({photo,sizes='(max-width:760px) 92vw, 55vw'}:{photo:keyof typeof photographs;sizes?:string}) {
  const [failed,setFailed]=useState<string>();
  const p=photographs[photo],path=`/culture/artwork/${photo}`;
  return <figure className={`pd-licensed-photo pd-photo-${photo}`}>
    {failed===photo?<div className="ew-image-missing">Photograph unavailable · {p.caption}</div>:<img src={`${path}-1280.webp`} srcSet={[320,640,1280].map(w=>`${path}-${w}.webp ${w}w`).join(', ')} sizes={sizes} width={p.width} height={p.height} loading="lazy" decoding="async" alt={p.alt} onError={()=>setFailed(photo)}/>}
    <figcaption><span>{p.caption}</span><span><a href={p.creatorUrl}>{p.creator}</a> · <a href={p.source}>Wikimedia Commons</a> · <a href={p.licenseUrl}>{p.license}</a> · resized; display crop</span></figcaption>
  </figure>;
}
export function entityPhoto(id:string) {
  if(['place:shakespeare','story:bookshop-reunion','story:two-bookshops'].includes(id))return 'shakespeare' as const;
  if(id==='person:james-baldwin')return 'baldwin' as const;
  return undefined;
}
