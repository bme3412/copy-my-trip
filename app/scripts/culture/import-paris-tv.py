import json,re,sys,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parents[2]
existing=json.load(open(sys.argv[2]))['works'];works=[];sources=[];availability={};rows=[];section=''
def slug(s):return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')
for line in Path(sys.argv[1]).read_text().splitlines():
 if line.startswith('## '):section=line[3:]
 if not line.startswith('| ['):continue
 cells=[s.strip() for s in line.strip('|').split('|')]
 match=re.fullmatch(r'\[(.*) \((\d{4})\)\]\((https://[^ ]+)\)',cells[0]);assert match,line
 title,year,url=match.groups();canonical=title.split(' (')[0]
 hit=next((w for w in existing if w['kind']=='tv_show' and slug(w['title'])==slug(canonical)),None)
 wid=hit['id'] if hit else ('tv-'+slug(title)+'-'+year)[:80].rstrip('-')
 assert wid not in availability,wid
 availability[wid]=dict(territory='US',reportedAt='2026-10-13',providers=cells[2],access=cells[3],source=url,category=section)
 rows.append(dict(id=wid,title=title,year=int(year),angle=cells[1],**availability[wid]))
 if hit:continue
 sid='tv-import-'+str(len(works)+1)
 sources.append(dict(id=sid,title='Supplied TV catalog · '+title,url=url,checkedAt='2026-10-13',policy='citation-and-facts-only'))
 episode='episode' in title.lower() or bool(re.search(r'S\d+E\d+',title))
 works.append(dict(id=wid,title=title,creator='Creator not listed',kind='tv_show',year=int(year),yearLabel='Series began',series=dict(start=int(year),sourceId=sid),form='TV episode' if episode else 'TV series',language='See listing',destinationId='paris',description=cells[1]+'.',sourceIds=[sid],immersion='unreviewed',relationship=dict(type='about',scope='city',statement='Paris connection from the supplied television catalog: '+cells[1]+'.',sourceId=sid,review='source_reported'),context=['Editorial category: '+section,'Supplied listing year: '+year+'. This may identify the series rather than the individual episode.','The supplied list reports U.S. availability on October 13, 2026. Recheck the linked listing for current providers, seasons and access terms.'],geography=dict(area='greater_paris' if any(x in title for x in ['Versailles','Marie Antoinette','La Mante']) else 'paris_city',note='Paris-related selection; the story may extend beyond the city. '+cells[1],sourceId=sid)))
(root/'src/lib/culture/tv-selection.json').write_text(json.dumps(dict(sources=sources,works=works),ensure_ascii=False,indent=2)+'\n')
(root/'src/lib/culture/tv-availability.json').write_text(json.dumps(availability,ensure_ascii=False,indent=2)+'\n')
(root.parent/'editorial/paris-tv-input.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print('Listings',len(rows),'added',len(works),'merged',len(rows)-len(works))
