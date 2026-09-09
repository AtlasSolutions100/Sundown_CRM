import { useMemo, useState } from 'react';
import { Plus, Pencil, Calculator, ChevronDown, ChevronRight, PackagePlus, Trash2 } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Select, Textarea, Field, Dialog, Tabs, Switch, PageHeader, useToast } from '@/components/ui';
import { DIVISION_LABEL } from '@/lib/metrics';
import { priceService, pricingSummary } from '@/lib/pricing';
import { money, uid } from '@/lib/utils';
import type { Contract, ContractLine, Division, Job, Occurrence, Package, PricingUnit, Service } from '@/data/types';

type Tab = 'services' | 'packages';

export default function Services() {
  const { data, update } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('services');
  const [calc, setCalc] = useState({ turfSqft: 10000, bedSqft: 3000, zones: 10, devices: 1 });
  const [editSvc, setEditSvc] = useState<Service | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editPkg, setEditPkg] = useState<Package | null>(null);
  const [assignPkg, setAssignPkg] = useState<Package | null>(null);

  const blankService = (): Service => ({ id: uid('svc'), name: '', division: 'maintenance', category: 'routine', description: '', pricing: { unit: 'turf', tripFee: 30, ratePer1000Sqft: 5 }, occurrences: [], estMinutesPer1000Sqft: 3, color: '140 40% 34%' });

  return (
    <div>
      <PageHeader
       
        title="Services & packages"
        subtitle="Trip fee plus a rate per 1,000 sqft. Change two numbers and every bid updates."
        actions={
          tab === 'services' ? (
            <Button onClick={() => setEditSvc(blankService())}><Plus /> New service</Button>
          ) : (
            <Button onClick={() => setEditPkg({ id: uid('pkg'), name: '', description: '', serviceIds: [], autoRenew: true })}><Plus /> New package</Button>
          )
        }
      />

      <Tabs value={tab} onChange={setTab} className="mb-4" tabs={[{ value: 'services', label: 'Services', count: data.services.length }, { value: 'packages', label: 'Packages', count: data.packages.length }]} />

      {tab === 'services' && (
        <>
          <Card className="mb-4">
            <CardContent className="flex flex-wrap items-end gap-4 p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><Calculator className="size-4 text-muted-foreground" /> Live price calculator</div>
              <Field label="Turf sqft"><Input type="number" className="w-28" value={calc.turfSqft} onChange={(e) => setCalc({ ...calc, turfSqft: Number(e.target.value) })} /></Field>
              <Field label="Bed sqft"><Input type="number" className="w-28" value={calc.bedSqft} onChange={(e) => setCalc({ ...calc, bedSqft: Number(e.target.value) })} /></Field>
              <Field label="Zones"><Input type="number" className="w-20" value={calc.zones} onChange={(e) => setCalc({ ...calc, zones: Number(e.target.value) })} /></Field>
              <Field label="Backflow devices"><Input type="number" className="w-20" value={calc.devices} onChange={(e) => setCalc({ ...calc, devices: Number(e.target.value) })} /></Field>
              <p className="text-xs text-muted-foreground">Every card below shows what it would charge for this property.</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.services.map((s) => {
              const price = priceService(s.pricing, calc, s.pricing.unit === 'device' ? calc.devices : 1);
              const open = expanded === s.id;
              return (
                <Card key={s.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="size-3 rounded-full" style={{ background: `hsl(${s.color})` }} />
                        <CardTitle>{s.name}</CardTitle>
                      </div>
                      <Button size="xs" variant="ghost" onClick={() => setEditSvc(s)}><Pencil /></Button>
                    </div>
                    <div className="pt-0.5 text-[12.5px] text-muted-foreground">{DIVISION_LABEL[s.division]} · {s.category === 'routine' ? 'Routine' : 'Non-routine'}</div>
                    <CardDescription className="pt-1">{s.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="text-[11.5px] font-medium text-muted-foreground">Formula</div>
                      <div className="text-sm font-medium">{pricingSummary(s.pricing) || 'Bid per project'}</div>
                      <div className="mt-2 flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">For the calculator property</span>
                        <span className="num text-lg font-semibold">{s.pricing.unit === 'flat' && !s.pricing.flat ? 'Bid' : money(price)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{s.occurrences.length ? `${s.occurrences.length} ${s.occurrences.length === 1 ? 'visit' : 'visits'} / season` : 'On request'}</span>
                      <span>{s.estMinutesFlat ? `~${s.estMinutesFlat} min` : s.estMinutesPer1000Sqft ? `~${s.estMinutesPer1000Sqft} min / 1k sqft` : ''}</span>
                    </div>
                    {s.occurrences.length > 0 && (
                      <button type="button" onClick={() => setExpanded(open ? null : s.id)} className="flex w-full items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} {open ? 'Hide' : 'Show'} schedule windows
                      </button>
                    )}
                    {open && (
                      <div className="max-h-40 divide-y divide-border/70 overflow-y-auto text-xs scrollbar-thin">
                        {s.occurrences.map((o, i) => (
                          <div key={i} className="flex justify-between py-1">
                            <span>{o.label}</span>
                            <span className="text-muted-foreground tabular">{o.start} → {o.end}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {tab === 'packages' && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.packages.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{p.name}</CardTitle>
                  <Button size="xs" variant="ghost" onClick={() => setEditPkg(p)}><Pencil /></Button>
                </div>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1">
                  {p.serviceIds.map((id) => {
                    const s = data.services.find((x) => x.id === id);
                    return s ? <Badge key={id} tone="outline">{s.name}{s.occurrences.length > 1 ? ` ×${s.occurrences.length}` : ''}</Badge> : null;
                  })}
                </div>
                <div className="flex items-center justify-between">
                  <Switch
                    checked={p.autoRenew}
                    label="Auto-renews each season"
                    onChange={(v) => update((d) => { const x = d.packages.find((k) => k.id === p.id); if (x) x.autoRenew = v; })}
                  />
                  <Button size="sm" variant="outline" onClick={() => setAssignPkg(p)}><PackagePlus /> Assign to property</Button>
                </div>
                <p className="text-xs text-muted-foreground">Used by {data.contracts.filter((c) => c.packageId === p.id).length} contract{data.contracts.filter((c) => c.packageId === p.id).length === 1 ? '' : 's'}.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editSvc && (
        <ServiceDialog
          svc={editSvc}
          onClose={() => setEditSvc(null)}
          onSave={(s) => {
            update((d) => {
              const i = d.services.findIndex((x) => x.id === s.id);
              if (i >= 0) d.services[i] = s;
              else d.services.push(s);
            });
            toast({ title: 'Service saved', description: `${s.name} · ${pricingSummary(s.pricing)}` });
            setEditSvc(null);
          }}
        />
      )}

      {editPkg && (
        <Dialog
          open
          onClose={() => setEditPkg(null)}
          title={editPkg.name ? 'Edit package' : 'New package'}
          footer={
            <>
              <Button variant="outline" onClick={() => setEditPkg(null)}>Cancel</Button>
              <Button
                disabled={!editPkg.name.trim() || !editPkg.serviceIds.length}
                onClick={() => {
                  update((d) => {
                    const i = d.packages.findIndex((x) => x.id === editPkg.id);
                    if (i >= 0) d.packages[i] = editPkg;
                    else d.packages.push(editPkg);
                  });
                  toast({ title: 'Package saved' });
                  setEditPkg(null);
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="Name"><Input value={editPkg.name} onChange={(e) => setEditPkg({ ...editPkg, name: e.target.value })} /></Field>
            <Field label="Description"><Textarea value={editPkg.description} onChange={(e) => setEditPkg({ ...editPkg, description: e.target.value })} className="min-h-[56px]" /></Field>
            <Field label="Services included">
              <div className="grid gap-1 rounded-lg bg-muted/50 p-2 sm:grid-cols-2">
                {data.services.filter((s) => s.category === 'routine').map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50">
                    <input type="checkbox" checked={editPkg.serviceIds.includes(s.id)} onChange={(e) => setEditPkg({ ...editPkg, serviceIds: e.target.checked ? [...editPkg.serviceIds, s.id] : editPkg.serviceIds.filter((x) => x !== s.id) })} />
                    {s.name}
                  </label>
                ))}
              </div>
            </Field>
            <Switch checked={editPkg.autoRenew} onChange={(v) => setEditPkg({ ...editPkg, autoRenew: v })} label="Auto-renew each season" />
          </div>
        </Dialog>
      )}

      {assignPkg && <AssignDialog pkg={assignPkg} onClose={() => setAssignPkg(null)} />}
    </div>
  );
}

function ServiceDialog({ svc, onClose, onSave }: { svc: Service; onClose: () => void; onSave: (s: Service) => void }) {
  const [s, setS] = useState<Service>(structuredClone(svc));
  const setP = <K extends keyof Service['pricing']>(k: K, v: Service['pricing'][K]) => setS((x) => ({ ...x, pricing: { ...x.pricing, [k]: v } }));
  const setOcc = (i: number, patch: Partial<Occurrence>) => setS((x) => ({ ...x, occurrences: x.occurrences.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));
  const unit = s.pricing.unit;
  const sample = priceService(s.pricing, { turfSqft: 10000, bedSqft: 3000, zones: 10 }, 1);
  return (
    <Dialog
      open
      onClose={onClose}
      title={svc.name ? `Edit ${svc.name}` : 'New service'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!s.name.trim()} onClick={() => onSave(s)}>Save service</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Division">
            <Select value={s.division} onChange={(e) => setS({ ...s, division: e.target.value as Division })}>
              <option value="maintenance">Maintenance</option>
              <option value="irrigation">Irrigation</option>
              <option value="installs">Installs</option>
              <option value="backflow">Backflow</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={s.category} onChange={(e) => setS({ ...s, category: e.target.value as Service['category'] })}>
              <option value="routine">Routine (contract)</option>
              <option value="nonroutine">Non-routine (request)</option>
            </Select>
          </Field>
        </div>
        <Field label="Description" className="sm:col-span-2"><Textarea value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} className="min-h-[56px]" /></Field>
      </div>

      <div className="mt-4 rounded-lg bg-muted/50 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">Pricing equation</div>
          <div className="text-sm">Sample 10k turf / 3k beds / 10 zones: <span className="num font-semibold">{money(sample)}</span></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Priced by">
            <Select value={unit} onChange={(e) => setP('unit', e.target.value as PricingUnit)}>
              <option value="turf">Turf sqft</option>
              <option value="bed">Bed sqft</option>
              <option value="zones">Irrigation zones</option>
              <option value="device">Backflow device</option>
              <option value="hourly">Hourly (T&amp;M)</option>
              <option value="flat">Flat / bid</option>
            </Select>
          </Field>
          <Field label="Trip fee ($)" hint="Truck, fuel, drive time"><Input type="number" step="1" value={s.pricing.tripFee} onChange={(e) => setP('tripFee', Number(e.target.value))} /></Field>
          {(unit === 'turf' || unit === 'bed') && <Field label="Rate per 1,000 sqft ($)" hint="Mower, product, labor"><Input type="number" step="0.25" value={s.pricing.ratePer1000Sqft ?? 0} onChange={(e) => setP('ratePer1000Sqft', Number(e.target.value))} /></Field>}
          {(unit === 'zones' || unit === 'device') && <Field label={unit === 'zones' ? 'Rate per zone ($)' : 'Rate per device ($)'}><Input type="number" step="1" value={s.pricing.ratePerUnit ?? 0} onChange={(e) => setP('ratePerUnit', Number(e.target.value))} /></Field>}
          {unit === 'hourly' && <Field label="Hourly rate ($)"><Input type="number" step="5" value={s.pricing.hourlyRate ?? 0} onChange={(e) => setP('hourlyRate', Number(e.target.value))} /></Field>}
          {unit === 'flat' && <Field label="Flat price ($)" hint="0 = bid per project"><Input type="number" step="5" value={s.pricing.flat ?? 0} onChange={(e) => setP('flat', Number(e.target.value))} /></Field>}
          <Field label="Est. minutes / 1,000 sqft"><Input type="number" step="0.1" value={s.estMinutesPer1000Sqft ?? ''} onChange={(e) => setS({ ...s, estMinutesPer1000Sqft: e.target.value ? Number(e.target.value) : undefined })} /></Field>
          <Field label="Est. minutes flat"><Input type="number" value={s.estMinutesFlat ?? ''} onChange={(e) => setS({ ...s, estMinutesFlat: e.target.value ? Number(e.target.value) : undefined })} /></Field>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground">Season windows ({s.occurrences.length})</div>
          <Button size="xs" variant="outline" onClick={() => setS({ ...s, occurrences: [...s.occurrences, { label: `Visit ${s.occurrences.length + 1}`, start: '05-01', end: '05-31' }] })}><Plus /> Add window</Button>
        </div>
        <div className="max-h-56 divide-y divide-border/70 overflow-y-auto rounded-lg bg-muted/50 scrollbar-thin">
          {s.occurrences.length === 0 && <p className="p-3 text-xs text-muted-foreground">No windows: this service is scheduled on request.</p>}
          {s.occurrences.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_100px_32px] items-center gap-2 px-2 py-1.5">
              <Input value={o.label} onChange={(e) => setOcc(i, { label: e.target.value })} className="h-8" />
              <Input value={o.start} onChange={(e) => setOcc(i, { start: e.target.value })} className="h-8 font-mono text-xs" placeholder="MM-DD" />
              <Input value={o.end} onChange={(e) => setOcc(i, { end: e.target.value })} className="h-8 font-mono text-xs" placeholder="MM-DD" />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setS({ ...s, occurrences: s.occurrences.filter((_, j) => j !== i) })}><Trash2 className="text-muted-foreground" /></Button>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

function AssignDialog({ pkg, onClose }: { pkg: Package; onClose: () => void }) {
  const { data, update } = useStore();
  const toast = useToast();
  const [clientId, setClientId] = useState(data.clients.find((c) => c.status !== 'former')?.id ?? '');
  const props = data.properties.filter((p) => p.clientId === clientId);
  const [propertyId, setPropertyId] = useState(props[0]?.id ?? '');
  const [year, setYear] = useState(2027);
  const property = data.properties.find((p) => p.id === propertyId);

  const preview = useMemo(() => {
    if (!property) return { lines: 0, total: 0 };
    const devices = data.backflowDevices.filter((d) => d.propertyId === property.id).length;
    let lines = 0;
    let total = 0;
    for (const sid of pkg.serviceIds) {
      const s = data.services.find((x) => x.id === sid);
      if (!s) continue;
      if (s.id === 'svc_backflow' && devices === 0) continue;
      const price = priceService(s.pricing, property, devices);
      lines += s.occurrences.length;
      total += price * s.occurrences.length;
    }
    return { lines, total };
  }, [property, pkg, data.services, data.backflowDevices]);

  const assign = () => {
    if (!property) return;
    const client = data.clients.find((c) => c.id === clientId)!;
    update((d) => {
      const devices = d.backflowDevices.filter((x) => x.propertyId === property.id).length;
      const lines: ContractLine[] = [];
      const jobs: Job[] = [];
      const contractId = uid('ct');
      for (const sid of pkg.serviceIds) {
        const s = d.services.find((x) => x.id === sid);
        if (!s) continue;
        if (s.id === 'svc_backflow' && devices === 0) continue;
        const price = priceService(s.pricing, property, devices);
        s.occurrences.forEach((o) => {
          const line: ContractLine = { id: uid('cl'), serviceId: s.id, label: o.label, windowStart: `${year}-${o.start}`, windowEnd: `${year}-${o.end}`, price };
          lines.push(line);
          jobs.push({ id: uid('job'), propertyId: property.id, clientId, serviceId: s.id, division: s.division, title: `${s.name}${s.occurrences.length > 1 ? ` – ${o.label}` : ''}`, source: 'contract', contractLineId: line.id, status: 'unscheduled', windowStart: line.windowStart, windowEnd: line.windowEnd, price, partsUsed: [], notes: '' });
        });
      }
      const contract: Contract = { id: contractId, clientId, propertyId: property.id, year, packageId: pkg.id, status: 'draft', termYears: client.termYears, startDate: `${year}-04-01`, endDate: `${year}-11-30`, lines };
      d.contracts.push(contract);
      d.jobs.push(...jobs);
    });
    toast({ title: `Contract drafted with ${preview.lines} line items`, description: `They'll appear on the waiting list in their windows. ${money(preview.total, { cents: false })} for ${year}.` });
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Assign “${pkg.name}”`}
      description="Builds every dated line item from the service windows, priced for this property."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!property} onClick={assign}>Draft contract</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Client">
          <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setPropertyId(data.properties.find((p) => p.clientId === e.target.value)?.id ?? ''); }}>
            {data.clients.filter((c) => c.status !== 'former').map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
            ))}
          </Select>
        </Field>
        <Field label="Property">
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {props.map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {p.turfSqft.toLocaleString()} sqft</option>
            ))}
          </Select>
        </Field>
        <Field label="Season">
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </Select>
        </Field>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex justify-between"><span>Line items</span><span className="num font-semibold">{preview.lines}</span></div>
          <div className="flex justify-between"><span>Season value</span><span className="num font-semibold">{money(preview.total)}</span></div>
        </div>
      </div>
    </Dialog>
  );
}
