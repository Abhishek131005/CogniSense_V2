/**
 * src/components/layout/Footer.jsx
 *
 * Minimal footer matching the Speech Module design language.
 */

export function Footer() {
  return (
    <footer
      className="mt-auto py-8"
      style={{ borderTop: '1px solid var(--divider)' }}
    >
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.875rem',
              fontWeight: 400,
              color: 'var(--text-primary)',
            }}
          >
            CogniSense
          </span>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
          }}
        >
          CDT MODULE · VISUOSPATIAL · SEM VI CAPSTONE 2025–26
        </p>

        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
          }}
        >
          VESIT · DEPT. OF INFORMATION TECHNOLOGY
        </p>
      </div>
    </footer>
  )
}

export default Footer
