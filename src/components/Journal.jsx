const COLORS = { curiosity: '#f97316', favorite: '#3b82f6', food: '#22c55e', history: '#8b5cf6' }
const ICONS  = { curiosity: '?', favorite: '♥', food: '🍽', history: '🏛' }

export default function Journal({ pins, onGoToPin, onDeletePin }) {
  const fmt = iso => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h2 style={styles.title}>Travel Journal</h2>
        <p style={styles.sub}>{pins.length} saved {pins.length === 1 ? 'memory' : 'memories'}</p>

        {pins.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📍</div>
            No pins yet — drop one on the map to get started.
          </div>
        ) : pins.map(p => (
          <div key={p.id} style={styles.card}>
            <div style={styles.chdr}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
                <span style={{ ...styles.ptag, background: COLORS[p.type] }}>{ICONS[p.type]}</span>
                <span style={styles.cname}>{p.label}</span>
              </div>
              <span style={styles.cdate}>{fmt(p.created_at)}</span>
            </div>
            {p.question && (
              <div style={styles.cbody}>
                <div style={styles.cq}>"{p.question}"</div>
                {p.answer
                  ? <>
                      <div style={styles.ca}>{p.answer.substring(0, 300)}…</div>
                      <button style={styles.clink} onClick={() => onGoToPin(p)}>
                        Read full answer →
                      </button>
                    </>
                  : <div style={{ fontSize: 12, color: '#ccc', fontStyle: 'italic' }}>No answer yet</div>
                }
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  page: { flex: 1, overflowY: 'auto', padding: 32, background: '#f7f7f5' },
  inner: { maxWidth: 680, margin: '0 auto' },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 4, color: '#1a1a1a' },
  sub: { fontSize: 13, color: '#999', marginBottom: 26 },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#ccc', fontSize: 13 },
  card: { background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, marginBottom: 11, overflow: 'hidden' },
  chdr: { padding: '13px 17px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f4f4f2', gap: 10 },
  ptag: { display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, color: '#fff', fontSize: 11, fontWeight: 600, flexShrink: 0 },
  cname: { fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cdate: { fontSize: 11, color: '#ccc', flexShrink: 0 },
  cbody: { padding: '13px 17px' },
  cq: { fontSize: 13, color: '#555', fontStyle: 'italic', marginBottom: 7, lineHeight: 1.6 },
  ca: { fontSize: 12, color: '#888', lineHeight: 1.8 },
  clink: { background: 'none', border: 'none', color: '#1a1a1a', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 5, display: 'block', textDecoration: 'underline' },
}
