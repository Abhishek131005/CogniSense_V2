/**
 * src/components/ui/Card.jsx
 *
 * Card component with light and dark variants.
 * All cards use the design system tokens.
 */

export function Card({ children, variant = 'light', className = '', ...props }) {
  const base = 'rounded-xl transition-all duration-200'

  const variants = {
    light: `
      bg-bg-surface
      border border-[rgba(0,0,0,0.08)]
      shadow-card
    `,
    dark: `
      bg-bg-dark
      shadow-dark
    `,
    elevated: `
      bg-bg-surface
      border border-[rgba(0,0,0,0.08)]
      shadow-elevated
    `,
    flat: `
      bg-bg-surface
      border border-[rgba(0,0,0,0.06)]
    `,
  }

  return (
    <div
      className={`${base} ${variants[variant] ?? variants.light} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export default Card
