/**
 * src/components/ui/Badge.jsx
 *
 * Risk class badge with color variants.
 */

const variants = {
  normal:        { label: 'Normal',              bg: '#5C8F6820', color: '#5C8F68', border: '#5C8F6840' },
  worriedWell:   { label: 'Worried Well',       bg: '#D4B56320', color: '#D4B563', border: '#D4B56340' },
  earlyMci:      { label: 'Early MCI',          bg: '#D9A23C20', color: '#D9A23C', border: '#D9A23C40' },
  moderateMci:   { label: 'Moderate MCI',       bg: '#D27F2B20', color: '#D27F2B', border: '#D27F2B40' },
  mildDementia:  { label: 'Mild Dementia',      bg: '#C85D3C20', color: '#C85D3C', border: '#C85D3C40' },
  severe:        { label: 'Severe',             bg: '#B0404020', color: '#B04040', border: '#B0404040' },
  cdt:           { label: 'CDT',                bg: '#5C8F6820', color: '#5C8F68', border: '#5C8F6840' },
  speech:        { label: 'Speech',             bg: '#4A8AB020', color: '#4A8AB0', border: '#4A8AB040' },
}

/**
 * @param {{ riskClass?: 0|1|2|3|4|5, variant?: string, children?: React.ReactNode, className?: string }} props
 */
export function Badge({ riskClass, variant, children, className = '' }) {
  let style = variants.normal

  if (variant && variants[variant]) {
    style = variants[variant]
  } else if (riskClass !== undefined) {
    const byClass = [
      variants.normal,
      variants.worriedWell,
      variants.earlyMci,
      variants.moderateMci,
      variants.mildDementia,
      variants.severe,
    ]
    style = byClass[Math.min(5, Math.max(0, riskClass))]
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
