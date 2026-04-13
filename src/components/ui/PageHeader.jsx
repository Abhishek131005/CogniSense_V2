/**
 * src/components/ui/PageHeader.jsx
 *
 * Standard page header pattern used on every module page.
 * Includes mono label, serif display title with italic accent word, and description.
 */

export function PageHeader({ label, title, italicWord, description, className = '' }) {
  // Split title and wrap the matching word in <em>
  const renderTitle = () => {
    if (!italicWord) return title
    const regex = new RegExp(`(${italicWord})`, 'i')
    const parts = title.split(regex)
    return parts.map((part, i) =>
      regex.test(part)
        ? <em key={i} style={{ fontStyle: 'italic', color: 'var(--accent-italic)' }}>{part}</em>
        : <span key={i}>{part}</span>
    )
  }

  return (
    <section className={`py-12 md:py-16 ${className}`}>
      {/* Mono label */}
      {label && (
        <div className="flex items-center gap-2 mb-4">
          <span style={{ color: 'var(--accent-primary)', fontSize: '0.6875rem' }}>•</span>
          <span className="label-mono">{label}</span>
        </div>
      )}

      {/* Display title */}
      <h1
        className="display-title mb-4"
        style={{ maxWidth: '640px' }}
      >
        {renderTitle()}
      </h1>

      {/* Description */}
      {description && (
        <p
          className="body-description"
          style={{ maxWidth: '560px' }}
        >
          {description}
        </p>
      )}
    </section>
  )
}

export default PageHeader
