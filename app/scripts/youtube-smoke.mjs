import assert from 'node:assert/strict';
import {youtubeTracks, validYouTubeQueue, youtubeWatchUrl, youtubeError} from '../src/lib/culture/youtube.ts';
const ids = ['paris-seveille','sous-le-ciel-de-paris','la-boheme','jai-deux-amours','les-champs-elysees','la-seine','paris-sera-toujours-paris','florence-sur-les-champs-elysees'];
assert.deepEqual(Object.keys(youtubeTracks), ids);
for (const [index,id] of ids.entries()) {
  assert(validYouTubeQueue(ids,index));
  assert.match(youtubeTracks[id].videoId,/^[\w-]{11}$/);
  assert.equal(new URL(youtubeWatchUrl(id)).searchParams.get('v'),youtubeTracks[id].videoId);
}
for (const [queue,index] of [[[],0],[ids,-1],[ids,8],[ids,0.5],[['unknown'],0],[['toString'],0]]) assert.equal(validYouTubeQueue(queue,index),false);
assert.match(youtubeError(101),/Open it on YouTube/);
assert.equal(youtubeError(150),youtubeError(101));
assert.match(youtubeError(100),/no longer available/);
assert.match(youtubeError(153),/verify this browser/);
console.log('YouTube: all eight mappings, queue boundaries, safe URLs, and actionable player errors passed.');
