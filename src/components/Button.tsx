import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'small' | 'medium'
  icon?: ReactNode
}

export function Button({
  className = '',
  variant = 'secondary',
  size = 'medium',
  icon,
  children,
  type = 'button',
  ...props
}: Readonly<ButtonProps>) {
  return (
    <button
      type={type}
      className={`button button--${variant} button--${size} ${className}`.trim()}
      {...props}
    >
      {icon ? <span className="button__icon">{icon}</span> : null}
      {children}
    </button>
  )
}
