/**
 * Primitivas do vocabulário IoTLog (Button, Badge, StatusDot, KPI, Field).
 * Ícones: sempre Lucide (lucide-react), nunca emoji — regra do design system.
 */

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type ButtonVariant = 'blue' | 'green' | 'default' | 'outline' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'lg'
  icon?: LucideIcon
  iconRight?: LucideIcon
  children?: ReactNode
}

export function Button({
  variant = 'default',
  size,
  icon: IconLeft,
  iconRight: IconRight,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const cls = ['btn', `btn-${variant}`]
  if (size) cls.push(`btn-${size}`)
  if (!children) cls.push('btn-icon')
  if (className) cls.push(className)
  return (
    <button className={cls.join(' ')} {...rest}>
      {IconLeft && <IconLeft aria-hidden />}
      {children}
      {IconRight && <IconRight aria-hidden />}
    </button>
  )
}

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export function Badge({
  variant = 'neutral',
  dot,
  children,
}: {
  variant?: BadgeVariant
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span className={`badge ${variant}`}>
      {dot && <StatusDot variant={variant} />}
      {children}
    </span>
  )
}

const DOT_COLOR: Record<BadgeVariant, string> = {
  success: '#10b981',
  warning: '#eab308',
  error: '#ef4444',
  info: '#3b82f6',
  neutral: '#a1a1aa',
}

export function StatusDot({ variant = 'neutral', ping = true }: { variant?: BadgeVariant; ping?: boolean }) {
  const color = DOT_COLOR[variant]
  return (
    <span className="sdot">
      {ping && <i className="ping" style={{ background: color }} />}
      <i style={{ background: color }} />
    </span>
  )
}

export function KPI({
  icon: Icon,
  title,
  value,
  unit,
  sub,
}: {
  icon: LucideIcon
  title: string
  value: ReactNode
  unit?: string
  sub?: string
}) {
  return (
    <div className="kpi">
      <div className="top">
        <Icon aria-hidden />
        <span className="ttl">{title}</span>
        {sub && <span className="chg" style={{ color: 'var(--fg2)', fontWeight: 500 }}>{sub}</span>}
      </div>
      <div className="val">
        {value}
        {unit && <span className="unit"> {unit}</span>}
      </div>
    </div>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: LucideIcon
  lg?: boolean
}

export function Field({ label, icon: Icon, lg, id, ...rest }: FieldProps) {
  return (
    <div className={`field${lg ? ' lg' : ''}`}>
      {label && (
        <label className="lbl" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="inp">
        <input id={id} {...rest} />
        {Icon && (
          <span className="ico">
            <Icon aria-hidden />
          </span>
        )}
      </div>
    </div>
  )
}
