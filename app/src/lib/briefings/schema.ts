import type { FrozenStop } from '../trips/schema';
import type { WeatherRecord } from '../conditions/weather';
export interface Briefing {
    schemaVersion: 1;
    id: string;
    planId: string;
    tripId: string;
    cityId: string;
    cityName: string;
    date: string;
    timeZone: string;
    acceptedAt: string;
    title: string;
    purpose: string;
    status: 'before' | 'active' | 'empty' | 'travel' | 'completed';
    demo: boolean;
    stops: FrozenStop[];
    warnings: string[];
    firsthand: number;
    conditions: 'Weather and live operational updates are not connected.';
    weather?: WeatherRecord;
}
/** Accept only web links or same-origin paths; no protocol-relative URLs. */
export function safeUrl(value: string): string | undefined {
    if (/[\u0000-\u0020\\]/.test(value))
        return undefined;
    if (value.startsWith('/') && !value.startsWith('//'))
        return value;
    try {
        const u = new URL(value);
        return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : undefined;
    }
    catch {
        return undefined;
    }
}
export function escapeHtml(value: unknown): string {
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
