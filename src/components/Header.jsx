import { useState } from 'react'

export default function Header({ view, setView, pinCount, user, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={styles.hdr}>
      <div style={styles.logo}>
        <div style={styles.logoName}>Curiosity Map</div>
        <div style={styles.logoSub}>Travel Journal</div>
      </div>

      <nav style={styles.nav}>
        {['map', 'journal', 'share'].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{ ...styles.nb, ...(view === v ? styles.nbOn : {}) }}
          >
            {v === 'map' ? 'Map' : v === 'journal' ? 'Journal' : 'Share ✈'}
          </button>
        ))}
      </nav>

      <div style={styles.right}>
        <span style={styles.pcnt}>{pinCount} {pinCount === 1 ? 'pin' : 'pins'}</span>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenuOpen(o => !o)} style={styles.avatar} title={user.email}>
            {user.email[0].toUpperCase()}
          </button>
          {menuOpen && (
            <div style={styles.menu}>
              <div style={styles.menuEmail}>{user.email}</div>
              <div style={styles.menuDivider} />
              <button onClick={() => { setMenuOpen(false); onSignOut() }} style={styles.menuBtn}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  hdr: {
    height: 56,
    flexShrink: 0,
    background: '#fff',
    borderBottom: '1px solid #e8e8e4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 22px',
    zIndex: 20,
    gap: 16,
  },
  logo: { flexShrink: 0 },
  logoName: { fontSize: 15, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 },
  logoSub: { fontSize: 11, color: '#999' },
  nav: { display: 'flex', gap: 3 },
  nb: {
    background: 'none',
    border: 'none',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 500,
    color: '#666',
    cursor: 'pointer',
  },
  nbOn: { background: '#1a1a1a', color: '#fff' },
  right: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },
  pcnt: {
    background: '#f0f0ee',
    color: '#666',
    borderRadius: 20,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    background: '#fff',
    border: '1px solid #e8e8e4',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    minWidth: 200,
    overflow: 'hidden',
    zIndex: 999,
  },
  menuEmail: { padding: '12px 14px', fontSize: 12, color: '#888', wordBreak: 'break-all' },
  menuDivider: { height: 1, background: '#f0f0ee' },
  menuBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    padding: '11px 14px',
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#c44',
    cursor: 'pointer',
    textAlign: 'left',
    fontWeight: 500,
  },
}
