import { mediaUrl } from '../src/lib/media'

function expect(actual: string, expected: string): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`)
}

expect(mediaUrl('paris', 'plate.jpeg', ''), '/media/paris/plate.jpeg')
expect(mediaUrl('paris', 'plate.jpeg', 'https://cdn.example.com'), 'https://cdn.example.com/media/paris/plate.jpeg')
expect(mediaUrl('paris', '/plate.jpeg', 'https://cdn.example.com/'), 'https://cdn.example.com/media/paris/plate.jpeg')

console.log('media URL checks: 3 PASS')
