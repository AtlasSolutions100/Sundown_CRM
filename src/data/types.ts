// Domain model for Sundown Lawn & Irrigation CRM prototype.
// Mirrors the naming used in the Bison CRM schema where the concepts overlap
// (clients, services, packages, jobs, invoices, payments, tickets) so a later
// port onto that backend is mechanical.

export type Role = 'owner' | 'ops' | 'foreman' | 'crew';
export type Division = 'maintenance' | 'irrigation' | 'installs' | 'backflow';

export interface TeamMember {
  id: string;
  name: string;
  role: Role;
  crewId?: string;
  phone: string;
  email: string;
  hourlyCost: number; // loaded labor cost per hour
  testerLicense?: string; // backflow tester certification #
  homeLat: number;
  homeLng: number;
}

export interface Crew {
  id: string;
  name: string;
  division: Division;
  color: string; // tailwind-friendly hsl string
  leadId: string;
}

export type ClientType = 'hoa' | 'residential' | 'commercial';
export type ClientStatus = 'lead' | 'active' | 'former';

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  contactName: string;
  phone: string;
  altPhones: string[];
  email: string;
  billingEmail?: string;
  address: string;
  notes: string;
  tags: string[];
  termYears: 1 | 3 | 5;
  contractSince: string; // ISO date
  createdAt: string;
}

export interface Property {
  id: string;
  clientId: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  turfSqft: number;
  bedSqft: number;
  zones: number;
  gateCode?: string;
  purveyorId?: string;
  notes?: string;
}

export type BackflowType = 'PVB' | 'RP' | 'DC';

export interface BackflowDevice {
  id: string;
  propertyId: string;
  make: string;
  model: string;
  type: BackflowType;
  size: string; // e.g. 1"
  serial: string;
  location: string;
  hazard: 'irrigation' | 'fire' | 'domestic';
  installYear: number;
  purveyorId: string;
  purveyorAccountNo?: string;
}

export interface BackflowReadings {
  // PVB
  airInletOpenedPsid?: number;
  checkValveHeldPsid?: number;
  // RP
  cv1Psid?: number;
  cv2Tight?: boolean;
  reliefOpenedPsid?: number;
  // DC
  dcCv1Psid?: number;
  dcCv2Psid?: number;
  linePsi?: number;
}

export interface BackflowTest {
  id: string;
  deviceId: string;
  jobId?: string;
  date: string;
  testerId: string;
  gaugeSerial: string;
  gaugeCalDate: string;
  result: 'pass' | 'fail';
  readings: BackflowReadings;
  repairs?: string;
  notes?: string;
  sentToPurveyorAt?: string;
}

export interface Purveyor {
  id: string;
  name: string;
  email: string;
  phone: string;
  submitMethod: 'email' | 'portal' | 'fax';
  portalUrl?: string;
  notes?: string;
}

export type PricingUnit = 'turf' | 'bed' | 'zones' | 'flat' | 'device' | 'hourly';

export interface ServicePricing {
  unit: PricingUnit;
  tripFee: number; // David's "first number": truck/overhead per visit
  ratePer1000Sqft?: number; // David's "second number": mower/labor per 1000 sqft
  ratePerUnit?: number; // per zone / per device
  flat?: number;
  hourlyRate?: number;
}

export interface Occurrence {
  label: string; // e.g. "Round 3"
  start: string; // MM-DD
  end: string; // MM-DD
}

export interface Service {
  id: string;
  name: string;
  division: Division;
  category: 'routine' | 'nonroutine';
  description: string;
  pricing: ServicePricing;
  occurrences: Occurrence[]; // default schedule windows in a season
  estMinutesPer1000Sqft?: number;
  estMinutesFlat?: number;
  color: string;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  serviceIds: string[];
  autoRenew: boolean;
}

export interface ContractLine {
  id: string;
  serviceId: string;
  label: string;
  windowStart: string; // ISO date
  windowEnd: string; // ISO date
  price: number;
}

export interface Contract {
  id: string;
  clientId: string;
  propertyId: string;
  year: number;
  packageId?: string;
  status: 'draft' | 'active' | 'expired';
  termYears: 1 | 3 | 5;
  startDate: string;
  endDate: string;
  lines: ContractLine[];
  signedAt?: string;
}

export type JobStatus = 'unscheduled' | 'scheduled' | 'en_route' | 'in_progress' | 'done' | 'skipped' | 'weather_hold';
export type JobSource = 'contract' | 'ticket' | 'estimate' | 'manual';

export interface PartUsage {
  partId: string;
  qty: number;
}

export interface Job {
  id: string;
  propertyId: string;
  clientId: string;
  serviceId: string;
  division: Division;
  title: string;
  source: JobSource;
  contractLineId?: string;
  ticketId?: string;
  estimateId?: string;
  status: JobStatus;
  windowStart: string;
  windowEnd: string;
  scheduledDate?: string;
  crewId?: string;
  routeOrder?: number;
  price: number;
  completedAt?: string;
  laborMinutes?: number;
  partsUsed: PartUsage[];
  notes: string;
  invoiceId?: string;
  urgent?: boolean;
}

export type TicketSource = 'call' | 'text' | 'email' | 'field' | 'voice' | 'web';
export type TicketStage = 'new' | 'needs_bid' | 'bid_sent' | 'approved' | 'scheduled' | 'complete' | 'invoiced' | 'closed';

export interface TimelineEntry {
  at: string;
  who: string;
  text: string;
}

export interface Ticket {
  id: string;
  number: number;
  clientId?: string;
  propertyId?: string;
  title: string;
  description: string;
  source: TicketSource;
  priority: 'low' | 'normal' | 'urgent';
  stage: TicketStage;
  division: Division;
  createdAt: string;
  createdBy: string;
  estimateId?: string;
  jobId?: string;
  assigneeId?: string;
  needsBid: boolean;
  timeline: TimelineEntry[];
}

export type EstimateLineKind = 'service' | 'part' | 'labor' | 'info';

export interface EstimateLine {
  id: string;
  kind: EstimateLineKind;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  serviceId?: string;
  partId?: string;
}

export interface Estimate {
  id: string;
  number: number;
  clientId: string;
  propertyId: string;
  ticketId?: string;
  title: string;
  status: 'draft' | 'sent' | 'approved' | 'declined';
  lines: EstimateLine[];
  notes: string;
  createdAt: string;
  sentAt?: string;
  approvedAt?: string;
  validDays: number;
}

export interface EstimateTemplate {
  id: string;
  name: string;
  division: Division;
  lines: Omit<EstimateLine, 'id'>[];
}

export interface Part {
  id: string;
  sku: string;
  name: string;
  category: string;
  cost: number;
  markupPct: number;
  supplier: 'SiteOne' | 'Home Depot' | 'Other';
  unit: string;
  lastPriceCheck: string;
}

export interface WorkOrder {
  id: string;
  number: number;
  jobId?: string;
  ticketId?: string;
  propertyId: string;
  clientId: string;
  date: string;
  techId: string;
  timeIn: string; // HH:mm
  timeOut: string; // HH:mm
  laborRate: number;
  parts: PartUsage[];
  workPerformed: string;
  status: 'open' | 'submitted' | 'invoiced';
  invoiceId?: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  jobId?: string;
  workOrderId?: string;
}

export type InvoiceStatus = 'pending_approval' | 'sent' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: string;
  number: number;
  clientId: string;
  propertyId?: string;
  lines: InvoiceLine[];
  status: InvoiceStatus;
  createdAt: string;
  sentAt?: string;
  dueDate: string;
  paidAt?: string;
  remindersSent: number;
  autoGenerated: boolean;
  sourceLabel: string; // "Auto: 4 mowings + 1 fert app (Aug)"
  division: Division;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: 'check' | 'card' | 'ach' | 'cash' | 'venmo';
  date: string;
  reference?: string;
}

export type Channel = 'text' | 'email' | 'call' | 'voice_note' | 'internal';

export interface Message {
  id: string;
  clientId?: string;
  propertyId?: string;
  direction: 'in' | 'out';
  channel: Channel;
  from: string;
  to: string;
  body: string;
  at: string;
  ticketId?: string;
  read: boolean;
}

export interface Visit {
  propertyId: string;
  arrive: string; // ISO datetime
  depart: string; // ISO datetime
  jobIds: string[];
  source: 'geofence' | 'manual';
}

export interface TimeEntry {
  id: string;
  memberId: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  visits: Visit[];
  syncedToQuickBooks: boolean;
}

export interface WeatherRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
  divisions: Division[];
}

export interface CompanySettings {
  name: string;
  legalName: string;
  phone: string;
  serviceLine: string;
  email: string;
  address: string;
  city: string;
  timezone: string;
  taxRate: number;
  defaultMarkupPct: number;
  billableTargetPct: number;
  invoiceAutoSend: boolean;
  invoiceApprovalsCount: number;
  invoiceApprovalsToTrust: number;
  reminderAfterDays: number;
  escalateAfterDays: number;
  quickBooksConnected: boolean;
  geofenceRadiusM: number;
  weatherRules: WeatherRule[];
}

export interface AppData {
  version: number;
  today: string; // ISO date used as "now" for the demo
  settings: CompanySettings;
  team: TeamMember[];
  crews: Crew[];
  clients: Client[];
  properties: Property[];
  purveyors: Purveyor[];
  backflowDevices: BackflowDevice[];
  backflowTests: BackflowTest[];
  services: Service[];
  packages: Package[];
  contracts: Contract[];
  jobs: Job[];
  tickets: Ticket[];
  estimates: Estimate[];
  estimateTemplates: EstimateTemplate[];
  parts: Part[];
  workOrders: WorkOrder[];
  invoices: Invoice[];
  payments: Payment[];
  messages: Message[];
  timeEntries: TimeEntry[];
  knownContacts: Record<string, string>; // phone/email -> clientId
  counters: { ticket: number; estimate: number; invoice: number; workOrder: number };
}
