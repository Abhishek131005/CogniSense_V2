/**
 * src/components/ui/Badge.jsx
 *
 * Risk class badge with color variants.
 */

const variants = {
  normal:   { label: 'Normal',    bg: '#5C8F6820', color: '#5C8F68', border: '#5C8F6840' },
  scd:      { label: 'SCD',       bg: '#C4A84F20', color: '#C4A84F', border: '#C4A84F40' },
  mci:      { label: 'MCI',       bg: '#C47A3A20', color: '#C47A3A', border: '#C47A3A40' },
  high:     { label: 'High Risk', bg: '#B0404020', color: '#B04040', border: '#B0404040' },
  cdt:      { label: 'CDT',       bg: '#5C8F6820', color: '#5C8F68', border: '#5C8F6840' },
  speech:   { label: 'Speech',    bg: '#4A8AB020', color: '#4A8AB0', border: '#4A8AB040' },
}

/**
 * @param {{ riskClass?: 0|1|2|3, variant?: string, children?: React.ReactNode, className?: string }} props
 */
export function Badge({ riskClass, variant, children, className = '' }) {
  let style = variants.normal

  if (variant && variants[variant]) {
    style = variants[variant]
  } else if (riskClass !== undefined) {
    const byClass = [variants.normal, variants.scd, variants.mci, variants.high]
    style = byClass[Math.min(3, Math.max(0, riskClass))]
  }

  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-0.5
        rounded-pill
        font-mono text-[0.625rem] font-medium
        tracking-[0.10em] uppercase
        border
        ${className}
      `}
      style={{
        backgroundColor: style.bg,
        color: style.color,
        borderColor: style.border,
      }}
    >
      {children ?? style.label}
    </span>
  )
}

export default Badge
