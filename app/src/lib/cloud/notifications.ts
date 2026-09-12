export async function notificationRequest<T>(token: string, query: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/notifications${query}`, { method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(typeof error.error === 'string' ? error.error : 'Itinerary email is unavailable.'); }
  return response.json();
}
