import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'xs';

const variantCls: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  accent: 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm',
  success: 'bg-success text-success-foreground hover:bg-success/90 shadow-sm',
};
const sizeCls: Record<Size, string> = {
  xs: 'h-7 px-2 text-xs gap-1 rounded',
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icon: 'h-9 w-9 p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn('inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 [&_svg]:size-4', variantCls[variant], sizeCls[size], className)}
    {...props}
  />
));
Button.displayName = 'Button';

// ---------------------------------------------------------------- Card
export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...p} />;
}
export function CardHeader({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...p} />;
}
export function CardTitle({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold leading-none tracking-tight', className)} {...p} />;
}
export function CardDescription({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...p} />;
}
export function CardContent({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...p} />;
}

// ---------------------------------------------------------------- Badge
export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
const toneCls: Record<Tone, string> = {
  neutral: 'bg-muted text-foreground/80',
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/20 text-accent-foreground',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/18 text-[hsl(30_70%_30%)]',
  danger: 'bg-destructive/12 text-destructive',
  info: 'bg-info/12 text-info',
  outline: 'border border-border text-muted-foreground',
};
export function Badge({ tone = 'neutral', className, dot, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', toneCls[tone], className)} {...p}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {p.children}
    </span>
  );
}

// ---------------------------------------------------------------- Inputs
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn('flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn('flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...p} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn('flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...p}>
    {children}
  </select>
));
Select.displayName = 'Select';

export function Label({ className, ...p }: HTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-xs font-semibold uppercase tracking-wide text-muted-foreground', className)} {...p} />;
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
      <span className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-primary' : 'bg-muted-foreground/30')}>
        <span className={cn('inline-block size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-md border bg-muted/60 p-0.5 text-sm', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cn('rounded px-3 py-1 font-medium transition-colors', value === o.value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Progress
export function Progress({ value, className, tone = 'primary', height = 'h-2' }: { value: number; className?: string; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent'; height?: string }) {
  const bg = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-destructive', accent: 'bg-accent' }[tone];
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-muted', height, className)}>
      <div className={cn('h-full rounded-full transition-all', bg)} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

/** Segmented milestone bar: one cell per item, colored by state. */
export function MilestoneBar({ cells, className }: { cells: { tone: Tone | 'empty'; title?: string }[]; className?: string }) {
  const cls: Record<string, string> = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-destructive', info: 'bg-info', primary: 'bg-primary', accent: 'bg-accent', neutral: 'bg-muted-foreground/40', outline: 'bg-muted', empty: 'bg-muted' };
  return (
    <div className={cn('flex gap-0.5', className)}>
      {cells.map((c, i) => (
        <span key={i} title={c.title} className={cn('h-2 flex-1 rounded-sm first:rounded-l-full last:rounded-r-full', cls[c.tone])} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Table
export function Table({ className, ...p }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <table className={cn('w-full caption-bottom text-sm', className)} {...p} />
    </div>
  );
}
export function THead({ className, ...p }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...p} />;
}
export function TBody({ className, ...p }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...p} />;
}
export function TR({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted', className)} {...p} />;
}
export function TH({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground [&:has([role=checkbox])]:pr-0', className)} {...p} />;
}
export function TD({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...p} />;
}

// ---------------------------------------------------------------- Tabs
export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cn('flex gap-1 border-b overflow-x-auto scrollbar-thin', className)}>
      {tabs.map((t) => (
        <button key={t.value} type="button" onClick={() => onChange(t.value)} className={cn('-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors', value === t.value ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
          {t.label}
          {t.count !== undefined && <span className={cn('rounded-full px-1.5 text-[11px] tabular', value === t.value ? 'bg-accent/25 text-accent-foreground' : 'bg-muted text-muted-foreground')}>{t.count}</span>}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal className={cn('relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-xl border bg-card shadow-2xl sm:rounded-xl', w)}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
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
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
          {items.map((t) => (
            <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-3 shadow-lg animate-in">
              <div className="mt-0.5">{icon[t.tone ?? 'success']}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{t.title}</div>
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
export function Avatar({ name, className, hue }: { name: string; className?: string; hue?: string }) {
  return (
    <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', className)} style={{ background: hue ? `hsl(${hue})` : 'hsl(var(--primary))' }}>
      {initials(name)}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <div className="text-sm font-semibold">{title}</div>
      {description && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent-foreground/70">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone, icon, onClick }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'accent' | 'danger' | 'success' | 'warning'; icon?: ReactNode; onClick?: () => void }) {
  const ring = { default: '', accent: 'border-accent/50 bg-accent/5', danger: 'border-destructive/40 bg-destructive/5', success: 'border-success/40 bg-success/5', warning: 'border-warning/50 bg-warning/5' }[tone ?? 'default'];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cn('flex w-full flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors', ring, onClick && 'hover:border-primary/40 hover:bg-primary/5')}>
      <div className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {icon && <span className="text-muted-foreground/70 [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="text-2xl font-bold tabular tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Comp>
  );
}

/** The bid → approved → scheduled → done → invoiced → paid chain, rendered as pips. */
export function Pipeline({ steps, className }: { steps: { label: string; state: 'done' | 'active' | 'todo' | 'skipped' | 'warn' }[]; className?: string }) {
  return (
    <div className={cn('flex items-center', className)}>
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div className="flex flex-col items-center gap-1" title={s.label}>
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full border text-[10px] font-bold',
                s.state === 'done' && 'border-success bg-success text-white',
                s.state === 'active' && 'border-accent bg-accent text-accent-foreground pulse-ring',
                s.state === 'warn' && 'border-destructive bg-destructive text-white',
                s.state === 'todo' && 'border-border bg-card text-muted-foreground',
                s.state === 'skipped' && 'border-border bg-muted text-muted-foreground line-through',
              )}
            >
              {s.state === 'done' ? <Check className="size-3" /> : s.state === 'warn' ? '!' : i + 1}
            </span>
            <span className="text-[10px] leading-none text-muted-foreground">{s.label}</span>
          </div>
          {i < steps.length - 1 && <span className={cn('mx-1 mb-3 h-px w-5', s.state === 'done' ? 'bg-success' : 'bg-border')} />}
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
    <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      {label && <span className="h-px flex-1 bg-border" />}
    </div>
  );
}
