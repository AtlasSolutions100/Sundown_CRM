import type {
  AppData, BackflowDevice, BackflowTest, Client, Contract, ContractLine, Crew, Estimate, EstimateTemplate,
  Invoice, InvoiceLine, Job, Message, Package, Part, Payment, Property, Purveyor, Service, TeamMember,
  Ticket, TimeEntry, WorkOrder, Division,
} from './types';
import { priceService, estimateMinutes, partSellPrice } from '@/lib/pricing';
import { addDays, format, parseISO, getDay } from 'date-fns';

const TODAY = '2026-09-08'; // Tuesday
const YEAR = 2026;

// Deterministic PRNG so the demo looks the same on every reset.
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260908);
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const md = (mmdd: string) => `${YEAR}-${mmdd}`;

// ---------------------------------------------------------------- team
const team: TeamMember[] = [
  { id: 'tm_david', name: 'David Ramsey', role: 'owner', phone: '(208) 518-7655', email: 'david@sundownlawnandirrigation.com', hourlyCost: 45, testerLicense: 'ID-BAT-04471', homeLat: 47.7127, homeLng: -116.9516 },
  { id: 'tm_marcus', name: 'Marcus Hale', role: 'foreman', crewId: 'crew_maint', phone: '(208) 555-0142', email: 'marcus@sundownlawnandirrigation.com', hourlyCost: 32, homeLat: 47.6989, homeLng: -116.9412 },
  { id: 'tm_tyler', name: 'Tyler Brooks', role: 'crew', crewId: 'crew_maint', phone: '(208) 555-0177', email: 'tyler@sundownlawnandirrigation.com', hourlyCost: 26, homeLat: 47.7255, homeLng: -116.9210 },
  { id: 'tm_jose', name: 'Jose Ramirez', role: 'crew', crewId: 'crew_maint', phone: '(208) 555-0119', email: 'jose@sundownlawnandirrigation.com', hourlyCost: 26, homeLat: 47.7030, homeLng: -116.9601 },
  { id: 'tm_kyle', name: 'Kyle Nguyen', role: 'crew', crewId: 'crew_irr', phone: '(208) 555-0163', email: 'kyle@sundownlawnandirrigation.com', hourlyCost: 30, homeLat: 47.6820, homeLng: -116.7800 },
  { id: 'tm_ben', name: 'Ben Carter', role: 'crew', crewId: 'crew_irr', phone: '(208) 555-0188', email: 'ben@sundownlawnandirrigation.com', hourlyCost: 30, testerLicense: 'ID-BAT-05120', homeLat: 47.7660, homeLng: -116.7860 },
];

const crews: Crew[] = [
  { id: 'crew_maint', name: 'Maintenance Crew', division: 'maintenance', color: '140 40% 34%', leadId: 'tm_marcus' },
  { id: 'crew_irr', name: 'Irrigation Crew', division: 'irrigation', color: '205 60% 42%', leadId: 'tm_kyle' },
];

// ---------------------------------------------------------------- purveyors
const purveyors: Purveyor[] = [
  { id: 'pv_cda', name: "City of Coeur d'Alene Water Dept", email: 'backflow@cdaid.org', phone: '(208) 769-2210', submitMethod: 'email', notes: 'Accepts PDF reports by email. Due by June 30.' },
  { id: 'pv_pf', name: 'City of Post Falls Water Division', email: 'crossconnection@postfalls.gov', phone: '(208) 773-6060', submitMethod: 'email', notes: 'One email per property is fine; include account number.' },
  { id: 'pv_hayden', name: 'Hayden Lake Irrigation District', email: 'office@haydenirrigation.org', phone: '(208) 772-2612', submitMethod: 'email' },
  { id: 'pv_ross', name: 'Ross Point Water District', email: 'rosspointwater@gmail.com', phone: '(208) 773-3310', submitMethod: 'email' },
  { id: 'pv_avondale', name: 'Avondale Irrigation District', email: 'avondaleid@outlook.com', phone: '(208) 772-5657', submitMethod: 'email' },
  { id: 'pv_dalton', name: 'Dalton Gardens Irrigation District', email: 'dgid@daltongardens.org', phone: '(208) 772-3698', submitMethod: 'portal', portalUrl: 'https://backflow.daltongardens.org', notes: 'Portal upload; keep PDF copy.' },
];

// ---------------------------------------------------------------- clients & properties
interface ClientSeed {
  client: Omit<Client, 'altPhones' | 'createdAt' | 'notes' | 'tags'> & Partial<Pick<Client, 'altPhones' | 'notes' | 'tags'>>;
  properties: (Omit<Property, 'clientId'> & { difficulty?: number; devices?: Omit<BackflowDevice, 'id' | 'propertyId' | 'purveyorId'>[] })[];
  packageId?: string;
}

const clientSeeds: ClientSeed[] = [
  {
    client: { id: 'cl_camden', name: 'Camden Place HOA', type: 'hoa', status: 'active', contactName: 'Linda Moreau (Board President)', phone: '(208) 555-2201', email: 'board@camdenplacehoa.org', billingEmail: 'ap@northstarhoamgmt.com', address: '3100 E Camden Pl, Post Falls, ID 83854', termYears: 3, contractSince: '2023-04-01', tags: ['HOA', 'Multi-year', 'Backflow x3'], notes: 'Managed by Northstar HOA Mgmt. Invoices go to AP, board wants a copy. Gate code shared with crew.' },
    packageId: 'pkg_full',
    properties: [
      { id: 'pr_camden1', name: 'Camden Place – Common Areas', address: '3100 E Camden Pl', city: 'Post Falls', lat: 47.7188, lng: -116.9282, turfSqft: 42000, bedSqft: 6800, zones: 18, gateCode: '4471#', purveyorId: 'pv_pf', difficulty: 1.0,
        devices: [
          { make: 'Febco', model: '765-1', type: 'PVB', size: '1"', serial: 'F765-88213', location: 'NE corner by mailbox kiosk', hazard: 'irrigation', installYear: 2016, purveyorAccountNo: 'PF-20441' },
          { make: 'Wilkins', model: '975XL2', type: 'RP', size: '1-1/2"', serial: 'W975-410772', location: 'Clubhouse mech room', hazard: 'irrigation', installYear: 2019, purveyorAccountNo: 'PF-20442' },
          { make: 'Febco', model: '765-1', type: 'PVB', size: '1"', serial: 'F765-91002', location: 'Phase 2 entry monument', hazard: 'irrigation', installYear: 2021, purveyorAccountNo: 'PF-20443' },
        ] },
    ],
  },
  {
    client: { id: 'cl_riverstone', name: 'Riverstone Commons HOA', type: 'hoa', status: 'active', contactName: 'Tom Beckett', phone: '(208) 555-2340', email: 'tbeckett@riverstonecommons.com', address: '2100 N Main St, Coeur d\'Alene, ID 83814', termYears: 1, contractSince: '2025-04-01', tags: ['HOA', 'Renewal due'], notes: 'First full year. Evaluate margin before offering 3-yr term.' },
    packageId: 'pkg_full',
    properties: [
      { id: 'pr_riverstone', name: 'Riverstone Commons', address: '2100 N Main St', city: "Coeur d'Alene", lat: 47.6920, lng: -116.7995, turfSqft: 31000, bedSqft: 9200, zones: 14, purveyorId: 'pv_cda', difficulty: 1.15,
        devices: [
          { make: 'Watts', model: '009M2QT', type: 'RP', size: '1"', serial: 'WT009-33810', location: 'Pool equipment room', hazard: 'irrigation', installYear: 2018, purveyorAccountNo: 'CDA-118820' },
          { make: 'Febco', model: '825Y', type: 'RP', size: '2"', serial: 'F825-55731', location: 'Vault at Main St entrance', hazard: 'irrigation', installYear: 2015, purveyorAccountNo: 'CDA-118821' },
        ] },
    ],
  },
  {
    client: { id: 'cl_prairie', name: 'Prairie Falls Estates HOA', type: 'hoa', status: 'active', contactName: 'Sheila Grant', phone: '(208) 555-2415', email: 'sgrant@prairiefallshoa.org', address: '5400 W Prairie Ave, Post Falls, ID 83854', termYears: 3, contractSince: '2024-04-01', tags: ['HOA', 'Multi-year'], notes: '' },
    packageId: 'pkg_full',
    properties: [
      { id: 'pr_prairie', name: 'Prairie Falls Estates', address: '5400 W Prairie Ave', city: 'Post Falls', lat: 47.7392, lng: -116.9744, turfSqft: 27500, bedSqft: 4100, zones: 12, purveyorId: 'pv_ross', difficulty: 0.95,
        devices: [
          { make: 'Wilkins', model: '720A', type: 'PVB', size: '1"', serial: 'W720-20915', location: 'Entrance sign planter', hazard: 'irrigation', installYear: 2017 },
          { make: 'Wilkins', model: '720A', type: 'PVB', size: '1"', serial: 'W720-20933', location: 'Park / playground', hazard: 'irrigation', installYear: 2017 },
        ] },
    ],
  },
  {
    client: { id: 'cl_hayden', name: 'Hayden Creek Village HOA', type: 'hoa', status: 'active', contactName: 'Rob Delgado', phone: '(208) 555-2588', email: 'rob@haydencreekvillage.org', address: '9800 N Government Way, Hayden, ID 83835', termYears: 1, contractSince: '2026-04-01', tags: ['HOA', 'New 2026'], notes: 'New this season. Board is price sensitive.' },
    packageId: 'pkg_full',
    properties: [
      { id: 'pr_hayden', name: 'Hayden Creek Village', address: '9800 N Government Way', city: 'Hayden', lat: 47.7665, lng: -116.7912, turfSqft: 36000, bedSqft: 7500, zones: 16, purveyorId: 'pv_hayden', difficulty: 1.05,
        devices: [
          { make: 'Febco', model: '765-1', type: 'PVB', size: '1"', serial: 'F765-77120', location: 'Trail head kiosk', hazard: 'irrigation', installYear: 2020 },
          { make: 'Watts', model: '007M1QT', type: 'DC', size: '1-1/2"', serial: 'WT007-61203', location: 'Community garden', hazard: 'irrigation', installYear: 2020 },
        ] },
    ],
  },
  {
    client: { id: 'cl_millriver', name: 'Mill River HOA', type: 'hoa', status: 'active', contactName: 'Dana Whitfield', phone: '(208) 555-2670', email: 'manager@millriverhoa.com', address: '1400 W Mill River Ln, Coeur d\'Alene, ID 83814', termYears: 5, contractSince: '2022-04-01', tags: ['HOA', 'Multi-year'], notes: 'Anchor account. 5-year term through 2027.' },
    packageId: 'pkg_full',
    properties: [
      { id: 'pr_millriver', name: 'Mill River – Riverfront Park', address: '1400 W Mill River Ln', city: "Coeur d'Alene", lat: 47.6885, lng: -116.8210, turfSqft: 58000, bedSqft: 12000, zones: 24, purveyorId: 'pv_cda', difficulty: 1.0,
        devices: [
          { make: 'Febco', model: '825Y', type: 'RP', size: '2"', serial: 'F825-40118', location: 'Pump house', hazard: 'irrigation', installYear: 2014 },
          { make: 'Febco', model: '765-1', type: 'PVB', size: '1"', serial: 'F765-40120', location: 'Dog park', hazard: 'irrigation', installYear: 2014 },
          { make: 'Febco', model: '765-1', type: 'PVB', size: '1"', serial: 'F765-40121', location: 'Boat launch restroom', hazard: 'irrigation', installYear: 2014 },
          { make: 'Wilkins', model: '375XL', type: 'RP', size: '1"', serial: 'W375-88012', location: 'Clubhouse', hazard: 'domestic', installYear: 2022 },
        ] },
    ],
  },
  {
    client: { id: 'cl_sunrise', name: 'Sunrise Terrace Townhomes', type: 'hoa', status: 'active', contactName: 'Pat Okafor', phone: '(208) 555-2733', email: 'pat.okafor@sunriseterrace.org', address: '6200 N 4th St, Dalton Gardens, ID 83815', termYears: 1, contractSince: '2025-04-01', tags: ['HOA', 'Renewal due', 'Steep slopes'], notes: 'Lots of hand-trimming on slopes. Watch labor hours.' },
    packageId: 'pkg_full',
    properties: [
      { id: 'pr_sunrise', name: 'Sunrise Terrace', address: '6200 N 4th St', city: 'Dalton Gardens', lat: 47.7300, lng: -116.7710, turfSqft: 18500, bedSqft: 9800, zones: 11, purveyorId: 'pv_dalton', difficulty: 1.7,
        devices: [
          { make: 'Wilkins', model: '720A', type: 'PVB', size: '1"', serial: 'W720-31877', location: 'Unit 1 side yard', hazard: 'irrigation', installYear: 2012 },
        ] },
    ],
  },
  {
    client: { id: 'cl_lakeside', name: 'Lakeside Dental Group', type: 'commercial', status: 'active', contactName: 'Office Mgr: Bree Hollis', phone: '(208) 555-2810', email: 'office@lakesidedentalcda.com', address: '2020 Lakewood Dr, Coeur d\'Alene, ID 83814', termYears: 1, contractSince: '2024-04-01', tags: ['Commercial'], notes: 'Mow before 8am or after 5pm, patients park on north side.' },
    packageId: 'pkg_full',
    properties: [
      { id: 'pr_lakeside', name: 'Lakeside Dental', address: '2020 Lakewood Dr', city: "Coeur d'Alene", lat: 47.6790, lng: -116.7860, turfSqft: 6500, bedSqft: 2200, zones: 6, purveyorId: 'pv_cda', difficulty: 0.9,
        devices: [{ make: 'Febco', model: '765-1', type: 'PVB', size: '3/4"', serial: 'F765-12980', location: 'West wall', hazard: 'irrigation', installYear: 2011 }] },
    ],
  },
  {
    client: { id: 'cl_ironwood', name: 'Ironwood Office Park', type: 'commercial', status: 'active', contactName: 'Property Mgr: Sam Reyes', phone: '(208) 555-2905', email: 'sreyes@ironwoodcre.com', address: '1500 Ironwood Dr, Coeur d\'Alene, ID 83814', termYears: 3, contractSince: '2025-04-01', tags: ['Commercial', 'Multi-year'], notes: '' },
    packageId: 'pkg_full',
    properties: [
      { id: 'pr_ironwood', name: 'Ironwood Office Park', address: '1500 Ironwood Dr', city: "Coeur d'Alene", lat: 47.6963, lng: -116.7745, turfSqft: 22000, bedSqft: 5600, zones: 10, purveyorId: 'pv_cda', difficulty: 1.0,
        devices: [
          { make: 'Watts', model: '009M2QT', type: 'RP', size: '1-1/4"', serial: 'WT009-51022', location: 'Bldg A mech room', hazard: 'irrigation', installYear: 2016 },
          { make: 'Watts', model: '009M2QT', type: 'RP', size: '1-1/4"', serial: 'WT009-51023', location: 'Bldg B mech room', hazard: 'irrigation', installYear: 2016 },
        ] },
    ],
  },
  {
    client: { id: 'cl_henderson', name: 'Mark & Julie Henderson', type: 'residential', status: 'active', contactName: 'Julie Henderson', phone: '(208) 555-3012', altPhones: ['(208) 555-3013'], email: 'julie.henderson@gmail.com', address: '11250 N Strahorn Rd, Hayden, ID 83835', termYears: 1, contractSince: '2025-05-01', tags: ['Residential'], notes: 'Dog (Cooper) is friendly. Side gate sticks.' },
    packageId: 'pkg_mow',
    properties: [
      { id: 'pr_henderson', name: 'Henderson Residence', address: '11250 N Strahorn Rd', city: 'Hayden', lat: 47.7855, lng: -116.7590, turfSqft: 9800, bedSqft: 1800, zones: 8, purveyorId: 'pv_hayden', difficulty: 1.0,
        devices: [{ make: 'Febco', model: '765-1', type: 'PVB', size: '1"', serial: 'F765-66031', location: 'Garage side', hazard: 'irrigation', installYear: 2019 }] },
    ],
  },
  {
    client: { id: 'cl_walsh', name: 'Karen & Bill Walsh', type: 'residential', status: 'active', contactName: 'Karen Walsh', phone: '(208) 555-3140', email: 'kwalsh58@outlook.com', address: '3811 E Fernan Hill Rd, Coeur d\'Alene, ID 83814', termYears: 1, contractSince: '2024-04-01', tags: ['Residential', 'Install lead'], notes: 'Interested in paver patio + trees this fall.' },
    packageId: 'pkg_irr',
    properties: [
      { id: 'pr_walsh', name: 'Walsh Residence', address: '3811 E Fernan Hill Rd', city: "Coeur d'Alene", lat: 47.6710, lng: -116.7420, turfSqft: 12000, bedSqft: 3000, zones: 9, purveyorId: 'pv_cda', difficulty: 1.0,
        devices: [{ make: 'Wilkins', model: '720A', type: 'PVB', size: '1"', serial: 'W720-44519', location: 'Back patio', hazard: 'irrigation', installYear: 2015 }] },
    ],
  },
  {
    client: { id: 'cl_tanaka', name: 'Greg Tanaka', type: 'residential', status: 'active', contactName: 'Greg Tanaka', phone: '(208) 555-3277', email: 'gtanaka@proton.me', address: '780 N Chase Rd, Post Falls, ID 83854', termYears: 1, contractSince: '2026-04-01', tags: ['Residential'], notes: '' },
    packageId: 'pkg_turf',
    properties: [
      { id: 'pr_tanaka', name: 'Tanaka Residence', address: '780 N Chase Rd', city: 'Post Falls', lat: 47.7115, lng: -116.9930, turfSqft: 7200, bedSqft: 900, zones: 6, purveyorId: 'pv_pf', difficulty: 1.0,
        devices: [{ make: 'Febco', model: '765-1', type: 'PVB', size: '3/4"', serial: 'F765-70211', location: 'Front bed', hazard: 'irrigation', installYear: 2018 }] },
    ],
  },
  {
    client: { id: 'cl_church', name: "Coeur d'Alene Bible Church", type: 'commercial', status: 'active', contactName: 'Facilities: Dale Pruitt', phone: '(208) 555-3390', email: 'facilities@cdabible.org', address: '6300 N Ramsey Rd, Coeur d\'Alene, ID 83815', termYears: 1, contractSince: '2025-04-01', tags: ['Commercial'], notes: 'No mowing Sunday mornings or Wednesday evenings.' },
    packageId: 'pkg_mow',
    properties: [
      { id: 'pr_church', name: 'CdA Bible Church', address: '6300 N Ramsey Rd', city: "Coeur d'Alene", lat: 47.7310, lng: -116.8060, turfSqft: 24000, bedSqft: 3200, zones: 12, purveyorId: 'pv_cda', difficulty: 1.0,
        devices: [{ make: 'Febco', model: '825Y', type: 'RP', size: '1-1/2"', serial: 'F825-38870', location: 'Boiler room', hazard: 'irrigation', installYear: 2013 }] },
    ],
  },
  {
    client: { id: 'cl_fieldstone', name: 'Fieldstone Meadows HOA', type: 'hoa', status: 'lead', contactName: 'Nicole Baird', phone: '(208) 555-3455', email: 'nbaird@fieldstonemeadows.org', address: '15800 N Meyer Rd, Rathdrum, ID 83858', termYears: 1, contractSince: '', tags: ['HOA', 'Lead', 'Referral'], notes: 'Referred by Camden Place board. Wants pricing for 2027 full maintenance.' },
    properties: [
      { id: 'pr_fieldstone', name: 'Fieldstone Meadows', address: '15800 N Meyer Rd', city: 'Rathdrum', lat: 47.8120, lng: -116.8990, turfSqft: 33000, bedSqft: 6000, zones: 15, purveyorId: 'pv_avondale', devices: [] },
    ],
  },
  {
    client: { id: 'cl_bluegrass', name: 'Bluegrass Crossing HOA', type: 'hoa', status: 'lead', contactName: 'Jerry Fenn', phone: '(208) 555-3502', email: 'jfenn@bluegrasscrossing.org', address: '4200 W Bluegrass Ln, Post Falls, ID 83854', termYears: 1, contractSince: '', tags: ['HOA', 'Lead'], notes: 'Unhappy with current provider (missed fert rounds).' },
    properties: [
      { id: 'pr_bluegrass', name: 'Bluegrass Crossing', address: '4200 W Bluegrass Ln', city: 'Post Falls', lat: 47.7320, lng: -116.9610, turfSqft: 29000, bedSqft: 5000, zones: 13, purveyorId: 'pv_pf', devices: [] },
    ],
  },
  {
    client: { id: 'cl_pinehurst', name: 'Pinehurst Apartments', type: 'commercial', status: 'former', contactName: 'Regional Mgr', phone: '(208) 555-3611', email: 'pinehurst@apex-res.com', address: '3300 N 15th St, Coeur d\'Alene, ID 83815', termYears: 1, contractSince: '2023-04-01', tags: ['Former'], notes: 'Dropped after 2025 season – slow pay.' },
    properties: [
      { id: 'pr_pinehurst', name: 'Pinehurst Apartments', address: '3300 N 15th St', city: "Coeur d'Alene", lat: 47.7080, lng: -116.7700, turfSqft: 15000, bedSqft: 2500, zones: 9, purveyorId: 'pv_cda', devices: [] },
    ],
  },
];

const clients: Client[] = clientSeeds.map((s) => ({
  altPhones: [],
  notes: '',
  tags: [],
  createdAt: s.client.contractSince || '2026-08-20',
  ...s.client,
}));

const properties: Property[] = [];
const backflowDevices: BackflowDevice[] = [];
const difficulty: Record<string, number> = {};
for (const s of clientSeeds) {
  for (const p of s.properties) {
    const { difficulty: diff, devices, ...prop } = p;
    properties.push({ ...prop, clientId: s.client.id });
    difficulty[prop.id] = diff ?? 1;
    (devices ?? []).forEach((dv, i) => {
      backflowDevices.push({ id: `bf_${prop.id.replace('pr_', '')}_${i + 1}`, propertyId: prop.id, purveyorId: prop.purveyorId ?? 'pv_cda', ...dv });
    });
  }
}

// ---------------------------------------------------------------- services & packages
function weeklyWindows(startMmdd: string, weeks: number) {
  const start = parseISO(md(startMmdd));
  return Array.from({ length: weeks }, (_, i) => {
    const s = addDays(start, i * 7);
    return { label: `Week ${i + 1}`, start: format(s, 'MM-dd'), end: format(addDays(s, 6), 'MM-dd') };
  });
}

const services: Service[] = [
  { id: 'svc_mow', name: 'Weekly Mowing', division: 'maintenance', category: 'routine', description: 'Mow, string trim, edge, blow off hard surfaces.', pricing: { unit: 'turf', tripFee: 28, ratePer1000Sqft: 4.25 }, occurrences: weeklyWindows('04-13', 27), estMinutesPer1000Sqft: 3.2, color: '140 40% 34%' },
  { id: 'svc_fert', name: 'Fertilizer & Weed Control', division: 'maintenance', category: 'routine', description: 'Granular fert + broadleaf weed control. 6-round program.', pricing: { unit: 'turf', tripFee: 35, ratePer1000Sqft: 5.5 }, occurrences: [
    { label: 'Round 1 – Pre-emergent', start: '04-01', end: '04-30' }, { label: 'Round 2', start: '05-01', end: '05-31' }, { label: 'Round 3', start: '06-01', end: '06-30' },
    { label: 'Round 4', start: '07-01', end: '07-31' }, { label: 'Round 5', start: '08-15', end: '09-15' }, { label: 'Round 6 – Winterizer', start: '10-01', end: '10-31' },
  ], estMinutesPer1000Sqft: 1.4, color: '80 45% 38%' },
  { id: 'svc_spring', name: 'Spring Cleanup', division: 'maintenance', category: 'routine', description: 'Debris removal, bed cleanup, first cut, power rake if needed.', pricing: { unit: 'bed', tripFee: 60, ratePer1000Sqft: 55 }, occurrences: [{ label: 'Spring Cleanup', start: '03-20', end: '04-20' }], estMinutesPer1000Sqft: 12, color: '95 45% 40%' },
  { id: 'svc_fall', name: 'Fall Cleanup', division: 'maintenance', category: 'routine', description: 'Leaf removal, bed cutback, final mow.', pricing: { unit: 'bed', tripFee: 60, ratePer1000Sqft: 60 }, occurrences: [{ label: 'Fall Cleanup', start: '10-20', end: '11-20' }], estMinutesPer1000Sqft: 12, color: '28 70% 45%' },
  { id: 'svc_prune', name: 'Shrub Pruning', division: 'maintenance', category: 'routine', description: 'Shape shrubs and hedges, haul debris.', pricing: { unit: 'bed', tripFee: 45, ratePer1000Sqft: 38 }, occurrences: [{ label: 'Pruning 1', start: '06-01', end: '06-30' }, { label: 'Pruning 2', start: '09-01', end: '09-30' }], estMinutesPer1000Sqft: 10, color: '160 30% 40%' },
  { id: 'svc_aerate', name: 'Core Aeration', division: 'maintenance', category: 'routine', description: 'Core aeration of turf areas.', pricing: { unit: 'turf', tripFee: 40, ratePer1000Sqft: 7 }, occurrences: [{ label: 'Fall Aeration', start: '09-01', end: '10-15' }], estMinutesPer1000Sqft: 2.5, color: '50 50% 42%' },
  { id: 'svc_irr_on', name: 'Irrigation Turn-On', division: 'irrigation', category: 'routine', description: 'Pressurize system, set controller, walk all zones, note repairs.', pricing: { unit: 'zones', tripFee: 55, ratePerUnit: 6 }, occurrences: [{ label: 'Spring Turn-On', start: '04-15', end: '05-15' }], estMinutesFlat: 60, color: '205 60% 42%' },
  { id: 'svc_irr_off', name: 'Irrigation Blowout', division: 'irrigation', category: 'routine', description: 'Compressed-air winterization of all zones.', pricing: { unit: 'zones', tripFee: 55, ratePerUnit: 5 }, occurrences: [{ label: 'Fall Blowout', start: '10-01', end: '11-05' }], estMinutesFlat: 45, color: '210 50% 50%' },
  { id: 'svc_backflow', name: 'Backflow Test', division: 'backflow', category: 'routine', description: 'Annual assembly test + report filed with water purveyor.', pricing: { unit: 'device', tripFee: 25, ratePerUnit: 55 }, occurrences: [{ label: 'Annual Test', start: '05-01', end: '06-30' }], estMinutesFlat: 25, color: '190 55% 36%' },
  { id: 'svc_irr_repair', name: 'Irrigation Repair (T&M)', division: 'irrigation', category: 'nonroutine', description: 'Time & materials. Parts at catalog markup.', pricing: { unit: 'hourly', tripFee: 45, hourlyRate: 85 }, occurrences: [], estMinutesFlat: 60, color: '220 55% 45%' },
  { id: 'svc_install', name: 'Install Project', division: 'installs', category: 'nonroutine', description: 'Bid per project: hardscape, planting, irrigation.', pricing: { unit: 'flat', tripFee: 0, flat: 0 }, occurrences: [], estMinutesFlat: 480, color: '24 90% 59%' },
];

const packages: Package[] = [
  { id: 'pkg_full', name: 'Full Maintenance', description: 'Weekly mowing, 6-round turf program, spring/fall cleanup, pruning x2, irrigation turn-on & blowout, annual backflow test.', serviceIds: ['svc_mow', 'svc_fert', 'svc_spring', 'svc_fall', 'svc_prune', 'svc_irr_on', 'svc_irr_off', 'svc_backflow'], autoRenew: true },
  { id: 'pkg_mow', name: 'Mow + Irrigation', description: 'Weekly mowing plus turn-on, blowout and backflow test.', serviceIds: ['svc_mow', 'svc_irr_on', 'svc_irr_off', 'svc_backflow'], autoRenew: true },
  { id: 'pkg_turf', name: 'Turf Care Program', description: '6-round fertilizer & weed control plus fall aeration.', serviceIds: ['svc_fert', 'svc_aerate', 'svc_backflow'], autoRenew: true },
  { id: 'pkg_irr', name: 'Irrigation Season', description: 'Turn-on, blowout and backflow test only.', serviceIds: ['svc_irr_on', 'svc_irr_off', 'svc_backflow'], autoRenew: true },
];

// ---------------------------------------------------------------- parts (SiteOne price list)
const parts: Part[] = [
  { id: 'pt_1804', sku: 'RB-1804', name: 'Rain Bird 1804 4" Pop-Up Spray Body', category: 'Spray Heads', cost: 3.18, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_1806', sku: 'RB-1806', name: 'Rain Bird 1806 6" Pop-Up Spray Body', category: 'Spray Heads', cost: 4.62, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_van', sku: 'RB-15VAN', name: 'Rain Bird VAN Adjustable Nozzle 15\'', category: 'Nozzles', cost: 1.45, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_mp', sku: 'HU-MP2000', name: 'Hunter MP Rotator MP2000', category: 'Nozzles', cost: 6.90, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_pgp', sku: 'HU-PGP-ADJ', name: 'Hunter PGP Ultra Rotor 4"', category: 'Rotors', cost: 9.75, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_5004', sku: 'RB-5004', name: 'Rain Bird 5004 Rotor 4"', category: 'Rotors', cost: 10.40, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_pgv', sku: 'HU-PGV-101G', name: 'Hunter PGV 1" Valve w/ Flow Control', category: 'Valves', cost: 18.20, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_solenoid', sku: 'HU-458200', name: 'Hunter Solenoid 24VAC', category: 'Valves', cost: 11.30, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_diaphragm', sku: 'RB-DVDIA', name: 'Rain Bird DV Diaphragm Kit', category: 'Valves', cost: 6.10, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_swing', sku: 'SJ-12', name: 'Swing Joint Assembly 1/2" x 12"', category: 'Fittings', cost: 2.85, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_funny', sku: 'FP-100', name: 'Funny Pipe / Swing Pipe', category: 'Fittings', cost: 0.32, markupPct: 50, supplier: 'SiteOne', unit: 'ft', lastPriceCheck: '2026-08-30' },
  { id: 'pt_coup1', sku: 'PVC-429-010', name: '1" PVC Slip Coupling Sch 40', category: 'Fittings', cost: 0.68, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_tee1', sku: 'PVC-401-010', name: '1" PVC Tee Sch 40', category: 'Fittings', cost: 1.05, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_pvc1', sku: 'PVC-CL200-1', name: '1" PVC Pipe CL200', category: 'Pipe', cost: 0.58, markupPct: 50, supplier: 'SiteOne', unit: 'ft', lastPriceCheck: '2026-08-30' },
  { id: 'pt_drip', sku: 'RB-XFD0612', name: 'Rain Bird XF Dripline 0.6gph 12"', category: 'Drip', cost: 0.41, markupPct: 50, supplier: 'SiteOne', unit: 'ft', lastPriceCheck: '2026-08-30' },
  { id: 'pt_emitter', sku: 'RB-XB10PC', name: 'Rain Bird Xeri-Bug 1.0gph Emitter', category: 'Drip', cost: 0.38, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_proc', sku: 'HU-PC-401', name: 'Hunter Pro-C Controller 4-Station (exp)', category: 'Controllers', cost: 148.00, markupPct: 40, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_rainsensor', sku: 'HU-RAINCLIK', name: 'Hunter Rain-Clik Sensor', category: 'Controllers', cost: 31.50, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_pvb1', sku: 'FE-765-1', name: 'Febco 765 1" PVB Assembly', category: 'Backflow', cost: 112.00, markupPct: 40, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_pvbkit', sku: 'FE-905-212', name: 'Febco 765 1" Bonnet & Poppet Kit', category: 'Backflow', cost: 27.40, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
  { id: 'pt_wire', sku: 'WIRE-18-7', name: '18/7 Irrigation Wire', category: 'Wire', cost: 0.44, markupPct: 50, supplier: 'SiteOne', unit: 'ft', lastPriceCheck: '2026-08-30' },
  { id: 'pt_valvebox', sku: 'VB-10RND', name: '10" Round Valve Box w/ Lid', category: 'Boxes', cost: 9.90, markupPct: 50, supplier: 'SiteOne', unit: 'ea', lastPriceCheck: '2026-08-30' },
];

// ---------------------------------------------------------------- contracts & jobs
const contracts: Contract[] = [];
const jobs: Job[] = [];
let jobSeq = 1;

// Deliberate gaps so the completion audit has something to surface.
const MISSED: Record<string, string[]> = {
  pr_hayden: ['svc_fert:Round 4'],
  pr_sunrise: ['svc_prune:Pruning 1'],
  pr_riverstone: ['svc_fert:Round 3'],
  pr_lakeside: ['svc_mow:Week 21'],
  pr_prairie: ['svc_backflow:Annual Test'],
  pr_church: ['svc_mow:Week 20'],
};

const thisWeekMonday = '2026-09-07';
const maintScheduleByDay: Record<string, string[]> = {
  '2026-09-07': ['pr_camden1', 'pr_prairie', 'pr_tanaka'],
  '2026-09-08': ['pr_riverstone', 'pr_millriver', 'pr_lakeside', 'pr_ironwood'],
  '2026-09-09': ['pr_hayden', 'pr_henderson', 'pr_sunrise'],
  '2026-09-10': ['pr_church', 'pr_walsh'],
};
function scheduledDayFor(propertyId: string) {
  return Object.entries(maintScheduleByDay).find(([, ids]) => ids.includes(propertyId))?.[0];
}
function dayInWindow(start: string, end: string) {
  const s = parseISO(start);
  const e = parseISO(end);
  const span = Math.max(0, Math.round((e.getTime() - s.getTime()) / 864e5));
  let d = addDays(s, between(0, span));
  if (getDay(d) === 0) d = addDays(d, 1);
  return iso(d);
}

for (const cs of clientSeeds) {
  if (!cs.packageId || cs.client.status !== 'active') continue;
  const pkg = packages.find((p) => p.id === cs.packageId)!;
  for (const p of cs.properties) {
    const property = properties.find((x) => x.id === p.id)!;
    const lines: ContractLine[] = [];
    const deviceCount = backflowDevices.filter((d) => d.propertyId === p.id).length;
    for (const svcId of pkg.serviceIds) {
      const svc = services.find((s) => s.id === svcId)!;
      if (svc.id === 'svc_backflow' && deviceCount === 0) continue;
      const price = priceService(svc.pricing, property, deviceCount);
      svc.occurrences.forEach((occ, i) => {
        const lineId = `cl_${p.id.slice(3)}_${svc.id.slice(4)}_${i + 1}`;
        lines.push({ id: lineId, serviceId: svc.id, label: occ.label, windowStart: md(occ.start), windowEnd: md(occ.end), price });
      });
    }
    const contract: Contract = {
      id: `ct_${p.id.slice(3)}_${YEAR}`,
      clientId: cs.client.id,
      propertyId: p.id,
      year: YEAR,
      packageId: pkg.id,
      status: 'active',
      termYears: cs.client.termYears,
      startDate: `${YEAR}-04-01`,
      endDate: `${YEAR}-11-30`,
      lines,
      signedAt: `${YEAR}-03-${between(2, 20).toString().padStart(2, '0')}`,
    };
    contracts.push(contract);

    for (const line of lines) {
      const svc = services.find((s) => s.id === line.serviceId)!;
      const missed = (MISSED[p.id] ?? []).includes(`${svc.id}:${line.label}`);
      const crewId = svc.division === 'maintenance' ? 'crew_maint' : 'crew_irr';
      const base: Job = {
        id: `job_${jobSeq++}`,
        propertyId: p.id,
        clientId: cs.client.id,
        serviceId: svc.id,
        division: svc.division,
        title: `${svc.name}${svc.occurrences.length > 1 ? ` – ${line.label}` : ''}`,
        source: 'contract',
        contractLineId: line.id,
        status: 'unscheduled',
        windowStart: line.windowStart,
        windowEnd: line.windowEnd,
        price: line.price,
        partsUsed: [],
        notes: '',
      };
      const minutes = Math.round(estimateMinutes(svc, property) * difficulty[p.id] * (svc.division === 'maintenance' ? 2.4 : 1.6));
      if (line.windowEnd < TODAY && !missed) {
        const day = dayInWindow(line.windowStart, line.windowEnd);
        Object.assign(base, { status: 'done', scheduledDate: day, completedAt: `${day}T${between(7, 15).toString().padStart(2, '0')}:${pick(['05', '20', '40', '55'])}:00`, crewId, laborMinutes: minutes });
      } else if (line.windowEnd < TODAY && missed) {
        // left unscheduled -> shows as behind
      } else if (line.windowStart <= TODAY && line.windowEnd >= TODAY) {
        if (svc.id === 'svc_mow') {
          const day = scheduledDayFor(p.id);
          if (day && day < TODAY) {
            Object.assign(base, { status: 'done', scheduledDate: day, completedAt: `${day}T10:30:00`, crewId, laborMinutes: minutes });
          } else if (day === TODAY) {
            const order = maintScheduleByDay[day].indexOf(p.id);
            Object.assign(base, { status: order === 0 ? 'done' : order === 1 ? 'in_progress' : 'scheduled', scheduledDate: day, crewId, routeOrder: order + 1, ...(order === 0 ? { completedAt: `${day}T09:10:00`, laborMinutes: minutes } : {}) });
          } else if (day) {
            Object.assign(base, { status: 'scheduled', scheduledDate: day, crewId, routeOrder: maintScheduleByDay[day].indexOf(p.id) + 1 });
          }
        } else if (svc.id === 'svc_fert' && ['pr_camden1', 'pr_millriver', 'pr_ironwood'].includes(p.id)) {
          const day = p.id === 'pr_camden1' ? '2026-09-09' : p.id === 'pr_millriver' ? '2026-09-10' : '2026-09-11';
          Object.assign(base, { status: 'scheduled', scheduledDate: day, crewId, routeOrder: 9 });
        } else if (svc.id === 'svc_fert' && ['pr_prairie', 'pr_lakeside'].includes(p.id)) {
          const day = '2026-08-28';
          Object.assign(base, { status: 'done', scheduledDate: day, completedAt: `${day}T11:00:00`, crewId, laborMinutes: minutes });
        } else if (svc.id === 'svc_prune' && p.id === 'pr_millriver') {
          Object.assign(base, { status: 'scheduled', scheduledDate: '2026-09-11', crewId, routeOrder: 1 });
        } else if (svc.id === 'svc_aerate' && p.id === 'pr_tanaka') {
          Object.assign(base, { status: 'scheduled', scheduledDate: '2026-09-14', crewId, routeOrder: 1 });
        }
      }
      jobs.push(base);
    }
  }
}

// ---------------------------------------------------------------- backflow tests for done test jobs
const backflowTests: BackflowTest[] = [];
for (const j of jobs.filter((j) => j.serviceId === 'svc_backflow' && j.status === 'done')) {
  const devices = backflowDevices.filter((d) => d.propertyId === j.propertyId);
  devices.forEach((dv, i) => {
    const fail = dv.id === 'bf_sunrise_1';
    backflowTests.push({
      id: `bt_${dv.id}_${YEAR}`,
      deviceId: dv.id,
      jobId: j.id,
      date: j.scheduledDate!,
      testerId: i % 2 === 0 ? 'tm_david' : 'tm_ben',
      gaugeSerial: 'MT-2000-11893',
      gaugeCalDate: '2026-02-11',
      result: fail ? 'fail' : 'pass',
      readings:
        dv.type === 'PVB'
          ? { airInletOpenedPsid: fail ? 0.6 : +(1.2 + rnd() * 1.5).toFixed(1), checkValveHeldPsid: fail ? 0.4 : +(1.5 + rnd() * 2).toFixed(1), linePsi: between(58, 78) }
          : dv.type === 'RP'
            ? { cv1Psid: +(5.2 + rnd() * 3).toFixed(1), cv2Tight: true, reliefOpenedPsid: +(2.1 + rnd() * 1.2).toFixed(1), linePsi: between(58, 78) }
            : { dcCv1Psid: +(1.2 + rnd() * 2).toFixed(1), dcCv2Psid: +(1.1 + rnd() * 2).toFixed(1), linePsi: between(58, 78) },
      repairs: fail ? 'Poppet worn – replaced bonnet & poppet kit, retested PASS same day.' : undefined,
      sentToPurveyorAt: `${j.scheduledDate}T16:40:00`,
    });
  });
}

// ---------------------------------------------------------------- tickets, estimates, work orders
const estimateTemplates: EstimateTemplate[] = [
  { id: 'tpl_irr_repair', name: 'Irrigation Repair – T&M', division: 'irrigation', lines: [
    { kind: 'service', description: 'Service call / trip fee', qty: 1, unit: 'ea', unitPrice: 45, serviceId: 'svc_irr_repair' },
    { kind: 'labor', description: 'Irrigation technician labor', qty: 1, unit: 'hr', unitPrice: 85 },
    { kind: 'part', description: 'Parts (catalog price, 50% markup)', qty: 1, unit: 'lot', unitPrice: 0 },
    { kind: 'info', description: 'Zone / controller notes', qty: 0, unit: '', unitPrice: 0 },
  ] },
  { id: 'tpl_full', name: 'Full Maintenance Contract', division: 'maintenance', lines: [
    { kind: 'service', description: 'Weekly Mowing (27 visits) – trip fee + per 1,000 sqft', qty: 27, unit: 'visit', unitPrice: 0, serviceId: 'svc_mow' },
    { kind: 'service', description: 'Fertilizer & Weed Control – 6 rounds', qty: 6, unit: 'round', unitPrice: 0, serviceId: 'svc_fert' },
    { kind: 'service', description: 'Spring Cleanup', qty: 1, unit: 'ea', unitPrice: 0, serviceId: 'svc_spring' },
    { kind: 'service', description: 'Fall Cleanup', qty: 1, unit: 'ea', unitPrice: 0, serviceId: 'svc_fall' },
    { kind: 'service', description: 'Shrub Pruning x2', qty: 2, unit: 'ea', unitPrice: 0, serviceId: 'svc_prune' },
    { kind: 'service', description: 'Irrigation Turn-On', qty: 1, unit: 'ea', unitPrice: 0, serviceId: 'svc_irr_on' },
    { kind: 'service', description: 'Irrigation Blowout', qty: 1, unit: 'ea', unitPrice: 0, serviceId: 'svc_irr_off' },
    { kind: 'service', description: 'Backflow Test & Report', qty: 1, unit: 'device', unitPrice: 80, serviceId: 'svc_backflow' },
    { kind: 'info', description: 'Gate code / access notes', qty: 0, unit: '', unitPrice: 0 },
  ] },
  { id: 'tpl_patio', name: 'Install – Paver Patio', division: 'installs', lines: [
    { kind: 'labor', description: 'Excavation & base prep (crew of 3)', qty: 16, unit: 'hr', unitPrice: 95 },
    { kind: 'part', description: 'Pavers (sq ft)', qty: 1, unit: 'sqft', unitPrice: 6.5 },
    { kind: 'part', description: '3/4" minus base + bedding sand', qty: 1, unit: 'yd', unitPrice: 68 },
    { kind: 'part', description: 'Edge restraint + polymeric sand', qty: 1, unit: 'lot', unitPrice: 240 },
    { kind: 'labor', description: 'Paver install & compaction', qty: 24, unit: 'hr', unitPrice: 95 },
    { kind: 'part', description: 'Trees / plant material', qty: 1, unit: 'ea', unitPrice: 0 },
    { kind: 'info', description: 'Utility locate ticket #', qty: 0, unit: '', unitPrice: 0 },
  ] },
  { id: 'tpl_backflow', name: 'Backflow Test', division: 'backflow', lines: [
    { kind: 'service', description: 'Backflow assembly test + purveyor report', qty: 1, unit: 'device', unitPrice: 80, serviceId: 'svc_backflow' },
    { kind: 'service', description: 'Trip fee', qty: 1, unit: 'ea', unitPrice: 25 },
  ] },
];

const estimates: Estimate[] = [
  { id: 'est_1', number: 1041, clientId: 'cl_walsh', propertyId: 'pr_walsh', ticketId: 'tk_4', title: 'Backyard paver patio (320 sqft) + 3 trees', status: 'sent', validDays: 30, createdAt: '2026-08-26T14:10:00', sentAt: '2026-08-27T09:02:00', notes: 'Price includes haul-off. Trees: 2 Autumn Blaze maple, 1 Colorado spruce (6-7 ft).', lines: [
    { id: 'el_1', kind: 'labor', description: 'Excavation & base prep (crew of 3)', qty: 16, unit: 'hr', unitPrice: 95 },
    { id: 'el_2', kind: 'part', description: 'Pavers – Belgard Dublin Cobble', qty: 320, unit: 'sqft', unitPrice: 6.5 },
    { id: 'el_3', kind: 'part', description: '3/4" minus base + bedding sand', qty: 9, unit: 'yd', unitPrice: 68 },
    { id: 'el_4', kind: 'part', description: 'Edge restraint + polymeric sand', qty: 1, unit: 'lot', unitPrice: 240 },
    { id: 'el_5', kind: 'labor', description: 'Paver install & compaction', qty: 24, unit: 'hr', unitPrice: 95 },
    { id: 'el_6', kind: 'part', description: 'Trees (3) incl. planting & staking', qty: 3, unit: 'ea', unitPrice: 385 },
    { id: 'el_7', kind: 'info', description: 'Utility locate ticket #2026-0819-4471', qty: 0, unit: '', unitPrice: 0 },
  ] },
  { id: 'est_2', number: 1042, clientId: 'cl_henderson', propertyId: 'pr_henderson', ticketId: 'tk_3', title: 'Add drip to new planter beds (2)', status: 'draft', validDays: 30, createdAt: '2026-09-04T16:40:00', notes: '', lines: [
    { id: 'el_8', kind: 'service', description: 'Service call / trip fee', qty: 1, unit: 'ea', unitPrice: 45, serviceId: 'svc_irr_repair' },
    { id: 'el_9', kind: 'labor', description: 'Irrigation technician labor', qty: 3, unit: 'hr', unitPrice: 85 },
    { id: 'el_10', kind: 'part', description: 'Rain Bird XF Dripline 0.6gph 12"', qty: 120, unit: 'ft', unitPrice: partSellPrice(parts.find((p) => p.id === 'pt_drip')!), partId: 'pt_drip' },
    { id: 'el_11', kind: 'part', description: 'Hunter PGV 1" Valve w/ Flow Control', qty: 1, unit: 'ea', unitPrice: partSellPrice(parts.find((p) => p.id === 'pt_pgv')!), partId: 'pt_pgv' },
    { id: 'el_12', kind: 'part', description: '10" Round Valve Box w/ Lid', qty: 1, unit: 'ea', unitPrice: partSellPrice(parts.find((p) => p.id === 'pt_valvebox')!), partId: 'pt_valvebox' },
  ] },
  { id: 'est_3', number: 1043, clientId: 'cl_fieldstone', propertyId: 'pr_fieldstone', ticketId: 'tk_8', title: '2027 Full Maintenance – Fieldstone Meadows', status: 'sent', validDays: 60, createdAt: '2026-09-02T10:00:00', sentAt: '2026-09-02T10:31:00', notes: 'Pricing held through Jan 31, 2027. 3-year term available at 4% discount.', lines: [
    { id: 'el_13', kind: 'service', description: 'Weekly Mowing (27 visits)', qty: 27, unit: 'visit', unitPrice: priceService(services[0].pricing, { turfSqft: 33000, bedSqft: 6000, zones: 15 }), serviceId: 'svc_mow' },
    { id: 'el_14', kind: 'service', description: 'Fertilizer & Weed Control – 6 rounds', qty: 6, unit: 'round', unitPrice: priceService(services[1].pricing, { turfSqft: 33000, bedSqft: 6000, zones: 15 }), serviceId: 'svc_fert' },
    { id: 'el_15', kind: 'service', description: 'Spring Cleanup', qty: 1, unit: 'ea', unitPrice: priceService(services[2].pricing, { turfSqft: 33000, bedSqft: 6000, zones: 15 }), serviceId: 'svc_spring' },
    { id: 'el_16', kind: 'service', description: 'Fall Cleanup', qty: 1, unit: 'ea', unitPrice: priceService(services[3].pricing, { turfSqft: 33000, bedSqft: 6000, zones: 15 }), serviceId: 'svc_fall' },
    { id: 'el_17', kind: 'service', description: 'Shrub Pruning x2', qty: 2, unit: 'ea', unitPrice: priceService(services[4].pricing, { turfSqft: 33000, bedSqft: 6000, zones: 15 }), serviceId: 'svc_prune' },
    { id: 'el_18', kind: 'service', description: 'Irrigation Turn-On + Blowout', qty: 1, unit: 'season', unitPrice: 145 + 130, serviceId: 'svc_irr_on' },
    { id: 'el_19', kind: 'service', description: 'Backflow Test & Report', qty: 2, unit: 'device', unitPrice: 80, serviceId: 'svc_backflow' },
    { id: 'el_20', kind: 'info', description: 'Gate code: TBD', qty: 0, unit: '', unitPrice: 0 },
  ] },
  { id: 'est_4', number: 1040, clientId: 'cl_riverstone', propertyId: 'pr_riverstone', ticketId: 'tk_2', title: 'Repair mainline leak at zone 4 valve box', status: 'approved', validDays: 30, createdAt: '2026-09-01T08:15:00', sentAt: '2026-09-01T08:40:00', approvedAt: '2026-09-01T13:05:00', notes: 'Approved by Tom via text.', lines: [
    { id: 'el_21', kind: 'service', description: 'Service call / trip fee', qty: 1, unit: 'ea', unitPrice: 45, serviceId: 'svc_irr_repair' },
    { id: 'el_22', kind: 'labor', description: 'Irrigation technician labor', qty: 2.5, unit: 'hr', unitPrice: 85 },
    { id: 'el_23', kind: 'part', description: 'Hunter PGV 1" Valve w/ Flow Control', qty: 1, unit: 'ea', unitPrice: partSellPrice(parts.find((p) => p.id === 'pt_pgv')!), partId: 'pt_pgv' },
    { id: 'el_24', kind: 'part', description: '1" PVC Slip Coupling Sch 40', qty: 3, unit: 'ea', unitPrice: partSellPrice(parts.find((p) => p.id === 'pt_coup1')!), partId: 'pt_coup1' },
  ] },
];

// Non-routine jobs created from tickets
const ticketJobs: Job[] = [
  { id: 'job_t2', propertyId: 'pr_riverstone', clientId: 'cl_riverstone', serviceId: 'svc_irr_repair', division: 'irrigation', title: 'Repair mainline leak – zone 4 valve box', source: 'ticket', ticketId: 'tk_2', estimateId: 'est_4', status: 'scheduled', windowStart: TODAY, windowEnd: TODAY, scheduledDate: TODAY, crewId: 'crew_irr', routeOrder: 1, price: 45 + 2.5 * 85, partsUsed: [], notes: 'Shut-off at pool equipment room.' },
  { id: 'job_t5', propertyId: 'pr_lakeside', clientId: 'cl_lakeside', serviceId: 'svc_irr_repair', division: 'irrigation', title: 'Controller not running zones 6–8', source: 'ticket', ticketId: 'tk_5', status: 'done', windowStart: '2026-09-04', windowEnd: '2026-09-04', scheduledDate: '2026-09-04', completedAt: '2026-09-04T15:20:00', crewId: 'crew_irr', price: 45 + 1.5 * 85, laborMinutes: 90, partsUsed: [{ partId: 'pt_solenoid', qty: 2 }, { partId: 'pt_wire', qty: 40 }], notes: 'Two solenoids fried by lightning surge. Recommend surge protector.' },
  { id: 'job_t7', propertyId: 'pr_prairie', clientId: 'cl_prairie', serviceId: 'svc_irr_repair', division: 'irrigation', title: 'Replace broken rotor at entrance', source: 'ticket', ticketId: 'tk_7', status: 'done', windowStart: '2026-08-21', windowEnd: '2026-08-21', scheduledDate: '2026-08-21', completedAt: '2026-08-21T11:05:00', crewId: 'crew_irr', price: 45 + 0.75 * 85, laborMinutes: 45, partsUsed: [{ partId: 'pt_pgp', qty: 1 }, { partId: 'pt_swing', qty: 1 }], notes: '', invoiceId: 'inv_wo7' },
  { id: 'job_t9', propertyId: 'pr_tanaka', clientId: 'cl_tanaka', serviceId: 'svc_irr_repair', division: 'irrigation', title: 'Repair drip line dug up by dog', source: 'ticket', ticketId: 'tk_9', status: 'unscheduled', windowStart: TODAY, windowEnd: '2026-09-12', price: 45 + 1 * 85, partsUsed: [], notes: '' },
  { id: 'job_i1', propertyId: 'pr_ironwood', clientId: 'cl_ironwood', serviceId: 'svc_install', division: 'installs', title: 'Bldg B entry planting refresh', source: 'estimate', status: 'done', windowStart: '2026-06-08', windowEnd: '2026-06-12', scheduledDate: '2026-06-09', completedAt: '2026-06-11T16:00:00', crewId: 'crew_maint', price: 6400, laborMinutes: 2100, partsUsed: [], notes: 'Plants $2,150 cost. Irrigation retrofit included.', invoiceId: 'inv_i1' },
  { id: 'job_i2', propertyId: 'pr_millriver', clientId: 'cl_millriver', serviceId: 'svc_install', division: 'installs', title: 'Dog park irrigation retrofit (MP rotators)', source: 'estimate', status: 'done', windowStart: '2026-07-13', windowEnd: '2026-07-15', scheduledDate: '2026-07-14', completedAt: '2026-07-15T14:30:00', crewId: 'crew_irr', price: 3850, laborMinutes: 1320, partsUsed: [{ partId: 'pt_mp', qty: 42 }, { partId: 'pt_1806', qty: 42 }, { partId: 'pt_swing', qty: 42 }], notes: '', invoiceId: 'inv_i2' },
];
jobs.push(...ticketJobs);

const tickets: Ticket[] = [
  { id: 'tk_1', number: 118, clientId: 'cl_camden', propertyId: 'pr_camden1', title: 'Sprinkler head broken by mailbox kiosk', description: 'Voice ticket from Tyler while mowing: "Job ticket for Camden Place, looks like a sprinkler head is broken by the mailbox kiosk, geysering."', source: 'voice', priority: 'normal', stage: 'new', division: 'irrigation', createdAt: '2026-09-07T10:42:00', createdBy: 'tm_tyler', needsBid: false, timeline: [
    { at: '2026-09-07T10:42:00', who: 'Tyler Brooks', text: 'Created by voice from the truck. Matched "Camden Place" to Camden Place – Common Areas.' },
  ] },
  { id: 'tk_2', number: 115, clientId: 'cl_riverstone', propertyId: 'pr_riverstone', title: 'Leak at zone 4 valve box', description: 'Tom texted photo of standing water around valve box near pool. Mainline likely cracked at valve inlet.', source: 'text', priority: 'urgent', stage: 'scheduled', division: 'irrigation', createdAt: '2026-08-31T18:22:00', createdBy: 'system', estimateId: 'est_4', jobId: 'job_t2', assigneeId: 'tm_kyle', needsBid: true, timeline: [
    { at: '2026-08-31T18:22:00', who: 'System', text: 'Text from (208) 555-2340 auto-filed to Riverstone Commons HOA.' },
    { at: '2026-09-01T08:40:00', who: 'David Ramsey', text: 'Estimate #1040 sent ($395.90).' },
    { at: '2026-09-01T13:05:00', who: 'System', text: 'Client approved estimate via text reply "Approved, go ahead."' },
    { at: '2026-09-01T13:06:00', who: 'System', text: 'Job created and put on Irrigation Crew for Tue Sep 8.' },
  ] },
  { id: 'tk_3', number: 117, clientId: 'cl_henderson', propertyId: 'pr_henderson', title: 'Add drip line to two new planter beds', description: 'Julie emailed: "We put in two new beds along the driveway, can you add drip before winter?"', source: 'email', priority: 'low', stage: 'needs_bid', division: 'irrigation', createdAt: '2026-09-04T09:15:00', createdBy: 'system', estimateId: 'est_2', needsBid: true, timeline: [
    { at: '2026-09-04T09:15:00', who: 'System', text: 'Email from julie.henderson@gmail.com auto-filed to Mark & Julie Henderson.' },
    { at: '2026-09-04T16:40:00', who: 'David Ramsey', text: 'Draft estimate #1042 started from Irrigation Repair template.' },
  ] },
  { id: 'tk_4', number: 112, clientId: 'cl_walsh', propertyId: 'pr_walsh', title: 'Backyard paver patio + 3 trees', description: 'Karen called about a 16x20 patio off the back slider and three shade trees. Wants it done before the ground freezes.', source: 'call', priority: 'normal', stage: 'bid_sent', division: 'installs', createdAt: '2026-08-25T11:30:00', createdBy: 'tm_david', estimateId: 'est_1', needsBid: true, timeline: [
    { at: '2026-08-25T11:30:00', who: 'David Ramsey', text: 'Call logged (7 min). Site visit Aug 26.' },
    { at: '2026-08-27T09:02:00', who: 'David Ramsey', text: 'Estimate #1041 sent ($8,617.00).' },
    { at: '2026-09-03T09:00:00', who: 'System', text: 'Auto follow-up: "Any questions on the patio estimate?" sent by text.' },
  ] },
  { id: 'tk_5', number: 116, clientId: 'cl_lakeside', propertyId: 'pr_lakeside', title: 'Controller not running zones 6–8', description: 'Office called: back beds dry, controller shows fault on zones 6, 7, 8.', source: 'call', priority: 'normal', stage: 'complete', division: 'irrigation', createdAt: '2026-09-03T08:05:00', createdBy: 'tm_marcus', jobId: 'job_t5', assigneeId: 'tm_kyle', needsBid: false, timeline: [
    { at: '2026-09-03T08:05:00', who: 'Marcus Hale', text: 'Call from (208) 555-2810 logged and matched to Lakeside Dental Group.' },
    { at: '2026-09-04T15:20:00', who: 'Kyle Nguyen', text: 'Completed. Work order #2087 submitted: 1.5 hr, 2 solenoids, 40 ft wire.' },
    { at: '2026-09-04T15:21:00', who: 'System', text: 'Invoice drafted from work order – waiting for your approval.' },
  ] },
  { id: 'tk_6', number: 119, clientId: 'cl_millriver', propertyId: 'pr_millriver', title: 'Brown spots along south fence line', description: 'Dana emailed photos. Possibly a stuck rotor or coverage gap on zone 11.', source: 'email', priority: 'normal', stage: 'new', division: 'irrigation', createdAt: '2026-09-07T16:50:00', createdBy: 'system', needsBid: false, timeline: [
    { at: '2026-09-07T16:50:00', who: 'System', text: 'Email from manager@millriverhoa.com auto-filed to Mill River HOA.' },
  ] },
  { id: 'tk_7', number: 109, clientId: 'cl_prairie', propertyId: 'pr_prairie', title: 'Replace broken rotor at entrance', description: 'Jose noticed rotor sheared off at the entrance sign while mowing.', source: 'field', priority: 'low', stage: 'invoiced', division: 'irrigation', createdAt: '2026-08-19T13:00:00', createdBy: 'tm_jose', jobId: 'job_t7', assigneeId: 'tm_ben', needsBid: false, timeline: [
    { at: '2026-08-19T13:00:00', who: 'Jose Ramirez', text: 'Created from the field.' },
    { at: '2026-08-21T11:05:00', who: 'Ben Carter', text: 'Replaced PGP rotor + swing joint. Work order #2081.' },
    { at: '2026-08-21T11:06:00', who: 'System', text: 'Invoice #3122 drafted from work order.' },
    { at: '2026-08-21T17:30:00', who: 'David Ramsey', text: 'Approved & sent invoice #3122 ($127.65).' },
    { at: '2026-08-29T09:00:00', who: 'System', text: 'Paid by check #4471.' },
  ] },
  { id: 'tk_8', number: 114, clientId: 'cl_fieldstone', propertyId: 'pr_fieldstone', title: 'Quote 2027 full maintenance', description: 'Web form: Fieldstone Meadows board requests a proposal for 2027. Referred by Camden Place.', source: 'web', priority: 'normal', stage: 'bid_sent', division: 'maintenance', createdAt: '2026-08-29T20:10:00', createdBy: 'system', estimateId: 'est_3', needsBid: true, timeline: [
    { at: '2026-08-29T20:10:00', who: 'System', text: 'New lead created from website form.' },
    { at: '2026-09-02T10:31:00', who: 'David Ramsey', text: 'Estimate #1043 sent.' },
  ] },
  { id: 'tk_9', number: 120, clientId: 'cl_tanaka', propertyId: 'pr_tanaka', title: 'Dog dug up drip line in front bed', description: 'Greg texted: "Dog got into the front bed, drip line is chewed up in a couple places."', source: 'text', priority: 'normal', stage: 'approved', division: 'irrigation', createdAt: '2026-09-07T19:05:00', createdBy: 'system', jobId: 'job_t9', needsBid: false, timeline: [
    { at: '2026-09-07T19:05:00', who: 'System', text: 'Text from (208) 555-3277 auto-filed to Greg Tanaka.' },
    { at: '2026-09-08T06:55:00', who: 'David Ramsey', text: 'T&M approved by text. Needs scheduling this week.' },
  ] },
  { id: 'tk_10', number: 121, clientId: 'cl_hayden', propertyId: 'pr_hayden', title: 'Tree limb down blocking trail', description: 'Rob called: large cottonwood limb down across the walking trail after last night\'s wind.', source: 'call', priority: 'urgent', stage: 'new', division: 'maintenance', createdAt: '2026-09-08T07:12:00', createdBy: 'tm_david', needsBid: false, timeline: [
    { at: '2026-09-08T07:12:00', who: 'David Ramsey', text: 'Call logged. Marked urgent – safety issue on trail.' },
  ] },
];

const workOrders: WorkOrder[] = [
  { id: 'wo_2081', number: 2081, jobId: 'job_t7', ticketId: 'tk_7', propertyId: 'pr_prairie', clientId: 'cl_prairie', date: '2026-08-21', techId: 'tm_ben', timeIn: '10:20', timeOut: '11:05', laborRate: 85, parts: [{ partId: 'pt_pgp', qty: 1 }, { partId: 'pt_swing', qty: 1 }], workPerformed: 'Replaced sheared PGP rotor at entrance sign, new swing joint, adjusted arc.', status: 'invoiced', invoiceId: 'inv_wo7' },
  { id: 'wo_2087', number: 2087, jobId: 'job_t5', ticketId: 'tk_5', propertyId: 'pr_lakeside', clientId: 'cl_lakeside', date: '2026-09-04', techId: 'tm_kyle', timeIn: '13:50', timeOut: '15:20', laborRate: 85, parts: [{ partId: 'pt_solenoid', qty: 2 }, { partId: 'pt_wire', qty: 40 }], workPerformed: 'Diagnosed open circuit on zones 6–8. Replaced two solenoids, spliced 40 ft of damaged wire. All zones tested.', status: 'submitted' },
  { id: 'wo_2088', number: 2088, jobId: 'job_t2', ticketId: 'tk_2', propertyId: 'pr_riverstone', clientId: 'cl_riverstone', date: TODAY, techId: 'tm_kyle', timeIn: '07:40', timeOut: '', laborRate: 85, parts: [], workPerformed: '', status: 'open' },
];

// ---------------------------------------------------------------- invoices & payments (monthly auto-invoices)
const invoices: Invoice[] = [];
const payments: Payment[] = [];
let invNo = 3001;
const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const svcById = new Map(services.map((s) => [s.id, s]));
const propById = new Map(properties.map((p) => [p.id, p]));

for (const c of clients.filter((c) => c.status === 'active')) {
  for (const ym of months) {
    const monthJobs = jobs.filter((j) => j.clientId === c.id && j.status === 'done' && j.source === 'contract' && j.scheduledDate?.startsWith(ym));
    if (!monthJobs.length) continue;
    const lines: InvoiceLine[] = monthJobs
      .sort((a, b) => a.scheduledDate!.localeCompare(b.scheduledDate!))
      .map((j) => ({ id: `il_${j.id}`, description: `${svcById.get(j.serviceId)!.name} – ${propById.get(j.propertyId)!.name} – ${format(parseISO(j.scheduledDate!), 'MMM d')}`, qty: 1, unitPrice: j.price, jobId: j.id }));
    const id = `inv_${c.id.slice(3)}_${ym}`;
    const createdAt = `${format(addDays(parseISO(`${ym}-01`), 32), 'yyyy-MM')}-01T05:00:00`;
    const isAug = ym === '2026-08';
    const isJul = ym === '2026-07';
    const pendingClients = ['cl_camden', 'cl_millriver', 'cl_sunrise'];
    const overdueClients = ['cl_riverstone', 'cl_church'];
    const paidEarlyClients = ['cl_henderson', 'cl_tanaka', 'cl_lakeside', 'cl_ironwood'];
    let status: Invoice['status'] = 'paid';
    if (isAug && pendingClients.includes(c.id)) status = 'pending_approval';
    else if (isAug && !paidEarlyClients.includes(c.id)) status = 'sent';
    else if (isJul && overdueClients.includes(c.id)) status = 'overdue';
    const sentAt = status === 'pending_approval' ? undefined : `${createdAt.slice(0, 10)}T08:${between(10, 50)}:00`;
    const dueDate = iso(addDays(parseISO(createdAt.slice(0, 10)), 15));
    const summary = Object.entries(monthJobs.reduce((acc, j) => { acc[j.serviceId] = (acc[j.serviceId] ?? 0) + 1; return acc; }, {} as Record<string, number>))
      .map(([sid, n]) => `${n} × ${svcById.get(sid)!.name}`).join(', ');
    const inv: Invoice = { id, number: invNo++, clientId: c.id, lines, status, createdAt, sentAt, dueDate, remindersSent: status === 'overdue' ? 2 : 0, autoGenerated: true, sourceLabel: `Auto: ${format(parseISO(`${ym}-01`), 'MMMM')} – ${summary}`, division: 'maintenance' };
    if (status === 'paid') {
      const paidAt = isAug ? `2026-09-0${between(3, 7)}` : iso(addDays(parseISO(dueDate), between(-9, 4)));
      inv.paidAt = paidAt;
      payments.push({ id: `pay_${id}`, invoiceId: id, amount: Math.round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100, method: c.type === 'residential' ? pick(['card', 'venmo', 'check']) : pick(['check', 'ach']), date: paidAt, reference: c.type === 'residential' ? undefined : `#${between(1000, 9999)}` });
    }
    for (const j of monthJobs) j.invoiceId = id;
    invoices.push(inv);
  }
}

// Work-order / install invoices
const wo7Lines: InvoiceLine[] = [
  { id: 'il_wo7_1', description: 'Service call / trip fee – Prairie Falls Estates – Aug 21', qty: 1, unitPrice: 45, workOrderId: 'wo_2081' },
  { id: 'il_wo7_2', description: 'Irrigation labor (Ben C.)', qty: 0.75, unitPrice: 85, workOrderId: 'wo_2081' },
  { id: 'il_wo7_3', description: 'Hunter PGP Ultra Rotor 4"', qty: 1, unitPrice: partSellPrice(parts.find((p) => p.id === 'pt_pgp')!), workOrderId: 'wo_2081' },
  { id: 'il_wo7_4', description: 'Swing Joint Assembly 1/2" x 12"', qty: 1, unitPrice: partSellPrice(parts.find((p) => p.id === 'pt_swing')!), workOrderId: 'wo_2081' },
];
invoices.push({ id: 'inv_wo7', number: 3122, clientId: 'cl_prairie', propertyId: 'pr_prairie', lines: wo7Lines, status: 'paid', createdAt: '2026-08-21T11:06:00', sentAt: '2026-08-21T17:30:00', dueDate: '2026-09-05', paidAt: '2026-08-29', remindersSent: 0, autoGenerated: true, sourceLabel: 'Auto: Work order #2081 (ticket #109)', division: 'irrigation' });
payments.push({ id: 'pay_wo7', invoiceId: 'inv_wo7', amount: Math.round(wo7Lines.reduce((s, l) => s + l.qty * l.unitPrice, 0) * 100) / 100, method: 'check', date: '2026-08-29', reference: '#4471' });

invoices.push({ id: 'inv_wo5', number: 3131, clientId: 'cl_lakeside', propertyId: 'pr_lakeside', status: 'pending_approval', createdAt: '2026-09-04T15:21:00', dueDate: '2026-09-19', remindersSent: 0, autoGenerated: true, sourceLabel: 'Auto: Work order #2087 (ticket #116)', division: 'irrigation', lines: [
  { id: 'il_wo5_1', description: 'Service call / trip fee – Lakeside Dental – Sep 4', qty: 1, unitPrice: 45, workOrderId: 'wo_2087' },
  { id: 'il_wo5_2', description: 'Irrigation labor (Kyle N.)', qty: 1.5, unitPrice: 85, workOrderId: 'wo_2087' },
  { id: 'il_wo5_3', description: 'Hunter Solenoid 24VAC', qty: 2, unitPrice: partSellPrice(parts.find((p) => p.id === 'pt_solenoid')!), workOrderId: 'wo_2087' },
  { id: 'il_wo5_4', description: '18/7 Irrigation Wire', qty: 40, unitPrice: partSellPrice(parts.find((p) => p.id === 'pt_wire')!), workOrderId: 'wo_2087' },
] });
workOrders.find((w) => w.id === 'wo_2087')!.invoiceId = 'inv_wo5';

invoices.push({ id: 'inv_i1', number: 3060, clientId: 'cl_ironwood', propertyId: 'pr_ironwood', status: 'paid', createdAt: '2026-06-11T16:05:00', sentAt: '2026-06-11T17:00:00', dueDate: '2026-06-26', paidAt: '2026-06-24', remindersSent: 0, autoGenerated: false, sourceLabel: 'Install: Bldg B entry planting refresh', division: 'installs', lines: [
  { id: 'il_i1', description: 'Bldg B entry planting refresh – per estimate #1031', qty: 1, unitPrice: 6400, jobId: 'job_i1' },
] });
payments.push({ id: 'pay_i1', invoiceId: 'inv_i1', amount: 6400, method: 'ach', date: '2026-06-24', reference: 'ACH 88213' });
invoices.push({ id: 'inv_i2', number: 3090, clientId: 'cl_millriver', propertyId: 'pr_millriver', status: 'paid', createdAt: '2026-07-15T14:35:00', sentAt: '2026-07-15T16:00:00', dueDate: '2026-07-30', paidAt: '2026-07-28', remindersSent: 0, autoGenerated: false, sourceLabel: 'Install: Dog park irrigation retrofit', division: 'installs', lines: [
  { id: 'il_i2', description: 'Dog park irrigation retrofit – 42 MP rotators, per estimate #1036', qty: 1, unitPrice: 3850, jobId: 'job_i2' },
] });
payments.push({ id: 'pay_i2', invoiceId: 'inv_i2', amount: 3850, method: 'check', date: '2026-07-28', reference: '#10982' });

// ---------------------------------------------------------------- messages (unified inbox)
const messages: Message[] = [
  { id: 'm1', clientId: 'cl_riverstone', propertyId: 'pr_riverstone', direction: 'in', channel: 'text', from: '(208) 555-2340', to: '(208) 967-3579', body: 'Hey David, there\'s standing water around the valve box by the pool again. Photo attached. Can someone look this week?', at: '2026-08-31T18:22:00', ticketId: 'tk_2', read: true },
  { id: 'm2', clientId: 'cl_riverstone', propertyId: 'pr_riverstone', direction: 'out', channel: 'text', from: '(208) 967-3579', to: '(208) 555-2340', body: 'Got it Tom. Estimate #1040 sent to your email – $395.90. Reply APPROVED and we\'ll get Kyle out Tuesday.', at: '2026-09-01T08:41:00', ticketId: 'tk_2', read: true },
  { id: 'm3', clientId: 'cl_riverstone', propertyId: 'pr_riverstone', direction: 'in', channel: 'text', from: '(208) 555-2340', to: '(208) 967-3579', body: 'Approved, go ahead.', at: '2026-09-01T13:05:00', ticketId: 'tk_2', read: true },
  { id: 'm4', clientId: 'cl_henderson', propertyId: 'pr_henderson', direction: 'in', channel: 'email', from: 'julie.henderson@gmail.com', to: 'service@sundownlawnandirrigation.com', body: 'Hi! We put in two new beds along the driveway this weekend. Could you add drip to them before winter? Thanks – Julie', at: '2026-09-04T09:15:00', ticketId: 'tk_3', read: true },
  { id: 'm5', clientId: 'cl_walsh', propertyId: 'pr_walsh', direction: 'out', channel: 'text', from: '(208) 967-3579', to: '(208) 555-3140', body: 'Hi Karen – any questions on the patio estimate? Happy to walk through it. We have an install slot the week of Sep 21.', at: '2026-09-03T09:00:00', ticketId: 'tk_4', read: true },
  { id: 'm6', clientId: 'cl_walsh', propertyId: 'pr_walsh', direction: 'in', channel: 'text', from: '(208) 555-3140', to: '(208) 967-3579', body: 'Talking it over with Bill this weekend, will let you know Monday!', at: '2026-09-03T12:14:00', ticketId: 'tk_4', read: true },
  { id: 'm7', clientId: 'cl_millriver', propertyId: 'pr_millriver', direction: 'in', channel: 'email', from: 'manager@millriverhoa.com', to: 'service@sundownlawnandirrigation.com', body: 'David – attaching photos of brown spots along the south fence. Residents are asking. Zone 11 I think?', at: '2026-09-07T16:50:00', ticketId: 'tk_6', read: false },
  { id: 'm8', clientId: 'cl_tanaka', propertyId: 'pr_tanaka', direction: 'in', channel: 'text', from: '(208) 555-3277', to: '(208) 967-3579', body: 'Dog got into the front bed, drip line is chewed up in a couple places. Not urgent but before it gets cold?', at: '2026-09-07T19:05:00', ticketId: 'tk_9', read: true },
  { id: 'm9', clientId: 'cl_tanaka', propertyId: 'pr_tanaka', direction: 'out', channel: 'text', from: '(208) 967-3579', to: '(208) 555-3277', body: 'No problem Greg – T&M, usually under $150 for that. We\'ll swing by this week.', at: '2026-09-08T06:55:00', ticketId: 'tk_9', read: true },
  { id: 'm10', clientId: 'cl_hayden', propertyId: 'pr_hayden', direction: 'in', channel: 'call', from: '(208) 555-2588', to: '(208) 967-3579', body: 'Call (4 min). Rob: big cottonwood limb down across the trail after last night\'s wind. Wants it cleared today if possible.', at: '2026-09-08T07:12:00', ticketId: 'tk_10', read: true },
  { id: 'm11', clientId: 'cl_camden', propertyId: 'pr_camden1', direction: 'in', channel: 'voice_note', from: 'Tyler Brooks', to: 'Tickets', body: '"Job ticket for Camden Place, looks like a sprinkler head is broken by the mailbox kiosk, geysering."', at: '2026-09-07T10:42:00', ticketId: 'tk_1', read: true },
  { id: 'm12', clientId: 'cl_church', direction: 'out', channel: 'email', from: 'billing@sundownlawnandirrigation.com', to: 'facilities@cdabible.org', body: 'Reminder: invoice #3025 for July services ($1,148.00) is 20 days past due. Pay online or reply with questions.', at: '2026-09-05T09:00:00', read: true },
  { id: 'm13', direction: 'in', channel: 'text', from: '(208) 555-4890', to: '(208) 967-3579', body: 'Hi, this is Mike over at 4410 N Ramsey Rd. My neighbor said you guys do sprinkler blowouts – can I get on the list for October?', at: '2026-09-07T13:30:00', read: false },
  { id: 'm14', direction: 'in', channel: 'email', from: 'accounting@northstarhoamgmt.com', to: 'billing@sundownlawnandirrigation.com', body: 'Please confirm W-9 on file for Camden Place vendor setup for 2027.', at: '2026-09-08T08:02:00', read: false },
  { id: 'm15', clientId: 'cl_lakeside', propertyId: 'pr_lakeside', direction: 'in', channel: 'call', from: '(208) 555-2810', to: '(208) 967-3579', body: 'Call (3 min). Bree: back beds dry, controller faulting on zones 6-8.', at: '2026-09-03T08:05:00', ticketId: 'tk_5', read: true },
];

const knownContacts: Record<string, string> = {};
for (const c of clients) {
  knownContacts[c.phone.replace(/\D/g, '')] = c.id;
  for (const p of c.altPhones) knownContacts[p.replace(/\D/g, '')] = c.id;
  knownContacts[c.email.toLowerCase()] = c.id;
  if (c.billingEmail) knownContacts[c.billingEmail.toLowerCase()] = c.id;
}

// ---------------------------------------------------------------- time entries (geofence visits, last 14 days)
const timeEntries: TimeEntry[] = [];
const crewMembers = (crewId: string) => team.filter((m) => m.crewId === crewId);
for (let back = 14; back >= 0; back--) {
  const day = iso(addDays(parseISO(TODAY), -back));
  const dow = getDay(parseISO(day));
  if (dow === 0 || dow === 6) continue;
  for (const crew of crews) {
    const dayJobs = jobs
      .filter((j) => j.crewId === crew.id && j.scheduledDate === day && (j.status === 'done' || j.status === 'in_progress'))
      .sort((a, b) => (a.routeOrder ?? 0) - (b.routeOrder ?? 0));
    const members = crewMembers(crew.id);
    if (!dayJobs.length && back > 0) continue;
    for (const m of members) {
      let cursor = 7 * 60 + between(0, 20); // minutes after midnight
      const visits = [];
      for (const j of dayJobs) {
        const prop = propById.get(j.propertyId)!;
        const drive = between(10, 25);
        cursor += drive;
        const svc = svcById.get(j.serviceId)!;
        const dur = Math.max(20, Math.round((estimateMinutes(svc, prop) * difficulty[prop.id] * (crew.id === 'crew_maint' ? 2.4 : 1.6)) / members.length));
        const arrive = `${day}T${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}:00`;
        const departMin = j.status === 'in_progress' ? cursor + Math.round(dur * 0.4) : cursor + dur;
        const depart = `${day}T${String(Math.floor(departMin / 60)).padStart(2, '0')}:${String(departMin % 60).padStart(2, '0')}:00`;
        visits.push({ propertyId: j.propertyId, arrive, depart, jobIds: [j.id], source: 'geofence' as const });
        cursor = departMin;
      }
      const clockOutMin = back === 0 ? undefined : Math.max(cursor + between(20, 45), 15 * 60 + between(0, 45));
      timeEntries.push({
        id: `te_${m.id}_${day}`,
        memberId: m.id,
        date: day,
        clockIn: `${day}T06:${String(between(40, 59)).padStart(2, '0')}:00`,
        clockOut: clockOutMin ? `${day}T${String(Math.floor(clockOutMin / 60)).padStart(2, '0')}:${String(clockOutMin % 60).padStart(2, '0')}:00` : undefined,
        visits,
        syncedToQuickBooks: back > 7,
      });
    }
  }
  // David: partial field days (irrigation repairs / backflow), lots of office time -> ~45% billable
  const davidVisits = [];
  const candidates = jobs
    .filter((j) => j.scheduledDate === day && j.status === 'done')
    .sort((a, b) => (a.division === 'irrigation' ? -1 : 0) - (b.division === 'irrigation' ? -1 : 0))
    .slice(0, 3);
  let cur = 8 * 60;
  for (const j of candidates) {
    cur += between(15, 30);
    const dur = between(80, 150);
    davidVisits.push({ propertyId: j.propertyId, arrive: `${day}T${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}:00`, depart: `${day}T${String(Math.floor((cur + dur) / 60)).padStart(2, '0')}:${String((cur + dur) % 60).padStart(2, '0')}:00`, jobIds: [j.id], source: 'geofence' as const });
    cur += dur;
  }
  timeEntries.push({ id: `te_tm_david_${day}`, memberId: 'tm_david', date: day, clockIn: `${day}T06:30:00`, clockOut: back === 0 ? undefined : `${day}T17:${String(between(0, 50)).padStart(2, '0')}:00`, visits: davidVisits, syncedToQuickBooks: back > 7 });
}

// ---------------------------------------------------------------- settings
const settings: AppData['settings'] = {
  name: 'Sundown Lawn & Irrigation',
  legalName: 'Sundown Lawn & Irrigation LLC',
  phone: '(208) 518-7655',
  serviceLine: '(208) 967-3579',
  email: 'service@sundownlawnandirrigation.com',
  address: '2455 W Seltice Way',
  city: 'Post Falls, ID 83854',
  timezone: 'America/Los_Angeles',
  taxRate: 0,
  defaultMarkupPct: 50,
  billableTargetPct: 85,
  invoiceAutoSend: false,
  invoiceApprovalsCount: 37,
  invoiceApprovalsToTrust: 100,
  reminderAfterDays: 5,
  escalateAfterDays: 14,
  quickBooksConnected: true,
  geofenceRadiusM: 120,
  weatherRules: [
    { id: 'wr_1', name: 'Rain – skip fert & mowing', condition: '> 0.25" rain forecast at property before 2pm', action: 'Hold job, re-suggest first dry day', enabled: true, divisions: ['maintenance'] },
    { id: 'wr_2', name: 'Wind – hold spray apps', condition: 'Sustained wind > 12 mph', action: 'Hold fertilizer/weed control, notify ops', enabled: true, divisions: ['maintenance'] },
    { id: 'wr_3', name: 'Hard freeze – blowout push', condition: 'Overnight low ≤ 26°F within 5 days', action: 'Move remaining blowouts to top of waiting list', enabled: true, divisions: ['irrigation'] },
  ],
};

export function buildSeed(): AppData {
  return structuredClone({
    version: 4,
    today: TODAY,
    settings,
    team,
    crews,
    clients,
    properties,
    purveyors,
    backflowDevices,
    backflowTests,
    services,
    packages,
    contracts,
    jobs,
    tickets,
    estimates,
    estimateTemplates,
    parts,
    workOrders,
    invoices,
    payments,
    messages,
    timeEntries,
    knownContacts,
    counters: { ticket: 122, estimate: 1044, invoice: invNo + 200, workOrder: 2089 },
  } satisfies AppData);
}

export const DIVISIONS: Division[] = ['maintenance', 'irrigation', 'installs', 'backflow'];
