/**
 * src/components/layout/Navbar.jsx
 *
 * Global navigation bar — consistent with the Speech Module design.
 * Logo | Nav links | CTA button
 */

import { Link, NavLink } from 'react-router-dom'
import { PenLine } from 'lucide-react'

const navLinks = [
  { to: '/',          label: 'Home'    },
  { to: '/speech',    label: 'Speech'  },
  { to: '/cdt',       label: 'CDT'     },
  { to: '/profile',   label: 'Profile' },
]

export function Navbar({ minimal = false, sessionBadge = false }) {
  return (
    <nav
      className="sticky top-0 z-40 w-full"
      style={{
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--divider)',
        height: '56px',
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="container flex items-center justify-between h-full">

        {/* Logo */}
        <Link
          to="/cdt"
          className="flex items-center gap-2 no-underline"
          aria-label="CogniSense home"
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              flexShrink: 0,
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: '1rem',
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            CogniSense
          </span>
        </Link>

        {/* Center — Nav links or Session badge */}
        {minimal ? (
          sessionBadge && (
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'var(--accent-primary)' }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-primary)',
                }}
              >
                Session Active
              </span>
            </div>
          )
        ) : (
          <div className="hidden md:flex items-center gap-7">
            {navLinks.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `
                  no-underline transition-colors duration-150
                `}
                style={({ isActive }) => ({
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        )}

        {/* Right — CTA */}
        {!minimal && (
          <Link
            to="/cdt"
            className="hidden md:inline-flex items-center gap-1.5 no-underline"
            style={{
              background: 'var(--text-primary)',
              color: 'var(--bg-base)',
              borderRadius: 'var(--radius-pill)',
              padding: '8px 20px',
              fontFamily: 'var(--font-body)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <PenLine size={14} />
            New Screening
          </Link>
        )}
      </div>
    </nav>
  )
}

export default Navbar
