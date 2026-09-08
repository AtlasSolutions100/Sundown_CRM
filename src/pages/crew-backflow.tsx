import { useMemo, useState } from 'react';
import { ChevronLeft, CheckCircle2, XCircle, Send, FileText, Droplets } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardContent, Badge, Input, Select, Textarea, Field, Switch, Dialog, useToast } from '@/components/ui';
import { cn, fmtDateLong, fmtTime } from '@/lib/utils';
import type { BackflowDevice, BackflowReadings, BackflowTest } from '@/data/types';

const YEAR = '2026';

function evaluate(type: BackflowDevice['type'], r: BackflowReadings): 'pass' | 'fail' {
  if (type === 'PVB') return (r.airInletOpenedPsid ?? 0) >= 1.0 && (r.checkValveHeldPsid ?? 0) >= 1.0 ? 'pass' : 'fail';
  if (type === 'RP') return (r.cv1Psid ?? 0) >= 5.0 && !!r.cv2Tight && (r.reliefOpenedPsid ?? 0) >= 2.0 ? 'pass' : 'fail';
  return (r.dcCv1Psid ?? 0) >= 1.0 && (r.dcCv2Psid ?? 0) >= 1.0 ? 'pass' : 'fail';
}

export default function CrewBackflow() {
  const { data, actions, currentUser } = useStore();
  const toast = useToast();

  const propsWithDevices = useMemo(() => data.properties.filter((p) => data.backflowDevices.some((d) => d.propertyId === p.id)), [data.properties, data.backflowDevices]);
  const grouped = useMemo(() => {
    const map = new Map<string, typeof propsWithDevices>();
    for (const p of propsWithDevices) {
      const c = data.clients.find((c) => c.id === p.clientId);
      const key = c?.name ?? 'Other';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [propsWithDevices, data.clients]);

  const [propertyId, setPropertyId] = useState(propsWithDevices[0]?.id ?? '');
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [previewId, setPreviewId] = useState<string | undefined>();

  const property = data.properties.find((p) => p.id === propertyId);
  const client = data.clients.find((c) => c.id === property?.clientId);
  const devices = data.backflowDevices.filter((d) => d.propertyId === propertyId);
  const purveyor = data.purveyors.find((p) => p.id === (devices[0]?.purveyorId ?? property?.purveyorId));
  const testFor = (d: BackflowDevice) => data.backflowTests.filter((t) => t.deviceId === d.id && t.date.startsWith(YEAR)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const allTested = devices.length > 0 && devices.every((d) => !!testFor(d));
  const unsent = devices.map(testFor).filter((t): t is BackflowTest => !!t && !t.sentToPurveyorAt);
  const sentAt = devices.map(testFor).find((t) => t?.sentToPurveyorAt)?.sentToPurveyorAt;
  const backflowJob = data.jobs.find((j) => j.propertyId === propertyId && j.serviceId === 'svc_backflow' && j.status !== 'done');

  const device = devices.find((d) => d.id === deviceId);

  function sendReports() {
    if (!unsent.length) return;
    actions.sendBackflowReports(unsent.map((t) => t.id));
    toast({ title: `${unsent.length} report${unsent.length > 1 ? 's' : ''} sent`, description: purveyor?.name });
  }

  if (device) {
    return (
      <TestForm
        device={device}
        propertyName={property?.name ?? ''}
        onBack={() => setDeviceId(undefined)}
        onSave={(t) => {
          actions.recordBackflowTest({ ...t, jobId: backflowJob?.id });
          toast({ title: `Test saved — ${t.result.toUpperCase()}`, description: `${device.make} ${device.model} · ${device.serial}` });
          setDeviceId(undefined);
        }}
        testerId={currentUser.testerLicense ? currentUser.id : data.team.find((m) => m.testerLicense)?.id ?? currentUser.id}
      />
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3">
        <h1 className="text-2xl font-bold tracking-tight">Backflow test</h1>
        <p className="text-sm text-muted-foreground">Around 20 minutes of handwriting per device, gone.</p>
      </div>

      <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="h-11">
        {grouped.map(([clientName, props]) => (
          <optgroup key={clientName} label={clientName}>
            {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
        ))}
      </Select>

      {property && (
        <div className="mt-2 rounded-lg border bg-card p-3 text-sm">
          <div className="font-semibold">{property.address}, {property.city}</div>
          <div className="text-xs text-muted-foreground">{client?.name}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs">
            <Droplets className="size-3.5 text-info" />
            <span className="text-muted-foreground">Purveyor:</span> <span className="font-medium">{purveyor?.name ?? '—'}</span>
          </div>
        </div>
      )}

      <div className="mt-4 mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Devices ({devices.length})</h2>
        <span className="text-xs text-muted-foreground">{devices.filter((d) => !!testFor(d)).length} tested this year</span>
      </div>

      <div className="space-y-2">
        {devices.map((d) => {
          const t = testFor(d);
          return (
            <Card key={d.id} className={cn(t?.result === 'pass' && 'border-success/40', t?.result === 'fail' && 'border-destructive/40')}>
              <CardContent className="p-0">
                <button type="button" onClick={() => setDeviceId(d.id)} className="flex w-full items-start gap-3 p-4 text-left active:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">{d.make} {d.model}</span>
                      <Badge tone="primary">{d.type}</Badge>
                      <span className="text-xs text-muted-foreground">{d.size}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">S/N {d.serial} · {d.location}</div>
                  </div>
                  <div className="shrink-0">
                    {t ? (
                      t.result === 'pass' ? <Badge tone="success" dot>Pass</Badge> : <Badge tone="danger" dot>Fail</Badge>
                    ) : (
                      <Badge tone="warning" dot>Not tested</Badge>
                    )}
                  </div>
                </button>
                {t && (
                  <div className="flex items-center justify-between border-t px-4 py-2 text-xs">
                    <span className="text-muted-foreground">Tested {fmtDateLong(t.date)}{t.sentToPurveyorAt ? ` · report sent ${fmtTime(t.sentToPurveyorAt)}` : ''}</span>
                    <button type="button" onClick={() => setPreviewId(t.id)} className="inline-flex items-center gap-1 font-medium text-primary">
                      <FileText className="size-3.5" /> Preview report
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {allTested && (
        <div className="sticky bottom-0 -mx-4 mt-4 border-t bg-card/95 px-4 pb-3 pt-3 backdrop-blur">
          {unsent.length > 0 ? (
            <Button variant="accent" className="h-12 w-full text-base" onClick={sendReports}>
              <Send /> Send {unsent.length} report{unsent.length > 1 ? 's' : ''} to {purveyor?.name ?? 'purveyor'}
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-md border border-success/40 bg-success/5 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" /> Sent {sentAt ? fmtTime(sentAt) : ''} — one email to {purveyor?.name}
            </div>
          )}
          <div className="mt-1 text-center text-[11px] text-muted-foreground">All devices at this property bundle into one email.</div>
        </div>
      )}

      <ReportDialog testId={previewId} onClose={() => setPreviewId(undefined)} />
    </div>
  );
}

// ---------------------------------------------------------------- test form
function TestForm({ device, propertyName, testerId: initialTester, onBack, onSave }: {
  device: BackflowDevice;
  propertyName: string;
  testerId: string;
  onBack: () => void;
  onSave: (t: Omit<BackflowTest, 'id'>) => void;
}) {
  const { data } = useStore();
  const licensed = data.team.filter((m) => m.testerLicense);
  const [testerId, setTesterId] = useState(initialTester);
  const [gaugeSerial, setGaugeSerial] = useState('MT-2000-11893');
  const [gaugeCalDate, setGaugeCalDate] = useState('2026-02-11');
  const [r, setR] = useState<BackflowReadings>({ cv2Tight: true, linePsi: 65 });
  const [override, setOverride] = useState<'' | 'pass' | 'fail'>('');
  const [repairs, setRepairs] = useState('');

  const auto = evaluate(device.type, r);
  const result = override || auto;
  const tester = data.team.find((m) => m.id === testerId);

  const num = (k: keyof BackflowReadings, label: string) => (
    <NumField key={k} label={label} value={typeof r[k] === 'number' ? (r[k] as number) : undefined} onChange={(v) => setR((x) => ({ ...x, [k]: v }))} />
  );

  return (
    <div className="px-4 py-4">
      <button type="button" onClick={onBack} className="mb-3 inline-flex h-9 items-center gap-1 text-sm font-medium text-muted-foreground">
        <ChevronLeft className="size-4" /> Back to devices
      </button>
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{propertyName}</div>
        <h1 className="text-xl font-bold">{device.make} {device.model} <Badge tone="primary" className="align-middle">{device.type}</Badge></h1>
        <div className="text-xs text-muted-foreground">{device.size} · S/N {device.serial} · {device.location}</div>
      </div>

      <div className={cn('mb-4 flex items-center justify-center gap-2 rounded-lg py-4 text-2xl font-black tracking-wide text-white', result === 'pass' ? 'bg-success' : 'bg-destructive')}>
        {result === 'pass' ? <CheckCircle2 className="size-7" /> : <XCircle className="size-7" />}
        {result.toUpperCase()}
        {override && <span className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase">override</span>}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Readings</div>
          {device.type === 'PVB' && (
            <>
              {num('airInletOpenedPsid', 'Air inlet opened at (psid) — min 1.0')}
              {num('checkValveHeldPsid', 'Check valve held at (psid) — min 1.0')}
            </>
          )}
          {device.type === 'RP' && (
            <>
              {num('cv1Psid', 'Check valve #1 (psid) — min 5.0')}
              <div className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm font-medium">Check valve #2 closed tight</span>
                <Switch checked={!!r.cv2Tight} onChange={(v) => setR((x) => ({ ...x, cv2Tight: v }))} />
              </div>
              {num('reliefOpenedPsid', 'Relief valve opened at (psid) — min 2.0')}
            </>
          )}
          {device.type === 'DC' && (
            <>
              {num('dcCv1Psid', 'Check valve #1 (psid) — min 1.0')}
              {num('dcCv2Psid', 'Check valve #2 (psid) — min 1.0')}
            </>
          )}
          {num('linePsi', 'Line pressure (psi)')}
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardContent className="space-y-3 p-4">
          <Field label="Tester">
            {licensed.length > 1 ? (
              <Select value={testerId} onChange={(e) => setTesterId(e.target.value)} className="h-11">
                {licensed.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.testerLicense}</option>)}
              </Select>
            ) : (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{tester?.name} · {tester?.testerLicense}</div>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gauge serial"><Input value={gaugeSerial} onChange={(e) => setGaugeSerial(e.target.value)} className="h-11" /></Field>
            <Field label="Gauge cal. date"><Input type="date" value={gaugeCalDate} onChange={(e) => setGaugeCalDate(e.target.value)} className="h-11" /></Field>
          </div>
          <Field label="Result override">
            <Select value={override} onChange={(e) => setOverride(e.target.value as '' | 'pass' | 'fail')} className="h-11">
              <option value="">Auto ({auto.toUpperCase()})</option>
              <option value="pass">PASS</option>
              <option value="fail">FAIL</option>
            </Select>
          </Field>
          {result === 'fail' && (
            <Field label="Repairs / notes">
              <Textarea value={repairs} onChange={(e) => setRepairs(e.target.value)} placeholder="e.g. Poppet worn – replaced bonnet & poppet kit, retested PASS." className="min-h-[80px] text-base" />
            </Field>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-4 mt-4 border-t bg-card/95 px-4 pb-3 pt-3 backdrop-blur">
        <Button
          variant={result === 'pass' ? 'success' : 'destructive'}
          className="h-12 w-full text-base"
          onClick={() => onSave({ deviceId: device.id, date: data.today, testerId, gaugeSerial, gaugeCalDate, result, readings: r, repairs: repairs || undefined })}
        >
          Save test — {result.toUpperCase()}
        </Button>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  const bump = (d: number) => onChange(Math.max(0, Math.round(((value ?? 0) + d) * 10) / 10));
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => bump(-0.1)} className="flex size-11 shrink-0 items-center justify-center rounded-md border bg-card text-lg font-bold active:bg-muted">−</button>
        <Input
          inputMode="decimal"
          type="number"
          step="0.1"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          className="h-11 text-center text-lg font-semibold tabular"
          placeholder="0.0"
        />
        <button type="button" onClick={() => bump(0.1)} className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground active:bg-primary/80">+</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- report preview
function ReportDialog({ testId, onClose }: { testId?: string; onClose: () => void }) {
  const { data } = useStore();
  const t = data.backflowTests.find((x) => x.id === testId);
  const d = t ? data.backflowDevices.find((x) => x.id === t.deviceId) : undefined;
  const p = d ? data.properties.find((x) => x.id === d.propertyId) : undefined;
  const c = p ? data.clients.find((x) => x.id === p.clientId) : undefined;
  const pv = d ? data.purveyors.find((x) => x.id === d.purveyorId) : undefined;
  const tester = t ? data.team.find((m) => m.id === t.testerId) : undefined;
  const rows: [string, string][] = [];
  if (t && d) {
    const r = t.readings;
    if (d.type === 'PVB') rows.push(['Air inlet opened at', `${r.airInletOpenedPsid ?? '—'} psid`], ['Check valve held at', `${r.checkValveHeldPsid ?? '—'} psid`]);
    if (d.type === 'RP') rows.push(['Check valve #1', `${r.cv1Psid ?? '—'} psid`], ['Check valve #2', r.cv2Tight ? 'Closed tight' : 'Leaked'], ['Relief valve opened at', `${r.reliefOpenedPsid ?? '—'} psid`]);
    if (d.type === 'DC') rows.push(['Check valve #1', `${r.dcCv1Psid ?? '—'} psid`], ['Check valve #2', `${r.dcCv2Psid ?? '—'} psid`]);
    if (r.linePsi !== undefined) rows.push(['Line pressure', `${r.linePsi} psi`]);
  }
  return (
    <Dialog open={!!t} onClose={onClose} title="Backflow Assembly Test Report" description={pv?.name} size="md">
      {t && d && p && (
        <div className="space-y-4 text-sm">
          <div className="rounded-md border p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted to</div>
            <div className="font-semibold">{pv?.name}</div>
            <div className="text-xs text-muted-foreground">{pv?.email} · {pv?.phone}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Service address</div>
              <div className="font-medium">{p.address}</div>
              <div className="text-xs text-muted-foreground">{p.city}, ID</div>
              <div className="text-xs text-muted-foreground">{c?.name}</div>
              {d.purveyorAccountNo && <div className="text-xs text-muted-foreground">Acct {d.purveyorAccountNo}</div>}
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assembly</div>
              <div className="font-medium">{d.make} {d.model} ({d.type})</div>
              <div className="text-xs text-muted-foreground">{d.size} · S/N {d.serial}</div>
              <div className="text-xs text-muted-foreground">{d.location} · {d.hazard}</div>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">{k}</td>
                    <td className="px-3 py-1.5 text-right font-medium tabular">{v}</td>
                  </tr>
                ))}
                <tr className={cn('font-bold', t.result === 'pass' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                  <td className="px-3 py-2">Result</td>
                  <td className="px-3 py-2 text-right">{t.result.toUpperCase()}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {t.repairs && <div className="rounded-md bg-muted/50 p-3 text-xs"><span className="font-semibold">Repairs:</span> {t.repairs}</div>}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tester</div>
              <div className="font-medium">{tester?.name}</div>
              <div className="text-muted-foreground">License {tester?.testerLicense}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gauge</div>
              <div className="font-medium">{t.gaugeSerial}</div>
              <div className="text-muted-foreground">Calibrated {fmtDateLong(t.gaugeCalDate)}</div>
            </div>
          </div>
          <div className="flex items-end justify-between border-t pt-3 text-xs">
            <div>
              <div className="h-6 w-40 border-b border-foreground/60" />
              <div className="mt-1 text-muted-foreground">Tester signature</div>
            </div>
            <div className="text-right text-muted-foreground">Test date {fmtDateLong(t.date)}</div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
