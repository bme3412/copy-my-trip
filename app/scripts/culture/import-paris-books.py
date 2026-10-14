"""Reconcile the supplied reading list against reviewed Open Library search matches.
Usage: python3 scripts/culture/import-paris-books.py MATCHES EXISTING
Search metadata is collected offline; visitors never trigger title searches.
"""
import json,re,sys,unicodedata
from pathlib import Path
root=Path(__file__).resolve().parents[3]
rows=json.loads((root/'editorial/paris-books-input.json').read_text())
matches=json.loads(Path(sys.argv[1]).read_text());existing=json.loads(Path(sys.argv[2]).read_text())
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
aliases={'Notre-Dame de Paris (The Hunchback of Notre-Dame)':'the-hunchback-of-notre-dame','The Seine: The River That Made Paris':'the-seine'}
sources=[];works=[];covers={};pending=[];merged=[]
for n,row in enumerate(rows,1):
 title=row['title'];author=row['author'];base=re.sub(r'\s*\(.*?\)','',title).split(':')[0]
 old=next((w for w in existing if w['id']==aliases.get(title) or norm(w['title'])==norm(title)),None)
 wid=old['id'] if old else re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',title).encode('ascii','ignore').decode().lower()).strip('-')[:80].rstrip('-')
 candidates=matches.get(title,[])
 # Do not accept a different book merely because a search ranked it first.
 def titlekey(t):return norm(re.sub(r'^(the|a|an) ', '',t.lower()))
 def authorok(a):return sorted(re.findall(r'[a-z]+',unicodedata.normalize('NFKD',a).encode('ascii','ignore').decode().lower()))==sorted(re.findall(r'[a-z]+',unicodedata.normalize('NFKD',author.split(' and ')[0].split(' with ')[0].replace(' (editor)','')).encode('ascii','ignore').decode().lower())) or norm(a) in norm(author)
 valid=[d for d in candidates if titlekey(d.get('title','')) in [titlekey(base),titlekey(title)] and any(authorok(a) for a in d.get('author_name',[]))]
 if not valid:pending.append(dict(**row,existingId=old['id'] if old else None,reason='Cover match requires review; imported with typographic fallback'))
 d=valid[0] if valid else None
 art=next((x for x in valid if x.get('cover_i') and x.get('cover_edition_key')),None)
 if art:covers[wid]=dict(coverId=art['cover_i'],editionId=art['cover_edition_key'],workKey=art['key'],title=art['title'],authors=art['author_name'],checkedAt='2026-10-13')
 if old:merged.append(wid);continue
 sid='book-import-'+str(n);url='https://openlibrary.org'+d['key'] if d else row['url']
 sources.append(dict(id=sid,title='Open Library · '+d['title'] if d else 'Supplied reading list · '+title,url=url,checkedAt='2026-10-13',policy='citation-and-facts-only'))
 note=('Partial Paris connection; substantial settings or subjects extend beyond Paris. ' if row['focus']=='Partial' else 'Paris connection from the supplied reading list. ')+row['places']+'.'
 works.append(dict(id=wid,title=title,creator=author,kind='book',form='Book',language='See linked editions',destinationId='paris',description=row['description'],sourceIds=[sid],relationship=dict(type='about',scope='city',statement=note,sourceId=sid,review='source_reported'),immersion='unreviewed',context=['Selected from the supplied Paris reading list: '+row['theme']+'.','Paris connections and place leads are editorial research notes, not verified scene locations. The linked catalog record or supplied research link provides a starting point for edition research. Publication dates are omitted until verified.'],geography=dict(area='paris_city',note=note,sourceId=sid)))
(root/'app/src/lib/culture/book-selection.json').write_text(json.dumps(dict(sources=sources,works=works),ensure_ascii=False,indent=2)+'\n')
(root/'app/src/lib/culture/book-covers.json').write_text(json.dumps(covers,ensure_ascii=False,indent=2)+'\n')
(root/'editorial/paris-books-review.json').write_text(json.dumps(dict(inputCount=len(rows),added=len(works),merged=merged,covers=len(covers),pending=pending,provenance='User supplied summaries and Paris relevance. Open Library search metadata matched by title and author; cover edition differs from original publication. No publisher search links treated as verified editions.'),ensure_ascii=False,indent=2)+'\n')
print('Added',len(works),'merged',len(merged),'covers',len(covers),'pending',len(pending))
