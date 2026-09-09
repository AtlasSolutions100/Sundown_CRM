import { useState } from 'react';
import { Building2, CreditCard, MapPin, CloudSun, Database, Plus, Pencil, Trash2, Download, RefreshCw } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Input, Select, Textarea, Field, Dialog, Switch, Table, THead, TBody, TR, TH, TD, PageHeader, useToast } from '@/components/ui';
import { DivisionBadge } from '@/components/shared';
import { fmtDateLong, uid } from '@/lib/utils';
import type { CompanySettings, Division, WeatherRule } from '@/data/types';

const DIVS: Division[] = ['maintenance', 'irrigation', 'installs', 'backflow'];

export default function Settings() {
  const { data, update, reset } = useStore();
  const toast = useToast();
  const s = data.settings;
  const [company, setCompany] = useState(() => ({ name: s.name, legalName: s.legalName, phone: s.phone, serviceLine: s.serviceLine, email: s.email, address: s.address, city: s.city, timezone: s.timezone }));
  const [billing, setBilling] = useState(() => ({ taxRate: s.taxRate, defaultMarkupPct: s.defaultMarkupPct, invoiceApprovalsToTrust: s.invoiceApprovalsToTrust, reminderAfterDays: s.reminderAfterDays, escalateAfterDays: s.escalateAfterDays }));
  const [field, setField] = useState(() => ({ geofenceRadiusM: s.geofenceRadiusM, billableTargetPct: s.billableTargetPct }));
  const [rule, setRule] = useState<WeatherRule | null>(null);

  const save = (patch: Partial<CompanySettings>, label: string) => {
    update((d) => {
      Object.assign(d.settings, patch);
    });
    toast({ title: `${label} saved` });
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company details, automation thresholds, field tracking and weather rules." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="size-4 text-muted-foreground" /> Company</CardTitle>
            <CardDescription>Appears on estimates, invoices and backflow reports.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name"><Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></Field>
            <Field label="Legal name"><Input value={company.legalName} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} /></Field>
            <Field label="Owner phone"><Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></Field>
            <Field label="Service line" hint="Customer calls & texts land here"><Input value={company.serviceLine} onChange={(e) => setCompany({ ...company, serviceLine: e.target.value })} /></Field>
            <Field label="Service email" className="sm:col-span-2"><Input value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} /></Field>
            <Field label="Address"><Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></Field>
            <Field label="City / state / zip"><Input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} /></Field>
            <Field label="Timezone">
              <Select value={company.timezone} onChange={(e) => setCompany({ ...company, timezone: e.target.value })}>
                <option value="America/Los_Angeles">Pacific (North Idaho)</option>
                <option value="America/Boise">Mountain (Boise)</option>
              </Select>
            </Field>
            <div className="flex items-end justify-end"><Button onClick={() => save(company, 'Company')}>Save</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="size-4 text-muted-foreground" /> Billing & automation</CardTitle>
            <CardDescription>Human in the loop until you trust it, then hands-off.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Sales tax %"><Input type="number" step="0.1" value={billing.taxRate} onChange={(e) => setBilling({ ...billing, taxRate: Number(e.target.value) })} /></Field>
              <Field label="Default parts markup %"><Input type="number" value={billing.defaultMarkupPct} onChange={(e) => setBilling({ ...billing, defaultMarkupPct: Number(e.target.value) })} /></Field>
              <Field label="Approvals before auto-send" hint={`${s.invoiceApprovalsCount} approved so far`}><Input type="number" value={billing.invoiceApprovalsToTrust} onChange={(e) => setBilling({ ...billing, invoiceApprovalsToTrust: Number(e.target.value) })} /></Field>
              <Field label="Payment reminder after (days)"><Input type="number" value={billing.reminderAfterDays} onChange={(e) => setBilling({ ...billing, reminderAfterDays: Number(e.target.value) })} /></Field>
              <Field label="Escalate to top of dashboard after (days)"><Input type="number" value={billing.escalateAfterDays} onChange={(e) => setBilling({ ...billing, escalateAfterDays: Number(e.target.value) })} /></Field>
            </div>
            <div className="space-y-3 rounded-lg bg-muted/50 p-3">
              <Switch checked={s.invoiceAutoSend} onChange={(v) => save({ invoiceAutoSend: v }, 'Invoice automation')} label="Send auto-generated invoices without asking me" />
              <div className="flex items-center justify-between gap-3">
                <Switch checked={s.quickBooksConnected} onChange={(v) => save({ quickBooksConnected: v }, 'QuickBooks')} label="QuickBooks Online" />
                {s.quickBooksConnected ? <Badge tone="success" dot>Connected as {s.legalName}</Badge> : <Badge tone="outline">Not connected</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Payroll hours and paid invoices sync to QuickBooks. Your accountant keeps working where they already work.</p>
            </div>
            <div className="flex justify-end"><Button onClick={() => save(billing, 'Billing')}>Save</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /> Field & tracking</CardTitle>
            <CardDescription>Geofence radius drives automatic time-on-property; the billable target drives your dashboard gauge.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Geofence radius (m)" hint="Tablet or phone entering the radius starts a visit"><Input type="number" value={field.geofenceRadiusM} onChange={(e) => setField({ ...field, geofenceRadiusM: Number(e.target.value) })} /></Field>
            <Field label="Billable time target %" hint="Manufacturing benchmark: 85%"><Input type="number" value={field.billableTargetPct} onChange={(e) => setField({ ...field, billableTargetPct: Number(e.target.value) })} /></Field>
            <div className="flex items-end justify-end sm:col-span-2"><Button onClick={() => save(field, 'Field settings')}>Save</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="size-4 text-muted-foreground" /> Demo data</CardTitle>
            <CardDescription>This prototype runs entirely in your browser.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Demo "today"</span>
              <span className="font-medium">{fmtDateLong(data.today)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'sundown-crm-data.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download /> Export JSON
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm('Reset all demo data to the original seed? Anything you changed will be lost.')) {
                    reset();
                    toast({ title: 'Demo data reset' });
                  }
                }}
              >
                <RefreshCw /> Reset demo data
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2"><CloudSun className="size-4 text-muted-foreground" /> Weather rules</CardTitle>
            <CardDescription>Checked every morning at 5:00 against the forecast at each property. Rules prepare suggestions; you click to accept.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRule({ id: uid('wr'), name: '', condition: '', action: '', enabled: true, divisions: ['maintenance'] })}><Plus /> Add rule</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Rule</TH>
                <TH>When</TH>
                <TH>Then</TH>
                <TH>Applies to</TH>
                <TH>Enabled</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {s.weatherRules.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.name}</TD>
                  <TD className="text-sm text-muted-foreground">{r.condition}</TD>
                  <TD className="text-sm">{r.action}</TD>
                  <TD><div className="flex flex-wrap gap-1">{r.divisions.map((d) => <DivisionBadge key={d} division={d} />)}</div></TD>
                  <TD>
                    <Switch
                      checked={r.enabled}
                      onChange={(v) => update((d) => { const x = d.settings.weatherRules.find((k) => k.id === r.id); if (x) x.enabled = v; })}
                    />
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="xs" variant="ghost" onClick={() => setRule(r)}><Pencil /></Button>
                      <Button size="xs" variant="ghost" onClick={() => { update((d) => { d.settings.weatherRules = d.settings.weatherRules.filter((k) => k.id !== r.id); }); toast({ title: 'Rule removed' }); }}><Trash2 /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {rule && (
        <Dialog
          open
          onClose={() => setRule(null)}
          title={rule.name ? 'Edit weather rule' : 'New weather rule'}
          footer={
            <>
              <Button variant="outline" onClick={() => setRule(null)}>Cancel</Button>
              <Button
                disabled={!rule.name.trim() || !rule.condition.trim() || !rule.action.trim()}
                onClick={() => {
                  update((d) => {
                    const i = d.settings.weatherRules.findIndex((k) => k.id === rule.id);
                    if (i >= 0) d.settings.weatherRules[i] = rule;
                    else d.settings.weatherRules.push(rule);
                  });
                  toast({ title: 'Weather rule saved' });
                  setRule(null);
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="Name"><Input value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} placeholder="Rain – skip fert & mowing" /></Field>
            <Field label="When (condition)"><Textarea value={rule.condition} onChange={(e) => setRule({ ...rule, condition: e.target.value })} className="min-h-[56px]" placeholder='> 0.25" rain forecast before 2pm' /></Field>
            <Field label="Then (action)"><Textarea value={rule.action} onChange={(e) => setRule({ ...rule, action: e.target.value })} className="min-h-[56px]" placeholder="Hold job, re-suggest first dry day" /></Field>
            <Field label="Applies to">
              <div className="flex flex-wrap gap-3">
                {DIVS.map((d) => (
                  <label key={d} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={rule.divisions.includes(d)} onChange={(e) => setRule({ ...rule, divisions: e.target.checked ? [...rule.divisions, d] : rule.divisions.filter((x) => x !== d) })} />
                    {d}
                  </label>
                ))}
              </div>
            </Field>
            <Switch checked={rule.enabled} onChange={(v) => setRule({ ...rule, enabled: v })} label="Enabled" />
          </div>
        </Dialog>
      )}
    </div>
  );
}
