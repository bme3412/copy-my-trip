import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { formatLabel, type CultureWork } from '../../lib/culture/schema';
import { WorkCover, WorkMetadata } from './WorkPresentation';
import { MusicPlay } from './MusicPlayer';
import { PodcastPlayer } from './PodcastPlayer';
import { ListeningLinks } from './AudioPresentation';
import { bookCover } from '../../lib/culture/covers';
import { youtubeTracks } from '../../lib/culture/youtube';
import { FilmTrailer } from './FilmTrailer';
import { SaveWork } from './ShelfContext';

export function MediaPreview({work, onClose}: {work: CultureWork; onClose: () => void}) {
  const cover=bookCover(work);
  const music=work.kind==='song' || work.kind==='playlist';
  const label=music?'music':work.kind==='tv_show'?'TV show':formatLabel(work.kind).toLowerCase();
  const detailLabel=work.kind==='playlist'?'playlist':work.kind==='song'?'song':label;
  const playable=!!youtubeTracks[work.id] || work.id==='paris-playlist';
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    heading.current?.focus({preventScroll:true});
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({preventScroll:true});
    };
  }, []);
  return <dialog ref={dialog} className="po-film-preview" aria-labelledby="film-preview-title"
    onCancel={event => {event.preventDefault(); onClose();}}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <div className="po-preview-bar"><span>Paris / {label} preview</span><button type="button" onClick={onClose} aria-label={`Close ${label} preview`}>Close ×</button></div>
    <div className="po-preview-content">
      <p className="ew-eyebrow">{formatLabel(work.kind)} · {work.language}</p>
      <h2 ref={heading} tabIndex={-1} id="film-preview-title">{work.title}</h2>
      <p className="po-preview-director">{work.kind==='film'?'Directed by ':work.kind==='tv_show'?'Created by ':''}{work.creator}</p>
      <WorkMetadata work={work}/>
      <p>{work.description}</p>
      {!music && work.kind!=='film' && work.kind!=='podcast_episode' && <div className="po-preview-art"><WorkCover work={work}/></div>}
      {cover && <p className="ew-small"><a href={cover.source} target="_blank" rel="noreferrer">Cover: Open Library ↗</a> · Cover edition may differ from the cited edition.</p>}
      {work.kind==='podcast_episode' && <><PodcastPlayer key={work.id} work={work}/><ListeningLinks work={work}/></>}
      {music ? <section className="po-preview-listening" aria-label="Listen to this music">{playable ? <><h3>Choose how to listen</h3><div onClick={event=>{if((event.target as HTMLElement).closest('button'))onClose();}}><MusicPlay work={work}/></div><p className="ew-small">Your choice opens the player on this Paris page. Spotify is the default; YouTube is also available.</p></> : <><h3>Listening links</h3><ListeningLinks work={work}/><p className="ew-small">In-page playback is available for the eight-track Paris playlist. This song uses the available source links.</p></>}</section> : <FilmTrailer work={work} compact/>}
      <div className="po-preview-connection"><h3>The Paris connection</h3><p>{work.relationship.statement}</p></div>
    </div>
      <div className="po-preview-actions"><SaveWork id={work.id} title={work.title}/><Link className="ew-button" to={`/discover/work/${work.id}`}>Explore {detailLabel} →</Link></div>
  </dialog>;
}
