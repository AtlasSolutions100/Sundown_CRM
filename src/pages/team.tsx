import { useState } from 'react';
import { UserCog, Users, Clock, Pencil, Check, X, Lightbulb } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Select, Field, Dialog, Table, THead, TBody, TR, TH, TD, Stat, PageHeader, Avatar, useToast, type Tone } from '@/components/ui';
import { DivisionBadge } from '@/components/shared';
import { money } from '@/lib/utils';
import type { Role, TeamMember } from '@/data/types';

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', ops: 'Ops Manager', foreman: 'Foreman', crew: 'Crew' };
const ROLE_TONE: Record<Role, Tone> = { owner: 'accent', ops: 'primary', foreman: 'info', crew: 'neutral' };

const CAPABILITIES: { name: string; owner: boolean; ops: boolean; foreman: boolean; crew: boolean }[] = [
  { name: 'See pricing & margins', owner: true, ops: false, foreman: false, crew: false },
  { name: 'Approve invoices', owner: true, ops: true, foreman: false, crew: false },
  { name: 'Schedule & dispatch', owner: true, ops: true, foreman: true, crew: false },
  { name: 'Enter service requests', owner: true, ops: true, foreman: true, crew: true },
  { name: 'Submit work orders', owner: true, ops: true, foreman: true, crew: true },
  { name: 'Enter backflow tests', owner: true, ops: true, foreman: true, crew: true },
  { name: 'See own hours & pay', owner: true, ops: true, foreman: true, crew: true },
  { name: 'Manage services & pricing', owner: true, ops: false, foreman: false, crew: false },
  { name: 'Manage team', owner: true, ops: true, foreman: false, crew: false },
];

export default function Team() {
  const { data, update, role } = useStore();
  const toast = useToast();
  const [edit, setEdit] = useState<TeamMember | null>(null);
  const [addTo, setAddTo] = useState<Record<string, string>>({});

  const todayEntries = data.timeEntries.filter((t) => t.date === data.today);
  const onClock = todayEntries.filter((t) => !t.clockOut).length;
  const isOwner = role === 'owner';

  return (
    <div>
      <PageHeader eyebrow="Setup" title="Team & roles" subtitle="Crews, logins and what each role can see." />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Team members" value={data.team.length} icon={<Users />} />
        <Stat label="Crews" value={data.crews.length} icon={<UserCog />} />
        <Stat label="On the clock now" value={onClock} tone="success" icon={<Clock />} />
      </div>

      <div className="mb-6 rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
          <p>David's goal: train an ops manager on this instead of on five years of head-knowledge. Everything they need is in the sidebar; pricing and margins stay owner-only.</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {data.crews.map((c) => {
          const members = data.team.filter((m) => m.crewId === c.id);
          const lead = data.team.find((m) => m.id === c.leadId);
          const candidates = data.team.filter((m) => m.crewId !== c.id && m.role !== 'owner');
          return (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: `hsl(${c.color})` }} />
                  <CardTitle>{c.name}</CardTitle>
                  <DivisionBadge division={c.division} />
                </div>
                <CardDescription>Lead: {lead?.name ?? '—'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <span key={m.id} className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-sm">
                      <Avatar name={m.name} hue={c.color} className="size-6 text-[10px]" />
                      {m.name}
                      {m.id === c.leadId && <Badge tone="info">Lead</Badge>}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select value={addTo[c.id] ?? ''} onChange={(e) => setAddTo({ ...addTo, [c.id]: e.target.value })} className="max-w-xs">
                    <option value="">Add member to crew…</option>
                    {candidates.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!addTo[c.id]}
                    onClick={() => {
                      update((d) => {
                        const m = d.team.find((x) => x.id === addTo[c.id]);
                        if (m) m.crewId = c.id;
                      });
                      toast({ title: 'Crew updated' });
                      setAddTo({ ...addTo, [c.id]: '' });
                    }}
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Role</TH>
                <TH>Crew</TH>
                <TH>Phone</TH>
                <TH>Email</TH>
                <TH className="text-right">Loaded cost / hr</TH>
                <TH>Tester license</TH>
                <TH>Today</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {data.team.map((m) => {
                const te = todayEntries.find((t) => t.memberId === m.id);
                const crew = data.crews.find((c) => c.id === m.crewId);
                return (
                  <TR key={m.id}>
                    <TD>
                      <span className="inline-flex items-center gap-2 font-medium"><Avatar name={m.name} hue={crew?.color ?? '24 90% 59%'} className="size-7 text-[10px]" /> {m.name}</span>
                    </TD>
                    <TD><Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge></TD>
                    <TD className="text-sm">{crew?.name ?? <span className="text-muted-foreground">—</span>}</TD>
                    <TD className="text-sm">{m.phone}</TD>
                    <TD className="text-sm text-muted-foreground">{m.email}</TD>
                    <TD className="text-right tabular">{isOwner ? money(m.hourlyCost) : '••'}</TD>
                    <TD className="font-mono text-xs">{m.testerLicense ?? <span className="text-muted-foreground">—</span>}</TD>
                    <TD>{te ? (te.clockOut ? <Badge tone="neutral">Clocked out</Badge> : <Badge tone="success" dot>On the clock</Badge>) : <Badge tone="outline">Not in</Badge>}</TD>
                    <TD className="text-right"><Button size="xs" variant="ghost" onClick={() => setEdit(m)}><Pencil /></Button></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>What each login can see and do.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Capability</TH>
                <TH className="text-center">Owner</TH>
                <TH className="text-center">Ops Manager</TH>
                <TH className="text-center">Foreman</TH>
                <TH className="text-center">Crew</TH>
              </TR>
            </THead>
            <TBody>
              {CAPABILITIES.map((c) => (
                <TR key={c.name}>
                  <TD className="font-medium">{c.name}</TD>
                  {(['owner', 'ops', 'foreman', 'crew'] as const).map((r) => (
                    <TD key={r} className="text-center">{c[r] ? <Check className="mx-auto size-4 text-success" /> : <X className="mx-auto size-4 text-muted-foreground/40" />}</TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {edit && (
        <Dialog
          open
          onClose={() => setEdit(null)}
          title={`Edit ${edit.name}`}
          footer={
            <>
              <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  update((d) => {
                    const i = d.team.findIndex((m) => m.id === edit.id);
                    if (i >= 0) d.team[i] = edit;
                  });
                  toast({ title: 'Member saved' });
                  setEdit(null);
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Role">
              <Select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
                <option value="owner">Owner</option>
                <option value="ops">Ops Manager</option>
                <option value="foreman">Foreman</option>
                <option value="crew">Crew</option>
              </Select>
            </Field>
            <Field label="Crew">
              <Select value={edit.crewId ?? ''} onChange={(e) => setEdit({ ...edit, crewId: e.target.value || undefined })}>
                <option value="">None</option>
                {data.crews.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Phone"><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Loaded cost / hr" hint="Wage + taxes + insurance. Drives job costing."><Input type="number" value={edit.hourlyCost} disabled={!isOwner} onChange={(e) => setEdit({ ...edit, hourlyCost: Number(e.target.value) })} /></Field>
            <Field label="Backflow tester license"><Input value={edit.testerLicense ?? ''} onChange={(e) => setEdit({ ...edit, testerLicense: e.target.value || undefined })} placeholder="ID-BAT-00000" /></Field>
          </div>
        </Dialog>
      )}
    </div>
  );
}
