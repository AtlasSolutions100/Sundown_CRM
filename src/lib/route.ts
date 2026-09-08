// Route optimizer: nearest-neighbor seed + 2-opt improvement over lat/lng.
// Same approach the Bison CRM uses server-side; here it runs in the browser.

export interface Stop {
  id: string;
  lat: number;
  lng: number;
}

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const toRad = (d: number) => (d * Math.PI) / 180;

export function optimizeRoute(start: { lat: number; lng: number }, stops: Stop[]): Stop[] {
  if (stops.length <= 1) return stops;
  const remaining = [...stops];
  const ordered: Stop[] = [];
  let cur = start;
  while (remaining.length) {
    let bi = 0;
    let bd = Infinity;
    remaining.forEach((s, i) => {
      const d = haversineMiles(cur, s);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const [next] = remaining.splice(bi, 1);
    ordered.push(next);
    cur = next;
  }
  return twoOpt(start, ordered);
}

function routeLength(start: { lat: number; lng: number }, stops: Stop[]) {
  let total = 0;
  let cur = start;
  for (const s of stops) {
    total += haversineMiles(cur, s);
    cur = s;
  }
  return total;
}

function twoOpt(start: { lat: number; lng: number }, route: Stop[]) {
  let best = route;
  let bestLen = routeLength(start, best);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const len = routeLength(start, candidate);
        if (len + 1e-6 < bestLen) {
          best = candidate;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
}

export function totalMiles(start: { lat: number; lng: number }, stops: Stop[]) {
  return Math.round(routeLength(start, stops) * 10) / 10;
}

export function mapsLink(stops: { lat: number; lng: number }[]) {
  if (!stops.length) return '#';
  const dest = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}`;
}
