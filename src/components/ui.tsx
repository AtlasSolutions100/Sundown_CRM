import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

// ---------------------------------------------------------------- Button
// One dark primary per surface. Orange ("accent") is the single signal action
// on a screen; row-level actions stay outline/ghost so the hierarchy holds.
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'xs';

const variantCls: Record<Variant, string> = {
  primary: 'bg-[linear-gradient(180deg,hsl(26_90%_60%),hsl(22_86%_52%))] text-white hover:brightness-[1.04] shadow-[0_1px_2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25),0_0_0_1px_hsl(22_70%_45%)]',
  secondary: 'bg-primary text-primary-foreground hover:bg-primary/90 control-shadow',
  outline: 'bg-card text-foreground control-shadow hover:bg-muted/60',
  ghost: 'text-foreground/80 hover:bg-muted hover:text-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 control-shadow',
  accent: 'bg-[linear-gradient(180deg,hsl(26_90%_60%),hsl(22_86%_52%))] text-white hover:brightness-[1.04] shadow-[0_1px_2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25),0_0_0_1px_hsl(22_70%_45%)]',
  success: 'bg-success text-success-foreground hover:bg-success/90 control-shadow',
};
const sizeCls: Record<Size, string> = {
  xs: 'h-7 px-2 text-xs gap-1 rounded-md',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
  icon: 'h-8 w-8 p-0 rounded-md',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn('inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 [&_svg]:size-4', variantCls[variant], sizeCls[size], className)}
    {...props}
  />
));
Button.displayName = 'Button';

// ---------------------------------------------------------------- Card
// A card is a surface, not a border. Content inside uses dividers, not more cards.
export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('surface text-card-foreground', className)} {...p} />;
}
export function CardHeader({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-0.5 px-5 pt-4 pb-3', className)} {...p} />;
}
export function CardTitle({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[15px] font-semibold leading-tight', className)} {...p} />;
}
export function CardDescription({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[13px] text-muted-foreground', className)} {...p} />;
}
export function CardContent({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-4', className)} {...p} />;
}

// ---------------------------------------------------------------- Badge
export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'teal' | 'violet';
const toneCls: Record<Tone, string> = {
  neutral: 'bg-foreground/[0.06] text-foreground/75',
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/15 text-[hsl(20_80%_38%)]',
  success: 'bg-success/14 text-[hsl(145_45%_26%)]',
  warning: 'bg-warning/18 text-[hsl(30_75%_30%)]',
  danger: 'bg-destructive/12 text-[hsl(6_66%_40%)]',
  info: 'bg-info/14 text-[hsl(206_62%_34%)]',
  outline: 'hairline text-muted-foreground',
  teal: 'bg-[hsl(178_45%_36%/0.14)] text-[hsl(178_50%_24%)]',
  violet: 'bg-[hsl(262_50%_55%/0.14)] text-[hsl(262_45%_36%)]',
};
export function Badge({ tone = 'neutral', className, dot, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-1.5 py-[3px] text-[11.5px] font-medium leading-none whitespace-nowrap', toneCls[tone], className)} {...p}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {p.children}
    </span>
  );
}

// ---------------------------------------------------------------- Inputs
const fieldCls = 'w-full rounded-lg bg-card text-sm text-foreground control-shadow placeholder:text-muted-foreground/80 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn('flex h-9 px-3 py-1', fieldCls, className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn('flex min-h-[84px] px-3 py-2', fieldCls, className)} {...p} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn('flex h-9 px-3 py-1', fieldCls, className)} {...p}>
    {children}
  </select>
));
Select.displayName = 'Select';

export function Label({ className, ...p }: HTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-[12.5px] font-medium text-muted-foreground', className)} {...p} />;
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={cn('inline-flex items-center gap-2 text-sm disabled:opacity-50', label && 'cursor-pointer')}>
      <span className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-accent' : 'bg-foreground/15')}>
        <span className={cn('inline-block size-4 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-lg bg-muted p-0.5 text-[13px]', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cn('rounded-md px-3 py-1 font-medium transition-colors', value === o.value ? 'bg-card text-foreground control-shadow' : 'text-muted-foreground hover:text-foreground')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Progress
export function Progress({ value, className, tone = 'primary', height = 'h-1.5' }: { value: number; className?: string; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent'; height?: string }) {
  const bg = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-destructive', accent: 'bg-accent' }[tone];
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-foreground/[0.07]', height, className)}>
      <div className={cn('h-full rounded-full transition-all', bg)} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

/** Segmented milestone bar: one cell per item, coloured by state. */
export function MilestoneBar({ cells, className }: { cells: { tone: Tone | 'empty'; title?: string }[]; className?: string }) {
  const cls: Record<string, string> = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-destructive', info: 'bg-info', primary: 'bg-primary', accent: 'bg-accent', neutral: 'bg-muted-foreground/40', outline: 'bg-foreground/[0.08]', empty: 'bg-foreground/[0.08]', teal: 'bg-[hsl(178_45%_36%)]', violet: 'bg-[hsl(262_50%_55%)]' };
  return (
    <div className={cn('flex gap-px', className)}>
      {cells.map((c, i) => (
        <span key={i} title={c.title} className={cn('h-1.5 flex-1 first:rounded-l-full last:rounded-r-full', cls[c.tone])} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Table
export function Table({ className, ...p }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <table className={cn('w-full caption-bottom text-[13.5px]', className)} {...p} />
    </div>
  );
}
export function THead({ className, ...p }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b [&_tr]:hover:bg-transparent', className)} {...p} />;
}
export function TBody({ className, ...p }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...p} />;
}
export function TR({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-border/70 transition-colors hover:bg-accent/[0.04] data-[state=selected]:bg-accent/[0.08]', className)} {...p} />;
}
export function TH({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-9 px-3 text-left align-middle text-xs font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0', className)} {...p} />;
}
export function TD({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...p} />;
}

// ---------------------------------------------------------------- Tabs
export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cn('flex gap-0.5 border-b overflow-x-auto scrollbar-thin', className)}>
      {tabs.map((t) => (
        <button key={t.value} type="button" onClick={() => onChange(t.value)} className={cn('-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13.5px] font-medium transition-colors', value === t.value ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
          {t.label}
          {t.count !== undefined && <span className={cn('tabular text-xs', value === t.value ? 'text-accent' : 'text-muted-foreground/70')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Dialog
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[hsl(202_34%_10%/0.45)]" onClick={onClose} />
      <div role="dialog" aria-modal className={cn('surface-lg relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-2xl sm:rounded-2xl', w)}>
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-1 -mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-2">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- Toast
interface Toast {
  id: number;
  title: string;
  description?: string;
  tone?: 'success' | 'info' | 'warning' | 'danger';
}
const ToastCtx = createContext<{ toast: (t: Omit<Toast, 'id'>) => void } | null>(null);
let toastSeq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = toastSeq++;
    setItems((x) => [...x, { ...t, id }]);
    window.setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3800);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  const icon = { success: <CheckCircle2 className="size-4 text-success" />, info: <Info className="size-4 text-info" />, warning: <AlertTriangle className="size-4 text-warning" />, danger: <AlertTriangle className="size-4 text-destructive" /> };
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,340px)] flex-col gap-2">
          {items.map((t) => (
            <div key={t.id} className="surface-md pointer-events-auto flex items-start gap-3 p-3">
              <div className="mt-0.5">{icon[t.tone ?? 'success']}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t.title}</div>
                {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast outside provider');
  return ctx.toast;
}

// ---------------------------------------------------------------- Misc
const AVATAR_HUES = ['24 86% 52%', '178 45% 34%', '262 45% 52%', '145 42% 33%', '206 62% 42%', '340 55% 50%', '36 80% 44%'];
export function avatarHue(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}
export function Avatar({ name, className, hue }: { name: string; className?: string; hue?: string }) {
  return (
    <span className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white', className)} style={{ background: `hsl(${hue ?? avatarHue(name)})` }}>
      {initials(name)}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted-foreground/70 [&_svg]:size-6">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Page title row. The eyebrow prop is accepted for compatibility but no longer rendered: the heading carries the hierarchy. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Metric. Quiet by default: a label, a number, a note. `tone` colours only the
 * number so the one metric that needs attention reads without a tinted box.
 */
export function Stat({ label, value, sub, tone, icon, onClick }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'accent' | 'danger' | 'success' | 'warning'; icon?: ReactNode; onClick?: () => void }) {
  const valueTone = { default: 'text-foreground', accent: 'text-[hsl(20_70%_36%)]', danger: 'text-destructive', success: 'text-success', warning: 'text-[hsl(30_70%_30%)]' }[tone ?? 'default'];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cn('surface flex w-full flex-col items-start gap-1 px-4 py-3.5 text-left transition-colors', onClick && 'hover:bg-accent/[0.05]')}>
      <div className="flex w-full items-center justify-between text-[12.5px] font-medium text-muted-foreground">
        <span className="truncate">{label}</span>
        {icon && <span className="text-[hsl(178_45%_36%)]/80 [&_svg]:size-4">{icon}</span>}
      </div>
      <div className={cn('num text-[22px] font-semibold leading-none', valueTone)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Comp>
  );
}

/** The bid → approved → scheduled → done → invoiced → paid chain. */
export function Pipeline({ steps, className }: { steps: { label: string; state: 'done' | 'active' | 'todo' | 'skipped' | 'warn' }[]; className?: string }) {
  return (
    <div className={cn('flex items-center', className)}>
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div className="flex flex-col items-center gap-1" title={s.label}>
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold',
                s.state === 'done' && 'bg-success text-white',
                s.state === 'active' && 'bg-accent text-white ring-4 ring-accent/20',
                s.state === 'warn' && 'bg-destructive text-white',
                s.state === 'todo' && 'hairline bg-card text-muted-foreground',
                s.state === 'skipped' && 'bg-muted text-muted-foreground line-through',
              )}
            >
              {s.state === 'done' ? <Check className="size-3" /> : s.state === 'warn' ? '!' : i + 1}
            </span>
            <span className={cn('text-[10.5px] leading-none', s.state === 'active' ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s.label}</span>
          </div>
          {i < steps.length - 1 && <span className={cn('mx-1 mb-3.5 h-px w-5', s.state === 'done' ? 'bg-success' : 'bg-border')} />}
        </div>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{children}</kbd>;
}

export function Divider({ label }: { label?: string }) {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      {label && <span className="h-px flex-1 bg-border" />}
    </div>
  );
}
