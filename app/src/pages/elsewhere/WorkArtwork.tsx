import { useState, type ReactNode } from 'react';
import { approvedArtwork } from '../../lib/culture/artwork';

export function WorkArtwork({id,children}:{id:string;children:ReactNode}) {
  const artwork = approvedArtwork(id);
  const [failed, setFailed] = useState<string>();
  if (!artwork?.src || failed === artwork.src) return children;
  return <figure className="ew-approved-art"><img src={artwork.src} alt={artwork.alt} loading="lazy" decoding="async" onError={() => setFailed(artwork.src)}/><figcaption>{artwork.credit}</figcaption></figure>;
}
