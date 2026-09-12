import { Link } from 'react-router-dom'
import { CitySelector } from '../components/CitySelector'
import { HeroPhoto } from '../components/HeroPhoto'
import { ImageSlot } from '../components/ImageSlot'
import { fileDateLabel, mediaUrl } from '../lib/media'
import { useCity } from '../state/CityContext'

// Presentation only: do not change the catalog or accepted itinerary to show a sample.
const PARIS_HIGHLIGHTS = [
  { id: 'vosges', file: 'paris-places-des-vosges.jpeg', time: '09:45', note: 'A loop under the arcades, a pause in the garden. Give the square a little time.' },
  { id: 'berthillon', file: 'paris-ile-st-louis-berthillon.jpeg', time: '15:00', note: 'An island detour for ice cream, with the Seine just around the corner.' },
  { id: 'tournelle', file: '_gen-tournelle-golden.jpg', time: '19:40', note: 'A riverside finish looking back toward Notre-Dame. Let the view set the pace.' },
]

export function Home() {
  const city = useCity()
  const base = `/${city.id}`
  const isParis = city.id === 'paris'
  const highlights = isParis
    ? PARIS_HIGHLIGHTS.flatMap(item => {
      const place = city.places.find(p => p.id === item.id)
      return place ? [{ ...item, place }] : []
    })
    : city.places.slice(0, 3).map(place => ({ id: place.id, place, file: '', time: '', note: `Allow around ${place.dur} minutes. Make it part of a plan built around your interests.` }))

  return (
    <main className="editorial-home page-enter" id="main-content" tabIndex={-1}>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <CitySelector key={city.id} />
          <h1 id="home-title">
            <span className="visually-hidden">{city.name}, </span>
            {isParis ? 'from someone who’s been there.' : 'a new city, thoughtfully planned.'}
          </h1>
          <p className="home-lede">{isParis
            ? 'Real photos, favorite places, room to wander. Turn a personal Paris archive into a trip that fits your days.'
            : 'Explore researched places and shape them into a day that works for you. A new chapter in the travel collection.'}</p>
          <div className="home-actions">
            <Link to={`${base}/compose`} viewTransition className="btn btn-primary">Build your {city.name} itinerary <span aria-hidden="true">→</span></Link>
            <a href="#sample-day" className="btn btn-secondary">{isParis ? 'Explore a sample day' : 'Explore the collection'} <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className={`home-photo-frame${isParis ? '' : ' home-research-frame'}`}>
          {isParis ? <HeroPhoto height="100%" caption="The Eiffel Tower, from the Seine" /> : <div className="home-research-cover">
            <p className="editorial-eyebrow">The city collection · 02</p>
            <span className="research-city-name">Roma</span>
            <p>Ancient streets.<br />A fresh perspective.</p>
            <div className="home-research-caption">{city.places.length} researched places<br />Firsthand imagery is not yet available.</div>
          </div>}
        </div>
      </section>

      <section className="home-sample" id="sample-day" aria-labelledby="sample-title">
        <div className="home-section-heading">
          <div>
            <p className="editorial-eyebrow">{isParis ? 'Sample day · Marais & the two islands' : 'From the Rome collection'}</p>
            <h2 id="sample-title">{isParis ? 'A little structure. Plenty of discovery.' : 'Good places to begin.'}</h2>
            <p>{isParis ? 'Three moments from a curated day, from the arcades to the river.' : 'A few starting points for your own itinerary.'}</p>
          </div>
          <span className="editorial-meta">{isParis ? 'MORNING → EVENING' : 'RESEARCHED PLACES'}</span>
        </div>
        <div className="home-sample-grid">
          {highlights.map((item, index) => <article className="home-place-card" key={item.id}>
            <div className={`home-card-image${item.file ? '' : ' home-card-research'}`}>
              {item.file ? <ImageSlot src={mediaUrl(city.id, item.file)} placeholder={item.place.name} /> : <span aria-hidden="true">0{index + 1}</span>}
              <span className="home-image-label">{item.file ? 'FROM THE ARCHIVE' : 'RESEARCHED'}</span>
            </div>
            <div className="home-card-meta"><span>{item.time || `~${item.place.dur} MIN`}</span><span>{item.place.area}</span></div>
            <h3>{item.place.name}</h3>
            <p>{item.note}</p>
            <div className="home-card-footer">{item.file ? `Photographed ${fileDateLabel(city, item.file) ?? 'in the archive'}` : 'Visit duration is an estimate'}</div>
          </article>)}
        </div>
        <div className="home-sample-footnote">
          <p>{isParis ? 'Sample timings, with other stops in between. Historical photos show the place, not its current opening status.' : 'Check current opening hours and booking requirements before visiting.'}</p>
          <Link to={`${base}/archive`}>Explore the map <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="home-method" aria-labelledby="method-title">
        <div><p className="editorial-eyebrow">Make it your own</p><h2 id="method-title">Less planning.<br />More being there.</h2></div>
        <ol>
          <li><span className="editorial-meta">01</span><div><h3>Start with your days</h3><p>Choose your dates, pace and interests. Build a route around what matters to you.</p></div></li>
          <li><span className="editorial-meta">02</span><div><h3>Keep the plan you love</h3><p>Review your itinerary and save an accepted version. Your saved plan stays yours.</p></div></li>
          <li><span className="editorial-meta">03</span><div><h3>Take tomorrow in stride</h3><p>Open a day-by-day briefing from your saved trip, with the details close at hand.</p></div></li>
        </ol>
      </section>

      <section className="home-cta" aria-labelledby="cta-title">
        <p className="editorial-eyebrow">Your next chapter</p>
        <h2 id="cta-title">Make a little room for {city.name}.</h2>
        <p>Start with a few good places. Leave with a plan that feels like you.</p>
        <Link className="btn btn-primary" to={`${base}/compose`} viewTransition>Build your itinerary <span aria-hidden="true">→</span></Link>
      </section>
      <footer className="home-footer">
        <div><Link className="footer-brand" to={base}>Copy My Trip</Link><p>A personal archive.<br />Your next adventure.</p><small>© {new Date().getFullYear()} Copy My Trip</small></div>
        <div><h2>Explore {city.name}</h2><Link to={`${base}/archive`}>The map & collection</Link><Link to={`${base}/neighbourhoods`}>Neighborhoods</Link><a href="#sample-day">{isParis ? 'A sample day' : 'Featured places'}</a></div>
        <div><h2>Your travel companion</h2><Link to={`${base}/compose`}>Plan a visit</Link><Link to={`${base}/saved`}>Saved trip</Link><Link to={`${base}/today`}>Today’s briefing</Link></div>
      </footer>
    </main>
  )
}
