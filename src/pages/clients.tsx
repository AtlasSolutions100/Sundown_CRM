import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Users, Plus, Building2, Home, Briefcase, Wallet } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardContent, Badge, Input, Select, Textarea, Field, Dialog, Segmented, Progress, Table, THead, TBody, TR, TH, TD, Stat, PageHeader, EmptyState, useToast, type Tone } from '@/components/ui';
import { contractProgress, clientBalance, marginByClient } from '@/lib/metrics';
import { money, pct, cn, sum, uid, normalizePhone } from '@/lib/utils';
import type { Client, ClientStatus, ClientType } from '@/data/types';

const TYPE_LABEL: Record<ClientType, string> = { hoa: 'HOA', residential: 'Residential', commercial: 'Commercial' };
const STATUS_TONE: Record<ClientStatus, Tone> = { lead: 'accent', active: 'success', former: 'neutral' };

export default function Clients() {
  const { data, update } = useStore();
  const toast = useToast();
  const [status, setStatus] = useState<'all' | ClientStatus>('all');
  const [type, setType] = useState<'all' | ClientType>('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const margins = useMemo(() => new Map(marginByClient(data).map((r) => [r.key, r])), [data]);
  const active = data.clients.filter((c) => c.status === 'active');
  const outstanding = sum(active.map((c) => clientBalance(data, c.id)));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.clients
      .filter((c) => (status === 'all' || c.status === status) && (type === 'all' || c.type === type))
      .filter((c) => !q || [c.name, c.contactName, c.phone, c.email, c.address].some((s) => s.toLowerCase().includes(q)))
      .map((c) => {
        const contracts = data.contracts.filter((k) => k.clientId === c.id && k.status === 'active');
        const progs = contracts.map((k) => contractProgress(data, k)).filter((x) => !!x);
        const done = sum(progs.map((p) => p!.done));
        const total = sum(progs.map((p) => p!.total));
        const behind = sum(progs.map((p) => p!.behind));
        return { c, done, total, behind, balance: clientBalance(data, c.id), margin: margins.get(c.id), props: data.properties.filter((p) => p.clientId === c.id).length };
      })
      .sort((a, b) => a.c.name.localeCompare(b.c.name));
  }, [data, status, type, search, margins]);

  return (
    <div>
      <PageHeader eyebrow="Clients" title="Clients & leads" subtitle="Every property, contract, conversation and dollar in one place." actions={<Button onClick={() => setOpen(true)}><Plus /> New client</Button>} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active clients" value={active.length} icon={<Users />} onClick={() => setStatus('active')} />
        <Stat label="Leads" value={data.clients.filter((c) => c.status === 'lead').length} tone="accent" icon={<Briefcase />} onClick={() => setStatus('lead')} />
        <Stat label="HOAs" value={data.clients.filter((c) => c.type === 'hoa' && c.status === 'active').length} icon={<Building2 />} onClick={() => setType('hoa')} />
        <Stat label="Outstanding balance" value={money(outstanding)} tone={outstanding > 0 ? 'warning' : 'default'} icon={<Wallet />} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Segmented value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'lead', label: 'Leads' }, { value: 'former', label: 'Former' }]} />
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-40">
            <option value="all">All types</option>
            <option value="hoa">HOA</option>
            <option value="commercial">Commercial</option>
            <option value="residential">Residential</option>
          </Select>
          <Input placeholder="Search name, contact, phone, address…" value={search} onChange={(e) => setSearch(e.target.value)} className="ml-auto max-w-xs" />
        </div>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6"><EmptyState icon={<Users />} title="No clients match" /></div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Client</TH>
                  <TH>Type</TH>
                  <TH>Status</TH>
                  <TH>Contact</TH>
                  <TH className="text-center">Props</TH>
                  <TH>Term</TH>
                  <TH>2026 completion</TH>
                  <TH className="text-right">Balance</TH>
                  <TH className="text-right">Margin</TH>
                  <TH>Tags</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map(({ c, done, total, behind, balance, margin, props }) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/clients/${c.id}`} className="font-semibold hover:text-primary hover:underline">{c.name}</Link>
                      <div className="text-xs text-muted-foreground">{c.address}</div>
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {c.type === 'hoa' ? <Building2 className="size-3.5 text-muted-foreground" /> : c.type === 'residential' ? <Home className="size-3.5 text-muted-foreground" /> : <Briefcase className="size-3.5 text-muted-foreground" />}
                        {TYPE_LABEL[c.type]}
                      </span>
                    </TD>
                    <TD><Badge tone={STATUS_TONE[c.status]} dot>{c.status}</Badge></TD>
                    <TD>
                      <div className="text-sm">{c.contactName}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </TD>
                    <TD className="text-center tabular">{props}</TD>
                    <TD className="text-sm">{c.contractSince ? `${c.termYears}-yr since ${c.contractSince.slice(0, 4)}` : <span className="text-muted-foreground">—</span>}</TD>
                    <TD>
                      {total ? (
                        <div className="w-36">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="tabular">{done} / {total}</span>
                            {behind > 0 && <Badge tone="danger">{behind} behind</Badge>}
                          </div>
                          <Progress value={done / total} tone={behind ? 'danger' : 'success'} height="h-1.5" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No contract</span>
                      )}
                    </TD>
                    <TD className={cn('text-right tabular font-medium', balance > 0 && 'text-destructive')}>{money(balance)}</TD>
                    <TD className="text-right tabular">
                      {margin ? <span className={cn('font-medium', margin.margin < 0.15 ? 'text-destructive' : margin.margin < 0.3 ? 'text-[hsl(30_70%_30%)]' : 'text-success')}>{pct(margin.margin)}</span> : <span className="text-muted-foreground">—</span>}
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => (
                          <Badge key={t} tone="outline">{t}</Badge>
                        ))}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {open && (
        <NewClientDialog
          onClose={() => setOpen(false)}
          onSave={(client, prop) => {
            update((d) => {
              d.clients.unshift(client);
              d.properties.push(prop);
              if (client.phone) d.knownContacts[normalizePhone(client.phone)] = client.id;
              if (client.email) d.knownContacts[client.email.toLowerCase()] = client.id;
            });
            toast({ title: 'Client created', description: `${client.name} · ${prop.name}` });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function NewClientDialog({ onClose, onSave }: { onClose: () => void; onSave: (c: Client, p: import('@/data/types').Property) => void }) {
  const { data } = useStore();
  const [f, setF] = useState({ name: '', type: 'hoa' as ClientType, status: 'lead' as ClientStatus, contactName: '', phone: '', email: '', address: '', notes: '', propName: '', propAddress: '', city: "Coeur d'Alene", turfSqft: 10000, bedSqft: 2000, zones: 8, purveyorId: data.purveyors[0]?.id ?? '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const valid = f.name.trim() && f.contactName.trim();
  return (
    <Dialog
      open
      onClose={onClose}
      title="New client"
      description="Lead or active. Add the first property now so estimates can price against it."
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => {
              const id = uid('cl');
              onSave(
                { id, name: f.name.trim(), type: f.type, status: f.status, contactName: f.contactName.trim(), phone: f.phone, altPhones: [], email: f.email, address: f.address || `${f.propAddress}, ${f.city}`, notes: f.notes, tags: [f.type === 'hoa' ? 'HOA' : f.type === 'commercial' ? 'Commercial' : 'Residential', ...(f.status === 'lead' ? ['Lead'] : [])], termYears: 1, contractSince: '', createdAt: data.today },
                { id: uid('pr'), clientId: id, name: f.propName || f.name.trim(), address: f.propAddress || f.address, city: f.city, lat: 47.7 + Math.random() * 0.08, lng: -116.85 + Math.random() * 0.15, turfSqft: f.turfSqft, bedSqft: f.bedSqft, zones: f.zones, purveyorId: f.purveyorId || undefined },
              );
            }}
          >
            Create client
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client name" className="sm:col-span-2"><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Fieldstone Meadows HOA" /></Field>
        <Field label="Type">
          <Select value={f.type} onChange={(e) => set('type', e.target.value as ClientType)}>
            <option value="hoa">HOA</option>
            <option value="commercial">Commercial</option>
            <option value="residential">Residential</option>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={(e) => set('status', e.target.value as ClientStatus)}>
            <option value="lead">Lead</option>
            <option value="active">Active</option>
          </Select>
        </Field>
        <Field label="Contact name"><Input value={f.contactName} onChange={(e) => set('contactName', e.target.value)} /></Field>
        <Field label="Phone" hint="Texts and calls from this number auto-file here"><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(208) 555-0100" /></Field>
        <Field label="Email"><Input value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Billing / mailing address"><Input value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} className="min-h-[56px]" /></Field>
      </div>
      <div className="mt-5 rounded-lg border bg-muted/30 p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">First property</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Property name"><Input value={f.propName} onChange={(e) => set('propName', e.target.value)} placeholder="Common areas" /></Field>
          <Field label="Street address"><Input value={f.propAddress} onChange={(e) => set('propAddress', e.target.value)} /></Field>
          <Field label="City"><Input value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Turf sqft"><Input type="number" value={f.turfSqft} onChange={(e) => set('turfSqft', Number(e.target.value))} /></Field>
          <Field label="Bed sqft"><Input type="number" value={f.bedSqft} onChange={(e) => set('bedSqft', Number(e.target.value))} /></Field>
          <Field label="Irrigation zones"><Input type="number" value={f.zones} onChange={(e) => set('zones', Number(e.target.value))} /></Field>
          <Field label="Water purveyor" className="sm:col-span-3">
            <Select value={f.purveyorId} onChange={(e) => set('purveyorId', e.target.value)}>
              {data.purveyors.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
