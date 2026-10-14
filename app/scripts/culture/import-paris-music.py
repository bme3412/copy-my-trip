"""Import supplied music research without treating searches as verified recordings."""
import csv,json,re,sys,unicodedata
from pathlib import Path
from urllib.parse import urlparse
root=Path(__file__).resolve().parents[2]
rows=list(csv.DictReader(open(sys.argv[1],encoding='utf-8-sig')))
existing=json.load(open(sys.argv[2]))['works']
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
lookup={(norm(w['title']),norm(w['creator'])):w['id'] for w in existing if w['kind']=='song'}
works=[];sources=[];review=[];categories={}
for row in rows:
 key=(norm(row['title']),norm(row['artist']))
 if key in lookup:
  wid=lookup[key];review.append({'inputId':row['id'],'workId':wid,'action':'merged; existing recording retained'})
 else:
  wid=row['id'];assert re.fullmatch('[a-z0-9-]{1,80}',wid),wid
  url=row['spotify_search_url'];u=urlparse(url);assert u.scheme=='https' and u.netloc=='open.spotify.com' and u.path.startswith('/search/')
  sid='music-search-'+str(len(sources)+1);assert len(sid)<=80,sid
  sources.append(dict(id=sid,title='Spotify search · '+row['title']+' · '+row['artist'],url=url,checkedAt='2026-10-13',policy='citation-and-facts-only'))
  works.append(dict(id=wid,title=row['title'],creator=row['artist'],kind='song',form='Music',recording='Research selection; exact recording not yet verified.',language='See selected recording',destinationId='paris',description=row['description'],sourceIds=[sid],immersion='unreviewed',relationship=dict(type='about',scope='city',statement='Editorial Paris connection from the supplied music list: '+row['place_lead']+'.',sourceId=sid,review='source_reported'),context=['Music category: '+row['category'], 'Supplied year: '+row['year']+'. Composition, release and performance dates have not been distinguished or independently verified.','Research lead: '+row['related_leads'],'Spotify opens a search, not a verified recording. Paris connections are editorial research leads, not confirmed performance locations.'],listeningLinks=[dict(provider='Spotify search',url=url,sourceId=sid)]))
  lookup[key]=wid;review.append({'inputId':row['id'],'workId':wid,'action':'added as research selection'})
 categories.setdefault(wid,[])
 category=row['category'].split(' — ',1)[-1]
 if category not in categories[wid]:categories[wid].append(category)
(root/'src/lib/culture/music-selection.json').write_text(json.dumps(dict(sources=sources,works=works),ensure_ascii=False,indent=2)+'\n')
(root/'src/lib/culture/music-categories.json').write_text(json.dumps(categories,ensure_ascii=False,indent=2)+'\n')
(root.parent/'editorial/paris-music-input.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
(root.parent/'editorial/paris-music-review.json').write_text(json.dumps(dict(added=len(works),merged=len(rows)-len(works),notes='Source keys and verification statuses are supplied labels; no source bibliography or exact Spotify recordings were provided.',entries=review),ensure_ascii=False,indent=2)+'\n')
print('Added',len(works),'merged',len(rows)-len(works))
