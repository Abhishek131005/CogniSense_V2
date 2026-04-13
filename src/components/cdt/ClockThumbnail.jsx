/**
 * src/components/cdt/ClockThumbnail.jsx
 *
 * Displays the submitted clock drawing thumbnail.
 * Shows the image from Firebase Storage URL or base64 data URL.
 */

export function ClockThumbnail({ imageUrl, label = 'Submitted Drawing' }) {
  if (!imageUrl) {
    return (
      <div
        className="w-full rounded-xl flex items-center justify-center"
        style={{
          aspectRatio: '1/1',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6875rem',
            letterSpacing: '0.10em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}
        >
          No image available
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--accent-primary)', fontSize: '0.6875rem' }}>•</span>
        <span className="label-mono">{label}</span>
      </div>

      {/* Thumbnail */}
      <div
        className="w-full rounded-xl overflow-hidden animate-fade-up"
        style={{
          border: '1px solid var(--canvas-border)',
          boxShadow: 'var(--shadow-card)',
          background: 'var(--canvas-bg)',
        }}
      >
        <img
          src={imageUrl}
          alt="Submitted clock drawing"
          className="w-full h-auto block"
          style={{ aspectRatio: '1/1', objectFit: 'contain' }}
        />
      </div>
    </div>
  )
}

export default ClockThumbnail
