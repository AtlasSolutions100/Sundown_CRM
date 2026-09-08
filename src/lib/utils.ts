import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let seq = 0;
export function uid(prefix = 'id') {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const money = (n: number, opts: { cents?: boolean } = {}) =>
  n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: opts.cents === false ? 0 : 2,
  });

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export const fmtDate = (iso?: string, f = 'MMM d') => (iso ? format(parseISO(iso), f) : '—');
export const fmtDateLong = (iso?: string) => fmtDate(iso, 'MMM d, yyyy');
export const fmtDateTime = (iso?: string) => fmtDate(iso, 'MMM d, h:mm a');
export const fmtTime = (iso?: string) => fmtDate(iso, 'h:mm a');

export const isoDate = (d: Date) => format(d, 'yyyy-MM-dd');
export const addDaysIso = (iso: string, n: number) => isoDate(addDays(parseISO(iso), n));
export const daysBetween = (fromIso: string, toIso: string) =>
  differenceInCalendarDays(parseISO(toIso), parseISO(fromIso));

export const minutesToHours = (m: number) => `${(m / 60).toFixed(1)}h`;
export const hoursBetween = (aIso: string, bIso: string) =>
  (parseISO(bIso).getTime() - parseISO(aIso).getTime()) / 36e5;

export function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function groupBy<T, K extends string | number>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

export function normalizePhone(s: string) {
  return s.replace(/\D/g, '').replace(/^1(\d{10})$/, '$1');
}
