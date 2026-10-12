// Offline review packet, not an approval or publishing tool. No provider calls.
import { cultureCatalog } from '../../src/lib/culture/seed';
import { createHash } from 'node:crypto';
console.log(JSON.stringify({revision:cultureCatalog.revision,proposalHash:createHash('sha256').update(JSON.stringify(cultureCatalog)).digest('hex'),publicationScope:'source-attributed factual preview; no curator endorsement',works:cultureCatalog.works.map(w=>({id:w.id,title:w.title,claim:w.relationship.statement,scope:w.relationship.scope,source:cultureCatalog.sources.find(s=>s.id===w.relationship.sourceId),curatorDecision:'pending',immersion:'unreviewed'}))},null,2));
