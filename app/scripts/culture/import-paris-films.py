"""Import the user-supplied film research list without treating search URLs as verified film pages."""
import json,re,unicodedata,sys
from pathlib import Path
root=Path(__file__).resolve().parents[3]
rows=json.loads((root/'editorial/paris-films-input.json').read_text())
existing=json.loads(Path(sys.argv[1]).read_text())
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
sources=[];works=[];merged=[];mapping=[]
for i,r in enumerate(rows,1):
 title=re.sub(r'\s*\(.*?\)','',r['title']).strip();year=int(r['year'])
 old=next((w for w in existing if w['kind']=='film' and w['year']==year and norm(w['title'])==norm(title)),None)
 if old:merged.append(old['id']);mapping.append(dict(title=r['title'],year=year,id=old['id']));continue
 slug=re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',title).encode('ascii','ignore').decode().lower()).strip('-')
 wid='film-'+slug[:64].rstrip('-')+'-'+str(year);sid='film-import-'+str(i)
 mapping.append(dict(title=r['title'],year=year,id=wid))
 sources.append(dict(id=sid,title=('Supplied film reference · ' if r['linkType']=='Film page' else 'Research search · ')+r['title'],url=r['url'],checkedAt='2026-10-13',policy='citation-and-facts-only'))
 scope={'Core':'Paris connection','Partial':'Partial Paris connection; the story also extends beyond Paris','Greater Paris':'Greater Paris connection; the suburbs are distinct from central Paris'}[r['scope']]
 note=scope+'. Research lead: '+r['places']+'.'
 works.append(dict(id=wid,title=title,creator=r['director'],kind='film',year=year,yearLabel='Film year',form='Documentary' if r['theme'].startswith('07') else 'Film',language='See film source',destinationId='paris',description=r['description'],sourceIds=[sid],relationship=dict(type='about',scope='city',statement=note,sourceId=sid,review='source_reported'),immersion='unreviewed',context=['From the supplied Paris film research catalog. Release year and director are supplied metadata; distribution dates may vary.','Place leads describe a story connection, not verified filming coordinates. '+('The source is a title search, not a verified film page or streaming offer.' if r['linkType']=='Film search' else 'The supplied reference links to further film research.')],geography=dict(area='greater_paris' if r['scope']=='Greater Paris' else 'paris_city',note=note,sourceId=sid)))
(root/'app/src/lib/culture/film-selection.json').write_text(json.dumps(dict(sources=sources,works=works),ensure_ascii=False,indent=2)+'\n')
(root/'editorial/paris-films-review.json').write_text(json.dumps(dict(inputCount=len(rows),added=len(works),merged=merged,mapping=mapping,reviewedOn='2026-10-13',provenance='User-supplied research, not independent verification of every film or place. Original input retained; generated IMDb searches explicitly labeled; no coordinates imported.'),ensure_ascii=False,indent=2)+'\n')
print('Added',len(works),'merged',len(merged));print(merged)
