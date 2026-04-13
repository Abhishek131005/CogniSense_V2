/**
 * src/components/ui/Button.jsx
 *
 * Button component with three variants:
 * - primary: black pill CTA (main actions)
 * - ghost: transparent with border (secondary actions)
 * - danger: red outline (destructive actions)
 */

import { forwardRef } from 'react'

const variantStyles = {
  primary: `
    bg-text-primary text-bg-base
    border border-transparent
    hover:bg-opacity-90
    active:scale-[0.97]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,
  ghost: `
    bg-transparent text-text-secondary
    border border-[rgba(0,0,0,0.12)]
    hover:border-[rgba(0,0,0,0.2)] hover:text-text-primary
    active:scale-[0.97]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,
  danger: `
    bg-transparent text-risk-critical
    border border-risk-critical border-opacity-30
    hover:border-opacity-60 hover:bg-risk-critical hover:bg-opacity-5
    active:scale-[0.97]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,
  accent: `
    bg-accent text-bg-base
    border border-transparent
    hover:bg-accent-light
    active:scale-[0.97]
    disabled:opacity-40 disabled:cursor-not-allowed
  `,
}

const sizeStyles = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    loading = false,
    icon,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center gap-2
        font-body font-medium
        rounded-pill
        transition-all duration-150
        cursor-pointer
        select-none
        whitespace-nowrap
        ${variantStyles[variant] ?? variantStyles.primary}
        ${sizeStyles[size] ?? sizeStyles.md}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  )
})

export default Button
