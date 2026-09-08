import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { MessageSquare, Mail, Phone, Mic, StickyNote, Send, UserPlus, Ticket, FolderInput, Inbox as InboxIcon } from 'lucide-react';
import { useStore } from '@/data/store';
import { Button, Card, Badge, Input, Select, Textarea, Field, Tabs, Segmented, Switch, EmptyState, PageHeader, useToast } from '@/components/ui';
import { useLookups } from '@/components/shared';
import { fmtDateTime, fmtDateLong, fmtTime, cn } from '@/lib/utils';
import type { Channel, Message } from '@/data/types';

type Tab = 'unfiled' | 'all' | 'unread';

const CHANNEL_ICON: Record<Channel, typeof Mail> = { text: MessageSquare, email: Mail, call: Phone, voice_note: Mic, internal: StickyNote };

export default function InboxPage() {
  const { data, actions } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('unfiled');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const unfiled = data.messages.filter((m) => !m.clientId);
  const unread = data.messages.filter((m) => !m.read && m.direction === 'in');

  const list = useMemo(() => {
    const base = tab === 'unfiled' ? unfiled : tab === 'unread' ? unread : data.messages;
    const q = search.trim().toLowerCase();
    return [...base]
      .filter((m) => !q || [m.body, m.from, L.client(m.clientId)?.name].some((s) => s?.toLowerCase().includes(q)))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [tab, search, data.messages, unfiled, unread, L]);

  const selected = data.messages.find((m) => m.id === selectedId) ?? null;

  const select = (m: Message) => {
    setSelectedId(m.id);
    if (!m.read) actions.markRead(m.id);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Inbox"
        title="One inbox, every client"
        subtitle={
          <span>
            Service line <span className="font-medium text-foreground">{data.settings.serviceLine}</span> · <span className="font-medium text-foreground">{data.settings.email}</span>. Calls are recorded &amp; summarized; texts and emails auto-file by sender.
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card className="flex max-h-[calc(100dvh-14rem)] min-h-[480px] flex-col overflow-hidden">
          <div className="border-b p-3">
            <Input placeholder="Search messages…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            className="px-2"
            tabs={[
              { value: 'unfiled', label: 'Unfiled', count: unfiled.length },
              { value: 'unread', label: 'Unread', count: unread.length },
              { value: 'all', label: 'All', count: data.messages.length },
            ]}
          />
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {list.length === 0 ? (
              <div className="p-4">
                <EmptyState icon={<InboxIcon />} title={tab === 'unfiled' ? 'Everything is filed' : 'No messages'} description={tab === 'unfiled' ? 'Every text, email and call is attached to a client.' : undefined} />
              </div>
            ) : (
              list.map((m) => {
                const Icon = CHANNEL_ICON[m.channel];
                const c = L.client(m.clientId);
                const active = m.id === selectedId;
                return (
                  <button key={m.id} type="button" onClick={() => select(m)} className={cn('flex w-full gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-muted/50', active && 'bg-primary/5')}>
                    <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md', m.direction === 'out' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{c ? c.name : <Badge tone="accent">Unknown sender</Badge>}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDateTime(m.at)}</span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{m.direction === 'out' ? `To ${m.to}` : m.from}</span>
                      <span className="mt-0.5 block truncate text-xs">{m.body}</span>
                    </span>
                    {!m.read && m.direction === 'in' && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <Card className="flex max-h-[calc(100dvh-14rem)] min-h-[480px] flex-col overflow-hidden">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={<MessageSquare />} title="Pick a message" description="Unfiled messages need a home. Filed ones open the client's whole conversation." />
            </div>
          ) : !selected.clientId ? (
            <UnfiledPane
              message={selected}
              onFiled={(clientId) => {
                setSelectedId(selected.id);
                toast({ title: 'Filed', description: `Future messages from ${selected.from} will auto-file to ${L.client(clientId)?.name ?? 'this client'}.` });
              }}
            />
          ) : (
            <Thread clientId={selected.clientId} />
          )}
        </Card>
      </div>
    </div>
  );
}

function UnfiledPane({ message: m, onFiled }: { message: Message; onFiled: (clientId: string) => void }) {
  const { data, actions } = useStore();
  const toast = useToast();
  const [clientId, setClientId] = useState('');
  const [remember, setRemember] = useState(true);
  const [leadName, setLeadName] = useState('');
  const Icon = CHANNEL_ICON[m.channel];

  const fileAndMaybeTicket = (cid: string, makeTicket: boolean) => {
    actions.fileMessage(m.id, cid, remember);
    if (makeTicket) {
      const prop = data.properties.find((p) => p.clientId === cid);
      actions.createTicket({ title: m.body.slice(0, 60), description: m.body, source: m.channel === 'email' ? 'email' : m.channel === 'call' ? 'call' : 'text', clientId: cid, propertyId: prop?.id });
      toast({ title: 'Service request created', description: 'Find it under Service Requests → New.' });
    }
    onFiled(cid);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
        <span className="flex size-9 items-center justify-center rounded-md bg-card"><Icon className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{m.from}</span>
            <Badge tone="accent">Unknown sender</Badge>
            <span className="text-xs text-muted-foreground">{fmtDateTime(m.at)}</span>
          </div>
          <p className="mt-2 text-sm">{m.body}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold"><FolderInput className="size-4 text-primary" /> File to an existing client</div>
          <Field label="Client">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Choose…</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
              ))}
            </Select>
          </Field>
          <div className="mt-3"><Switch checked={remember} onChange={setRemember} label="Remember this number / email for next time" /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={!clientId} onClick={() => fileAndMaybeTicket(clientId, false)}>File</Button>
            <Button disabled={!clientId} variant="outline" onClick={() => fileAndMaybeTicket(clientId, true)}><Ticket /> File + create service request</Button>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold"><UserPlus className="size-4 text-accent" /> New lead from this message</div>
          <Field label="Name"><Input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="e.g. Mike – 4410 N Ramsey Rd" /></Field>
          <p className="mt-2 text-xs text-muted-foreground">Creates a lead with this {m.channel === 'email' ? 'email' : 'phone number'} attached and files the message to it.</p>
          <Button
            className="mt-4"
            variant="accent"
            disabled={!leadName.trim()}
            onClick={() => {
              const id = actions.createClientFromMessage(m.id, leadName.trim());
              toast({ title: 'Lead created', description: leadName });
              onFiled(id);
            }}
          >
            Create lead
          </Button>
        </div>
      </div>
    </div>
  );
}

function Thread({ clientId }: { clientId: string }) {
  const { data, actions } = useStore();
  const L = useLookups();
  const toast = useToast();
  const [channel, setChannel] = useState<'text' | 'email'>('text');
  const [body, setBody] = useState('');
  const c = L.client(clientId);
  const msgs = data.messages.filter((m) => m.clientId === clientId).sort((a, b) => a.at.localeCompare(b.at));
  const days: { day: string; items: Message[] }[] = [];
  for (const m of msgs) {
    const day = m.at.slice(0, 10);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(m);
    else days.push({ day, items: [m] });
  }

  return (
    <>
      <div className="flex items-center justify-between border-b px-5 py-3">
        <div>
          <Link href={`/clients/${clientId}`} className="font-semibold hover:text-primary hover:underline">{c?.name}</Link>
          <div className="text-xs text-muted-foreground">{c?.contactName} · {c?.phone} · {c?.email}</div>
        </div>
        <Badge tone="outline">{msgs.length} messages</Badge>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 scrollbar-thin">
        {days.map((d) => (
          <div key={d.day}>
            <div className="mb-3 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {fmtDateLong(d.day)}
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-3">
              {d.items.map((m) => {
                const Icon = CHANNEL_ICON[m.channel];
                const t = m.ticketId ? L.ticket(m.ticketId) : undefined;
                const out = m.direction === 'out';
                return (
                  <div key={m.id} className={cn('flex', out ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm', out ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted')}>
                      <div className={cn('mb-1 flex items-center gap-1.5 text-[11px]', out ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                        <Icon className="size-3" />
                        {m.channel === 'voice_note' ? 'Voice note' : m.channel === 'call' ? 'Call summary' : m.channel} · {fmtTime(m.at)}
                        {!out && <span>· {m.from}</span>}
                      </div>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      {t && (
                        <Link href="/tickets" className={cn('mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium', out ? 'bg-white/15 hover:bg-white/25' : 'bg-card hover:bg-card/70 border')}>
                          <Ticket className="size-3" /> #{t.number} {t.title}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-3">
        <div className="mb-2 flex items-center justify-between">
          <Segmented value={channel} onChange={setChannel} options={[{ value: 'text', label: 'Text' }, { value: 'email', label: 'Email' }]} />
          <span className="text-xs text-muted-foreground">to {channel === 'text' ? c?.phone : c?.email}</span>
        </div>
        <div className="flex gap-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Message ${c?.contactName?.split(' ')[0] ?? ''}…`} className="min-h-[56px]" />
          <Button
            disabled={!body.trim()}
            onClick={() => {
              actions.sendMessage(clientId, channel, body.trim());
              setBody('');
              toast({ title: `${channel === 'text' ? 'Text' : 'Email'} sent`, description: `Logged on ${c?.name}` });
            }}
          >
            <Send /> Send
          </Button>
        </div>
      </div>
    </>
  );
}
