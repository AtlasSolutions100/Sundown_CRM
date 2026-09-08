import { useMemo, useState, type ChangeEvent } from 'react';
import { Droplets, FileText, Send, Plus, Pencil, ClipboardCheck, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Select, Textarea, Field, Dialog, Tabs, Table, THead, TBody, TR, TH, TD, Stat, PageHeader, EmptyState, useToast, Switch, type Tone } from '@/components/ui';
import { useLookups, JobStatusBadge, ClientLink } from '@/components/shared';
import { fmtDate, fmtDateLong, fmtDateTime, cn, uid } from '@/lib/utils';
import type { BackflowDevice, BackflowReadings, BackflowTest, BackflowType, Purveyor } from '@/data/types';

type Tab = 'devices' | 'tests' | 'purveyors' | 'season';

const TYPE_TONE: Record<BackflowType, Tone> = { PVB: 'info', RP: 'primary', DC: 'neutral' };

function evaluate(type: BackflowType, r: BackflowReadings): 'pass' | 'fail' {
  if (type === 'PVB') return (r.airInletOpenedPsid ?? 0) >= 1 && (r.checkValveHeldPsid ?? 0) >= 1 ? 'pass' : 'fail';
  if (type === 'RP') return (r.cv1Psid ?? 0) >= 5 && !!r.cv2Tight && (r.reliefOpenedPsid ?? 0) >= 2 ? 'pass' : 'fail';
  return (r.dcCv1Psid ?? 0) >= 1 && (r.dcCv2Psid ?? 0) >= 1 ? 'pass' : 'fail';
}

function readingsSummary(type: BackflowType, r: BackflowReadings) {
  if (type === 'PVB') return `Air inlet ${r.airInletOpenedPsid ?? '—'} psid · CV ${r.checkValveHeldPsid ?? '—'} psid · Line ${r.linePsi ?? '—'} psi`;
  if (type === 'RP') return `CV1 ${r.cv1Psid ?? '—'} psid · CV2 ${r.cv2Tight ? 'tight' : 'leak'} · RV ${r.reliefOpenedPsid ?? '—'} psid · Line ${r.linePsi ?? '—'} psi`;
  return `CV1 ${r.dcCv1Psid ?? '—'} psid · CV2 ${r.dcCv2Psid ?? '—'} psid · Line ${r.linePsi ?? '—'} psi`;
}

export default function Backflow() {
  const { data, update, actions } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('devices');
  const [search, setSearch] = useState('');
  const [purveyorFilter, setPurveyorFilter] = useState('all');
  const [testFor, setTestFor] = useState<BackflowDevice | null>(null);
  const [editDevice, setEditDevice] = useState<Partial<BackflowDevice> | null>(null);
  const [viewTest, setViewTest] = useState<BackflowTest | null>(null);
  const [editPurveyor, setEditPurveyor] = useState<Purveyor | null>(null);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [scheduleFor, setScheduleFor] = useState<{ jobId: string; date: string; crewId: string } | null>(null);

  const year = data.today.slice(0, 4);
  const testsThisYear = data.backflowTests.filter((t) => t.date.startsWith(year));
  const latestTest = (deviceId: string) => data.backflowTests.filter((t) => t.deviceId === deviceId).sort((a, b) => b.date.localeCompare(a.date))[0];
  const failed = testsThisYear.filter((t) => t.result === 'fail').length;
  const unsent = testsThisYear.filter((t) => !t.sentToPurveyorAt).length;

  const deviceGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = data.backflowDevices.filter((d) => {
      if (purveyorFilter !== 'all' && d.purveyorId !== purveyorFilter) return false;
      if (!q) return true;
      const p = L.property(d.propertyId);
      const c = L.client(p?.clientId);
      return [d.make, d.model, d.serial, d.location, p?.name, p?.address, c?.name].some((s) => s?.toLowerCase().includes(q));
    });
    const map = new Map<string, BackflowDevice[]>();
    for (const d of filtered) (map.get(d.propertyId) ?? map.set(d.propertyId, []).get(d.propertyId)!).push(d);
    return [...map.entries()];
  }, [data.backflowDevices, search, purveyorFilter, L]);

  const seasonRows = useMemo(() => {
    const propIds = [...new Set(data.backflowDevices.map((d) => d.propertyId))];
    return propIds
      .map((pid) => {
        const devices = data.backflowDevices.filter((d) => d.propertyId === pid);
        const tested = devices.filter((d) => testsThisYear.some((t) => t.deviceId === d.id)).length;
        const allSent = devices.every((d) => testsThisYear.find((t) => t.deviceId === d.id)?.sentToPurveyorAt);
        const job = data.jobs.find((j) => j.propertyId === pid && j.serviceId === 'svc_backflow');
        return { pid, devices, tested, allSent, job };
      })
      .sort((a, b) => a.tested / a.devices.length - b.tested / b.devices.length);
  }, [data.backflowDevices, data.jobs, testsThisYear]);

  const sortedTests = [...data.backflowTests].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader
        eyebrow="Backflow"
        title="Backflow devices & testing"
        subtitle="Every assembly on file, tested from the phone, reported to the purveyor in one email per property."
        actions={
          <Button onClick={() => setEditDevice({ type: 'PVB', size: '1"', hazard: 'irrigation', installYear: Number(year) })}>
            <Plus /> Add device
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Devices on file" value={data.backflowDevices.length} icon={<Droplets />} />
        <Stat label="Tested this season" value={`${testsThisYear.length}`} sub={`of ${data.backflowDevices.length} devices`} tone="success" icon={<ClipboardCheck />} />
        <Stat label="Failed / repaired" value={failed} tone={failed ? 'warning' : 'default'} icon={<AlertTriangle />} />
        <Stat label="Reports not sent" value={unsent} tone={unsent ? 'danger' : 'default'} icon={<Send />} onClick={() => setTab('tests')} />
        <Stat label="Hours saved" value={`${(testsThisYear.length * 0.3).toFixed(1)} h`} sub="vs. handwriting reports" tone="accent" icon={<Clock />} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: 'devices', label: 'Devices', count: data.backflowDevices.length },
          { value: 'tests', label: 'Tests', count: data.backflowTests.length },
          { value: 'purveyors', label: 'Purveyors', count: data.purveyors.length },
          { value: 'season', label: 'Season status' },
        ]}
      />

      {tab === 'devices' && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center gap-2">
            <Input placeholder="Search make, serial, property, client…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={purveyorFilter} onChange={(e) => setPurveyorFilter(e.target.value)} className="max-w-xs">
              <option value="all">All purveyors</option>
              {data.purveyors.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </CardHeader>
          <CardContent>
            {deviceGroups.length === 0 ? (
              <EmptyState icon={<Droplets />} title="No devices match" />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Make / model</TH>
                    <TH>Type</TH>
                    <TH>Size</TH>
                    <TH>Serial</TH>
                    <TH>Location</TH>
                    <TH>Installed</TH>
                    <TH>Last test</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {deviceGroups.map(([pid, devices]) => {
                    const p = L.property(pid);
                    const pv = L.purveyor(p?.purveyorId ?? devices[0].purveyorId);
                    return [
                      <TR key={`h-${pid}`} className="bg-muted/50 hover:bg-muted/50">
                        <TD colSpan={8} className="py-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="font-semibold">{p?.name}</span>
                            <ClientLink id={p?.clientId} className="text-muted-foreground font-normal" />
                            <span className="text-muted-foreground">· {pv?.name}</span>
                            <Badge tone="outline">{devices.length} device{devices.length === 1 ? '' : 's'}</Badge>
                          </div>
                        </TD>
                      </TR>,
                      ...devices.map((d) => {
                        const lt = latestTest(d.id);
                        return (
                          <TR key={d.id}>
                            <TD className="font-medium">{d.make} {d.model}</TD>
                            <TD><Badge tone={TYPE_TONE[d.type]}>{d.type}</Badge></TD>
                            <TD>{d.size}</TD>
                            <TD className="font-mono text-xs">{d.serial}</TD>
                            <TD className="text-muted-foreground">{d.location}</TD>
                            <TD>{d.installYear}</TD>
                            <TD>
                              {lt && lt.date.startsWith(year) ? (
                                <span className="inline-flex items-center gap-2">
                                  <Badge tone={lt.result === 'pass' ? 'success' : 'danger'}>{lt.result.toUpperCase()}</Badge>
                                  <span className="text-xs text-muted-foreground">{fmtDate(lt.date)}</span>
                                </span>
                              ) : (
                                <Badge tone="warning" dot>Not tested this year</Badge>
                              )}
                            </TD>
                            <TD className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="xs" variant="accent" onClick={() => setTestFor(d)}><ClipboardCheck /> Enter test</Button>
                                <Button size="xs" variant="ghost" onClick={() => setEditDevice(d)}><Pencil /></Button>
                              </div>
                            </TD>
                          </TR>
                        );
                      }),
                    ];
                  })}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'tests' && (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Test log</CardTitle>
              <CardDescription>Reports are bundled into one email per property / purveyor.</CardDescription>
            </div>
            <Button
              disabled={!selectedTests.length}
              onClick={() => {
                actions.sendBackflowReports(selectedTests);
                toast({ title: `${selectedTests.length} report${selectedTests.length === 1 ? '' : 's'} sent to purveyor`, description: 'Bundled by property. Copies attached to each client record.' });
                setSelectedTests([]);
              }}
            >
              <Send /> Send selected to purveyor
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH className="w-8"></TH>
                  <TH>Date</TH>
                  <TH>Property</TH>
                  <TH>Device</TH>
                  <TH>Tester</TH>
                  <TH>Result</TH>
                  <TH>Readings</TH>
                  <TH>Report sent</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {sortedTests.map((t) => {
                  const d = data.backflowDevices.find((x) => x.id === t.deviceId);
                  const p = L.property(d?.propertyId);
                  const tester = L.member(t.testerId);
                  return (
                    <TR key={t.id}>
                      <TD>
                        <input
                          type="checkbox"
                          disabled={!!t.sentToPurveyorAt}
                          checked={selectedTests.includes(t.id)}
                          onChange={(e) => setSelectedTests((s) => (e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id)))}
                        />
                      </TD>
                      <TD>{fmtDate(t.date)}</TD>
                      <TD className="font-medium">{p?.name}</TD>
                      <TD>
                        <div>{d?.make} {d?.model}</div>
                        <div className="font-mono text-xs text-muted-foreground">{d?.serial}</div>
                      </TD>
                      <TD>{tester?.name}</TD>
                      <TD><Badge tone={t.result === 'pass' ? 'success' : 'danger'}>{t.result.toUpperCase()}</Badge></TD>
                      <TD className="text-xs text-muted-foreground">{d ? readingsSummary(d.type, t.readings) : ''}</TD>
                      <TD>{t.sentToPurveyorAt ? <span className="text-xs text-muted-foreground">{fmtDateTime(t.sentToPurveyorAt)}</span> : <Badge tone="warning" dot>Not sent</Badge>}</TD>
                      <TD className="text-right">
                        <Button size="xs" variant="outline" onClick={() => setViewTest(t)}><FileText /> View report</Button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 'purveyors' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.purveyors.map((pv) => {
            const devCount = data.backflowDevices.filter((d) => d.purveyorId === pv.id).length;
            const filed = testsThisYear.filter((t) => data.backflowDevices.find((d) => d.id === t.deviceId)?.purveyorId === pv.id && t.sentToPurveyorAt).length;
            return (
              <Card key={pv.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="leading-snug">{pv.name}</CardTitle>
                    <Button size="xs" variant="ghost" onClick={() => setEditPurveyor(pv)}><Pencil /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Badge tone={pv.submitMethod === 'email' ? 'info' : pv.submitMethod === 'portal' ? 'accent' : 'neutral'}>{pv.submitMethod}</Badge>
                    <Badge tone="outline">{devCount} devices</Badge>
                    <Badge tone="success">{filed} filed {year}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div>{pv.email}</div>
                  <div className="text-muted-foreground">{pv.phone}</div>
                  {pv.portalUrl && (
                    <a href={pv.portalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Portal <ExternalLink className="size-3" />
                    </a>
                  )}
                  {pv.notes && <p className="pt-1 text-xs text-muted-foreground">{pv.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'season' && (
        <Card>
          <CardHeader>
            <CardTitle>{year} test season</CardTitle>
            <CardDescription>Untested properties float to the top. Window: May 1 – Jun 30.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Property</TH>
                  <TH>Client</TH>
                  <TH>Devices</TH>
                  <TH>Tested</TH>
                  <TH>Reports</TH>
                  <TH>Test job</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {seasonRows.map((r) => {
                  const p = L.property(r.pid);
                  const complete = r.tested === r.devices.length;
                  return (
                    <TR key={r.pid}>
                      <TD className="font-medium">{p?.name}</TD>
                      <TD><ClientLink id={p?.clientId} /></TD>
                      <TD>{r.devices.length}</TD>
                      <TD>
                        <Badge tone={complete ? 'success' : r.tested ? 'warning' : 'danger'} dot>{r.tested} / {r.devices.length}</Badge>
                      </TD>
                      <TD>{complete ? (r.allSent ? <Badge tone="success">All sent</Badge> : <Badge tone="warning">Pending send</Badge>) : <span className="text-muted-foreground">—</span>}</TD>
                      <TD>{r.job ? <JobStatusBadge status={r.job.status} /> : <span className="text-xs text-muted-foreground">Not on contract</span>}</TD>
                      <TD className="text-right">
                        {r.job && r.job.status === 'unscheduled' && (
                          <Button size="xs" onClick={() => setScheduleFor({ jobId: r.job!.id, date: data.today, crewId: 'crew_irr' })}>Schedule test</Button>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {testFor && <TestDialog device={testFor} onClose={() => setTestFor(null)} />}

      {editDevice && <DeviceDialog draft={editDevice} onClose={() => setEditDevice(null)} />}

      {viewTest && <ReportDialog test={viewTest} onClose={() => setViewTest(null)} />}

      {editPurveyor && (
        <Dialog
          open
          onClose={() => setEditPurveyor(null)}
          title="Edit purveyor"
          footer={
            <>
              <Button variant="outline" onClick={() => setEditPurveyor(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  update((d) => {
                    const i = d.purveyors.findIndex((p) => p.id === editPurveyor.id);
                    if (i >= 0) d.purveyors[i] = editPurveyor;
                  });
                  toast({ title: 'Purveyor saved' });
                  setEditPurveyor(null);
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" className="sm:col-span-2"><Input value={editPurveyor.name} onChange={(e) => setEditPurveyor({ ...editPurveyor, name: e.target.value })} /></Field>
            <Field label="Email"><Input value={editPurveyor.email} onChange={(e) => setEditPurveyor({ ...editPurveyor, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={editPurveyor.phone} onChange={(e) => setEditPurveyor({ ...editPurveyor, phone: e.target.value })} /></Field>
            <Field label="Submit method">
              <Select value={editPurveyor.submitMethod} onChange={(e) => setEditPurveyor({ ...editPurveyor, submitMethod: e.target.value as Purveyor['submitMethod'] })}>
                <option value="email">Email</option>
                <option value="portal">Portal</option>
                <option value="fax">Fax</option>
              </Select>
            </Field>
            <Field label="Portal URL"><Input value={editPurveyor.portalUrl ?? ''} onChange={(e) => setEditPurveyor({ ...editPurveyor, portalUrl: e.target.value || undefined })} /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea value={editPurveyor.notes ?? ''} onChange={(e) => setEditPurveyor({ ...editPurveyor, notes: e.target.value })} /></Field>
          </div>
        </Dialog>
      )}

      {scheduleFor && (
        <Dialog
          open
          onClose={() => setScheduleFor(null)}
          title="Schedule backflow test"
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setScheduleFor(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  actions.scheduleJob(scheduleFor.jobId, scheduleFor.date, scheduleFor.crewId);
                  toast({ title: 'Test scheduled', description: `${fmtDateLong(scheduleFor.date)} · ${L.crew(scheduleFor.crewId)?.name}` });
                  setScheduleFor(null);
                }}
              >
                Schedule
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="Date"><Input type="date" value={scheduleFor.date} onChange={(e) => setScheduleFor({ ...scheduleFor, date: e.target.value })} /></Field>
            <Field label="Crew">
              <Select value={scheduleFor.crewId} onChange={(e) => setScheduleFor({ ...scheduleFor, crewId: e.target.value })}>
                {data.crews.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Test entry dialog
function TestDialog({ device, onClose }: { device: BackflowDevice; onClose: () => void }) {
  const { data, actions } = useStore();
  const L = useLookups();
  const toast = useToast();
  const testers = data.team.filter((m) => m.testerLicense);
  const [testerId, setTesterId] = useState(testers[0]?.id ?? '');
  const [gaugeSerial, setGaugeSerial] = useState('MT-2000-11893');
  const [gaugeCalDate, setGaugeCalDate] = useState('2026-02-11');
  const [date, setDate] = useState(data.today);
  const [readings, setReadings] = useState<BackflowReadings>({ cv2Tight: true });
  const [override, setOverride] = useState<'auto' | 'pass' | 'fail'>('auto');
  const [repairs, setRepairs] = useState('');
  const [notes, setNotes] = useState('');
  const p = L.property(device.propertyId);
  const pv = L.purveyor(device.purveyorId);
  const auto = evaluate(device.type, readings);
  const result = override === 'auto' ? auto : override;
  const num = (k: keyof BackflowReadings) => (e: ChangeEvent<HTMLInputElement>) => setReadings((r) => ({ ...r, [k]: e.target.value === '' ? undefined : Number(e.target.value) }));
  const job = data.jobs.find((j) => j.propertyId === device.propertyId && j.serviceId === 'svc_backflow' && j.status !== 'done');

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Test: ${device.make} ${device.model} (${device.type})`}
      description={`${p?.name} · ${device.location} · S/N ${device.serial} · ${pv?.name}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant={result === 'pass' ? 'success' : 'destructive'}
            onClick={() => {
              actions.recordBackflowTest({ deviceId: device.id, jobId: job?.id, date, testerId, gaugeSerial, gaugeCalDate, result, readings, repairs: repairs || undefined, notes: notes || undefined });
              toast({ title: `Test recorded – ${result.toUpperCase()}`, description: 'Report generated. Send it from the Tests tab.' });
              onClose();
            }}
          >
            Save {result.toUpperCase()}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tester">
            <Select value={testerId} onChange={(e) => setTesterId(e.target.value)}>
              {testers.map((m) => (
                <option key={m.id} value={m.id}>{m.name} · {m.testerLicense}</option>
              ))}
            </Select>
          </Field>
          <Field label="Test date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Gauge serial"><Input value={gaugeSerial} onChange={(e) => setGaugeSerial(e.target.value)} /></Field>
          <Field label="Gauge calibration date"><Input type="date" value={gaugeCalDate} onChange={(e) => setGaugeCalDate(e.target.value)} /></Field>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Readings · {device.type}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {device.type === 'PVB' && (
              <>
                <Field label="Air inlet opened (psid)" hint="≥ 1.0 to pass"><Input type="number" step="0.1" value={readings.airInletOpenedPsid ?? ''} onChange={num('airInletOpenedPsid')} /></Field>
                <Field label="Check valve held (psid)" hint="≥ 1.0 to pass"><Input type="number" step="0.1" value={readings.checkValveHeldPsid ?? ''} onChange={num('checkValveHeldPsid')} /></Field>
              </>
            )}
            {device.type === 'RP' && (
              <>
                <Field label="Check valve 1 (psid)" hint="≥ 5.0 to pass"><Input type="number" step="0.1" value={readings.cv1Psid ?? ''} onChange={num('cv1Psid')} /></Field>
                <Field label="Check valve 2">
                  <div className="pt-1.5"><Switch checked={!!readings.cv2Tight} onChange={(v) => setReadings((r) => ({ ...r, cv2Tight: v }))} label={readings.cv2Tight ? 'Closed tight' : 'Leaking'} /></div>
                </Field>
                <Field label="Relief valve opened (psid)" hint="≥ 2.0 to pass"><Input type="number" step="0.1" value={readings.reliefOpenedPsid ?? ''} onChange={num('reliefOpenedPsid')} /></Field>
              </>
            )}
            {device.type === 'DC' && (
              <>
                <Field label="Check valve 1 (psid)" hint="≥ 1.0 to pass"><Input type="number" step="0.1" value={readings.dcCv1Psid ?? ''} onChange={num('dcCv1Psid')} /></Field>
                <Field label="Check valve 2 (psid)" hint="≥ 1.0 to pass"><Input type="number" step="0.1" value={readings.dcCv2Psid ?? ''} onChange={num('dcCv2Psid')} /></Field>
              </>
            )}
            <Field label="Line pressure (psi)"><Input type="number" value={readings.linePsi ?? ''} onChange={num('linePsi')} /></Field>
          </div>
        </div>

        <div className={cn('flex items-center justify-between rounded-lg border p-4', result === 'pass' ? 'border-success/40 bg-success/10' : 'border-destructive/40 bg-destructive/10')}>
          <div>
            <div className={cn('text-3xl font-black tracking-tight', result === 'pass' ? 'text-success' : 'text-destructive')}>{result.toUpperCase()}</div>
            <div className="text-xs text-muted-foreground">Auto-evaluated: {auto.toUpperCase()}{override !== 'auto' ? ' · overridden' : ''}</div>
          </div>
          <Field label="Override">
            <Select value={override} onChange={(e) => setOverride(e.target.value as typeof override)} className="w-36">
              <option value="auto">Auto</option>
              <option value="pass">Force PASS</option>
              <option value="fail">Force FAIL</option>
            </Select>
          </Field>
        </div>

        <Field label="Repairs made (if any)"><Textarea value={repairs} onChange={(e) => setRepairs(e.target.value)} placeholder="e.g. Replaced bonnet & poppet kit, retested PASS" /></Field>
        <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[56px]" /></Field>
        {job && <p className="text-xs text-muted-foreground">Linked to job “{job.title}” ({job.status.replace('_', ' ')}).</p>}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Device dialog
function DeviceDialog({ draft, onClose }: { draft: Partial<BackflowDevice>; onClose: () => void }) {
  const { data, update } = useStore();
  const toast = useToast();
  const isNew = !draft.id;
  const initialClient = draft.propertyId ? data.properties.find((p) => p.id === draft.propertyId)?.clientId ?? '' : '';
  const [clientId, setClientId] = useState(initialClient);
  const [d, setD] = useState<Partial<BackflowDevice>>({ ...draft });
  const props = data.properties.filter((p) => p.clientId === clientId);
  const set = <K extends keyof BackflowDevice>(k: K, v: BackflowDevice[K]) => setD((x) => ({ ...x, [k]: v }));
  const valid = d.propertyId && d.make && d.model && d.serial && d.purveyorId;

  return (
    <Dialog
      open
      onClose={onClose}
      title={isNew ? 'Add backflow device' : 'Edit device'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => {
              update((s) => {
                if (isNew)
                  s.backflowDevices.push({
                    id: uid('bf'),
                    propertyId: d.propertyId!,
                    make: d.make!,
                    model: d.model!,
                    type: d.type ?? 'PVB',
                    size: d.size ?? '1"',
                    serial: d.serial!,
                    location: d.location ?? '',
                    hazard: d.hazard ?? 'irrigation',
                    installYear: d.installYear ?? 2026,
                    purveyorId: d.purveyorId!,
                    purveyorAccountNo: d.purveyorAccountNo,
                  });
                else {
                  const i = s.backflowDevices.findIndex((x) => x.id === d.id);
                  if (i >= 0) s.backflowDevices[i] = { ...s.backflowDevices[i], ...(d as BackflowDevice) };
                }
              });
              toast({ title: isNew ? 'Device added' : 'Device saved' });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client">
          <Select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              const first = data.properties.find((p) => p.clientId === e.target.value);
              set('propertyId', first?.id ?? '');
              if (first?.purveyorId) set('purveyorId', first.purveyorId);
            }}
          >
            <option value="">Select client…</option>
            {data.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Property">
          <Select value={d.propertyId ?? ''} onChange={(e) => { set('propertyId', e.target.value); const pv = data.properties.find((p) => p.id === e.target.value)?.purveyorId; if (pv) set('purveyorId', pv); }}>
            <option value="">Select property…</option>
            {props.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Make"><Input value={d.make ?? ''} onChange={(e) => set('make', e.target.value)} placeholder="Febco" /></Field>
        <Field label="Model"><Input value={d.model ?? ''} onChange={(e) => set('model', e.target.value)} placeholder="765-1" /></Field>
        <Field label="Type">
          <Select value={d.type ?? 'PVB'} onChange={(e) => set('type', e.target.value as BackflowType)}>
            <option value="PVB">PVB – Pressure Vacuum Breaker</option>
            <option value="RP">RP – Reduced Pressure</option>
            <option value="DC">DC – Double Check</option>
          </Select>
        </Field>
        <Field label="Size"><Input value={d.size ?? ''} onChange={(e) => set('size', e.target.value)} placeholder='1"' /></Field>
        <Field label="Serial"><Input value={d.serial ?? ''} onChange={(e) => set('serial', e.target.value)} /></Field>
        <Field label="Location on property"><Input value={d.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="NE corner by mailbox kiosk" /></Field>
        <Field label="Hazard">
          <Select value={d.hazard ?? 'irrigation'} onChange={(e) => set('hazard', e.target.value as BackflowDevice['hazard'])}>
            <option value="irrigation">Irrigation</option>
            <option value="fire">Fire</option>
            <option value="domestic">Domestic</option>
          </Select>
        </Field>
        <Field label="Install year"><Input type="number" value={d.installYear ?? ''} onChange={(e) => set('installYear', Number(e.target.value))} /></Field>
        <Field label="Water purveyor">
          <Select value={d.purveyorId ?? ''} onChange={(e) => set('purveyorId', e.target.value)}>
            <option value="">Select…</option>
            {data.purveyors.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Purveyor account #"><Input value={d.purveyorAccountNo ?? ''} onChange={(e) => set('purveyorAccountNo', e.target.value || undefined)} /></Field>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Printable report
function ReportDialog({ test, onClose }: { test: BackflowTest; onClose: () => void }) {
  const { data } = useStore();
  const L = useLookups();
  const device = data.backflowDevices.find((d) => d.id === test.deviceId);
  const p = L.property(device?.propertyId);
  const c = L.client(p?.clientId);
  const pv = L.purveyor(device?.purveyorId);
  const tester = L.member(test.testerId);
  const r = test.readings;
  const rows: [string, string][] =
    device?.type === 'PVB'
      ? [['Air inlet opened at', `${r.airInletOpenedPsid ?? '—'} psid`], ['Check valve held at', `${r.checkValveHeldPsid ?? '—'} psid`], ['Line pressure', `${r.linePsi ?? '—'} psi`]]
      : device?.type === 'RP'
        ? [['Check valve #1', `${r.cv1Psid ?? '—'} psid`], ['Check valve #2', r.cv2Tight ? 'Closed tight' : 'Leaked'], ['Relief valve opened at', `${r.reliefOpenedPsid ?? '—'} psid`], ['Line pressure', `${r.linePsi ?? '—'} psi`]]
        : [['Check valve #1', `${r.dcCv1Psid ?? '—'} psid`], ['Check valve #2', `${r.dcCv2Psid ?? '—'} psid`], ['Line pressure', `${r.linePsi ?? '—'} psi`]];

  return (
    <Dialog open onClose={onClose} title="Backflow assembly test report" description={test.sentToPurveyorAt ? `Sent to purveyor ${fmtDateTime(test.sentToPurveyorAt)}` : 'Not yet sent'} size="lg" footer={<Button variant="outline" onClick={onClose}>Close</Button>}>
      <div className="rounded-lg border bg-white p-6 text-sm text-[hsl(205_30%_14%)] shadow-inner">
        <div className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="text-lg font-bold">{data.settings.name}</div>
            <div className="text-xs">{data.settings.address}, {data.settings.city}</div>
            <div className="text-xs">{data.settings.serviceLine} · {data.settings.email}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted to</div>
            <div className="font-semibold">{pv?.name}</div>
            <div className="text-xs">{pv?.email}</div>
            {device?.purveyorAccountNo && <div className="text-xs">Acct {device.purveyorAccountNo}</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service address</div>
            <div className="font-medium">{p?.address}, {p?.city}</div>
            <div>{p?.name}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner / customer</div>
            <div className="font-medium">{c?.name}</div>
            <div>{c?.contactName}</div>
            <div className="text-xs">{c?.phone}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assembly</div>
            <div className="font-medium">{device?.make} {device?.model} · {device?.type} · {device?.size}</div>
            <div className="font-mono text-xs">S/N {device?.serial}</div>
            <div className="text-xs">{device?.location} · {device?.hazard} hazard</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tester</div>
            <div className="font-medium">{tester?.name}</div>
            <div className="text-xs">License {tester?.testerLicense}</div>
            <div className="text-xs">Gauge {test.gaugeSerial} · calibrated {fmtDateLong(test.gaugeCalDate)}</div>
          </div>
        </div>
        <table className="w-full border-t text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b">
                <td className="py-1.5 text-muted-foreground">{k}</td>
                <td className="py-1.5 text-right font-medium tabular">{v}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-semibold">Test date</td>
              <td className="py-2 text-right">{fmtDateLong(test.date)}</td>
            </tr>
          </tbody>
        </table>
        {test.repairs && (
          <div className="mt-3 rounded border border-dashed p-2 text-xs"><span className="font-semibold">Repairs:</span> {test.repairs}</div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <div className={cn('rounded px-3 py-1 text-lg font-black', test.result === 'pass' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')}>{test.result.toUpperCase()}</div>
          <div className="text-right text-xs">
            <div className="mb-6 w-56 border-b border-foreground/50" />
            Tester signature · {tester?.name}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
