import type { Part, Property, Service, ServicePricing } from '@/data/types';

/**
 * David's pricing model: a trip fee that absorbs truck/overhead per visit, plus
 * a rate per 1,000 sqft that absorbs equipment/labor. Adjusting the trip fee
 * tracks fuel; adjusting the per-sqft rate tracks mower/labor costs.
 */
export function priceService(pricing: ServicePricing, property: Pick<Property, 'turfSqft' | 'bedSqft' | 'zones'>, qty = 1): number {
  switch (pricing.unit) {
    case 'turf':
      return round2(pricing.tripFee + (pricing.ratePer1000Sqft ?? 0) * (property.turfSqft / 1000));
    case 'bed':
      return round2(pricing.tripFee + (pricing.ratePer1000Sqft ?? 0) * (property.bedSqft / 1000));
    case 'zones':
      return round2(pricing.tripFee + (pricing.ratePerUnit ?? 0) * property.zones);
    case 'device':
      return round2(pricing.tripFee + (pricing.ratePerUnit ?? 0) * qty);
    case 'hourly':
      return round2(pricing.tripFee + (pricing.hourlyRate ?? 0) * qty);
    case 'flat':
    default:
      return round2(pricing.tripFee + (pricing.flat ?? 0));
  }
}

export function pricingSummary(p: ServicePricing): string {
  const trip = p.tripFee ? `$${p.tripFee} trip` : '';
  const parts: string[] = [];
  if (trip) parts.push(trip);
  if (p.unit === 'turf' || p.unit === 'bed') parts.push(`$${p.ratePer1000Sqft} / 1,000 sqft ${p.unit}`);
  if (p.unit === 'zones') parts.push(`$${p.ratePerUnit} / zone`);
  if (p.unit === 'device') parts.push(`$${p.ratePerUnit} / device`);
  if (p.unit === 'hourly') parts.push(`$${p.hourlyRate} / hr`);
  if (p.unit === 'flat') parts.push(`$${p.flat} flat`);
  return parts.join(' + ');
}

export function estimateMinutes(service: Service, property: Pick<Property, 'turfSqft'>): number {
  if (service.estMinutesFlat) return service.estMinutesFlat;
  if (service.estMinutesPer1000Sqft) return Math.max(15, Math.round((property.turfSqft / 1000) * service.estMinutesPer1000Sqft));
  return 30;
}

export function partSellPrice(part: Pick<Part, 'cost' | 'markupPct'>): number {
  return round2(part.cost * (1 + part.markupPct / 100));
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
