import { WorkArtwork } from './WorkArtwork';
import { Link } from 'react-router-dom';
import { geographyLabel, type CultureCatalog, type CultureWork } from '../../lib/culture/schema';
import { ArchivePhoto } from './ArchivePhoto';
import { SaveWork } from './ShelfContext';

export function durationLabel(seconds:number) {
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
export function AudioCover({work}:{work:CultureWork}) {
  if(work.kind==='playlist')return <div className="ew-audio-cover ew-playlist-cover"><ArchivePhoto photo="river" sizes="(max-width:600px) 90vw, 40vw"/><div><span>ELSEWHERE / PLAYLIST</span><strong>{work.title}</strong><em>{work.tracks?.length} selections</em></div></div>;
  return <WorkArtwork id={work.id}><div aria-hidden="true" className={`ew-audio-cover ew-audio-${work.kind}`}><span>{work.kind==='song'?'SONG':work.podcast?.show}</span><div className="ew-audio-mark">{work.kind==='song'?'♪':'◉'}</div><strong>{work.title}</strong><em>{work.creator}</em></div></WorkArtwork>;
}
export function ListeningLinks({work}:{work:CultureWork}) {
  return <div className="ew-listening-links">{work.listeningLinks?.map(link=><a className="ew-button" key={link.url} href={link.url} target="_blank" rel="noreferrer">Listen on {link.provider} ↗<span className="ew-sr-only"> (opens in a new tab)</span></a>)}</div>;
}
export function AudioDetails({work,catalog,embedded}:{work:CultureWork;catalog:CultureCatalog;embedded:boolean}) {
  const Heading=embedded?'h3':'h1';
  const tracks=work.tracks?.map(id=>catalog.works.find(w=>w.id===id));
  return <div className={`ew-audio-detail ${embedded?'is-embedded':''}`}>
    <section className="ew-audio-intro"><AudioCover work={work}/><div><p className="ew-eyebrow">{work.form} · {geographyLabel(work)}</p><Heading>{work.title}</Heading><p className="ew-detail-byline">{work.creator}</p>{work.podcast&&<p className="ew-audio-show">{work.podcast.show}{work.podcast.episode?` · Episode ${work.podcast.episode}`:''}<br/>With {work.podcast.guest}</p>}
      <p className="ew-small">{work.language}{work.durationSeconds?` · ${durationLabel(work.durationSeconds)}`:''}{work.year?` · ${work.yearLabel} ${work.publishedOn??work.year}`:''}</p><p className="ew-lede">{work.description}</p><ListeningLinks work={work}/><SaveWork id={work.id} title={work.title}/><p className="ew-small">Saved on this device.</p>
    </div></section>
    {tracks&&<section className="ew-track-section"><div className="ew-section-title"><h2>Tracks</h2><span className="ew-small">{tracks.length} selections · Explore individually</span></div><ol className="ew-track-list">{tracks.map((track,i)=><li key={work.tracks![i]}><span className="ew-track-number">{String(i+1).padStart(2,'0')}</span>{track?<><div><Link to={`/discover/work/${track.id}`}>{track.title}</Link><p>{track.creator}</p><small>{track.recording}</small></div><SaveWork id={track.id} title={track.title}/></>:<p>This track is currently unavailable.</p>}</li>)}</ol><p className="ew-small">Saving this playlist keeps the selection together. It does not save or mark its tracks as listened to.</p></section>}
    <section className="ew-audio-context"><div><p className="ew-eyebrow">The Paris connection</p><h2>{work.kind==='playlist'?'About this selection':work.relationship.type==='soundtrack'?'Connected through film':'Connected to the city'}</h2><p>{work.relationship.statement}</p>{work.context?.map(p=><p key={p}>{p}</p>)}{work.recording&&<div className="ew-recording"><h3>{work.kind==='song'?'Selected recording':'This episode'}</h3><p>{work.recording}</p><small>{work.kind==='podcast_episode'?'Summary based on publisher notes. Publication dates describe the episode, not current visitor information.':'Dates refer to the release or performance identified above. An online upload date is not treated as the original release date.'}</small></div>}<Link className="ew-link" to="/discover/place/paris">Explore Paris ↗</Link></div>
      <aside><h3>Sources</h3>{work.kind==='playlist'&&<p>Editorial selection by Elsewhere. Each track has its own sources and listening link.</p>}{work.sourceIds.map(id=>{const source=catalog.sources.find(s=>s.id===id)!;return <p key={id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗<span className="ew-sr-only"> (opens in a new tab)</span></a><small>Checked {source.checkedAt}</small></p>;})}<p className="ew-small">Listening opens the provider’s page. Availability and sign-in requirements may vary.</p></aside>
    </section>
  </div>;
}
export function AudioPreview({work}:{work:CultureWork}) {
  return <article className="ew-audio-preview"><Link className="ew-audio-preview-art" to={`/discover/work/${work.id}`} aria-label={`Explore ${work.title}`}><AudioCover work={work}/></Link><div><p className="ew-eyebrow">{work.kind==='song'?'Song':work.podcast?.show}</p><h3><Link to={`/discover/work/${work.id}`}>{work.title}</Link></h3><p className="ew-audio-creator">{work.creator}{work.durationSeconds?` · ${durationLabel(work.durationSeconds)}`:''}</p><p>{work.description}</p><div className="ew-audio-preview-actions"><Link to={`/discover/work/${work.id}`}>Explore →</Link><SaveWork id={work.id} title={work.title}/></div></div></article>;
}
function CompactAudioPreview({work}:{work:CultureWork}) {
  return <article className={`pd-audio-row pd-audio-row-${work.kind}`}>
    <div className="pd-audio-symbol" aria-hidden="true">{work.kind==='song'?'♪':'◉'}</div>
    <div><p className="ew-eyebrow">{work.podcast?.show??work.creator}</p><h3><Link to={`/discover/work/${work.id}`}>{work.title}</Link></h3><p>{work.description}</p>{work.podcast&&<p className="ew-small">With {work.podcast.guest}{work.durationSeconds?` · ${durationLabel(work.durationSeconds)}`:''} · Publisher summary</p>}<div className="pd-feature-links"><Link to={`/discover/work/${work.id}`}>Explore →</Link><SaveWork id={work.id} title={work.title}/></div></div>
  </article>;
}
export function ParisAudio({catalog}:{catalog:CultureCatalog}) {
  const playlist=catalog.works.find(w=>w.id==='paris-playlist');
  const songs=['paris-seveille','la-boheme','la-seine'].flatMap(id=>catalog.works.filter(w=>w.id===id));
  const episodes=['walking-through-paris','an-intro-to-jazz-in-paris','carving-paris'].flatMap(id=>catalog.works.filter(w=>w.id===id));
  if(!playlist)return null;
  return <section className="ew-paris-audio pd-section" aria-label="Paris music and podcasts">
    <div className="pd-section-heading"><h2>Music</h2><Link to="/discover/browse?destination=paris&kind=song">All Paris songs ↗</Link></div>
    <div className="pd-music-layout"><article className="pd-playlist-card"><ArchivePhoto photo="river" sizes="(max-width:760px) 92vw, 40vw"/><div><p className="ew-eyebrow">Playlists / Curated by Elsewhere</p><h3>{playlist.title}</h3><p>{playlist.description}</p><div className="pd-feature-links"><Link className="ew-button" to="/discover/work/paris-playlist">Explore the playlist →</Link><SaveWork id={playlist.id} title={playlist.title}/></div></div></article><div className="pd-song-rows">{songs.map(work=><CompactAudioPreview key={work.id} work={work}/>)}</div></div>
    <div className="pd-section-heading ew-podcast-heading"><h2>Podcast episodes</h2><Link to="/discover/browse?destination=paris&kind=podcast_episode">All Paris episodes ↗</Link></div><div className="pd-episode-rows">{episodes.map(work=><CompactAudioPreview key={work.id} work={work}/>)}</div>
  </section>;
}
