import { useEffect, useRef, type ReactNode } from 'react';

export function DemoBadge() {
  return (
    <span
      className="inline-block rounded bg-demo-wash px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-demo"
      title="Datos de demostración: no es una verificación real"
    >
      DEMO
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'link' }) {
  const styles = {
    primary: 'rounded bg-accent px-3 py-1.5 font-medium text-paper hover:opacity-90 disabled:opacity-50',
    secondary: 'rounded border border-line px-3 py-1.5 hover:bg-wash disabled:opacity-50',
    link: 'text-accent underline-offset-2 hover:underline',
  };
  return (
    <button type="button" className={styles[variant]} {...props}>
      {children}
    </button>
  );
}

/** Encabezado de vista que recibe el foco al montarse (navegación con lector de pantalla). */
export function ViewHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h2 ref={ref} tabIndex={-1} className="text-base font-semibold outline-none">
      {children}
    </h2>
  );
}

export function Notice({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="status" className="space-y-2 rounded border border-line bg-wash p-3">
      <ViewHeading>{title}</ViewHeading>
      {children && <div className="text-muted">{children}</div>}
      {action}
    </div>
  );
}
