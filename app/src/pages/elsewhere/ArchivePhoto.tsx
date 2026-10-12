import { useState } from 'react';
import variants from '../../media/variants.json';
import dates from '../../cities/paris/data/media-dates.json';
export const archivePhotos = {
  hero: {file:'paris-eiffel-tower-quai.jpeg',caption:'Paris, along the Seine',position:'center 48%'},
  cafe: {file:'paris-saint-germain-deux-magots.jpeg',caption:'Saint-Germain-des-Prés',position:'center'},
  river: {file:'paris-vert-gallant.jpeg',caption:'At the edge of the Seine',position:'center'},
};
export function ArchivePhoto({photo='hero',eager=false,sizes='(max-width: 760px) 92vw, 55vw'}:{photo?:keyof typeof archivePhotos;eager?:boolean;sizes?:string}) {
  const [failed,setFailed]=useState(false);const p=archivePhotos[photo];
  const entry=(variants as Record<string,{width:number;height:number;variants:{path:string;width:number}[]}>)[`paris/${p.file}`];
  const date=(dates as Record<string,string>)[p.file];
  return <figure className={`ew-photo ew-photo-${photo}`}>
    {failed||!entry?<div className="ew-image-missing">Archive photograph unavailable</div>:<img src={entry.variants.at(-1)!.path} srcSet={entry.variants.map(v=>`${v.path} ${v.width}w`).join(', ')} sizes={sizes} width={entry.width} height={entry.height} alt={p.caption} loading={eager?'eager':'lazy'} fetchPriority={eager?'high':'auto'} style={{objectPosition:p.position}} onError={()=>setFailed(true)}/>}
    <figcaption><span>{p.caption}</span><span>Original archive{date?` · ${date}`:''}</span></figcaption>
  </figure>;
}
