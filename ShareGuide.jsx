import { useState } from 'react'

const PROXY_URL = import.meta.env.VITE_PROXY_URL

export default function ShareGuide({ pins }) {
  const [guide, setGuide] = useState('')
  const [loading, setLoading] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [generated, setGenerated] = useState(false)

  const answered = pins.filter(p => p.answer)

  const generate = async () => {
    if (!answered.length) return
    setLoading(true)
    setGenerated(false)
    const ctx = answered.map(p => `Location: ${p.label}\nQ: ${p.question}\nA: ${p.answer}`).join('\n\n---\n\n')
    try {
      const r = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: [{ role: 'user', content: `Write a beautiful narrative travel guide from this traveler's curiosity map:\n\n${ctx}\n\nFlowing personal essay — evocative, curious, inspiring.` }],
        }),
      })
      const d = await r.json()
      setGuide(d.content?.[0]?.text || 'Error generating guide.')
      setGenerated(true)
    } catch {
      setGuide('Error generating guide.')
      setGenerated(true)
    }
    setLoading(false)
  }

  const toggleSpeak = () => {
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false) }
    else {
      const u = new SpeechSynthesisUtterance(guide)
      u.rate = 0.93
      u.onend = () => setSpeaking(false)
      speechSynthesis.speak(u)
      setSpeaking(true)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.inner}>
        <h2 style={styles.title}>Share Your Guide ✈</h2>
        <p style={styles.sub}>
          {answered.length} answered question{answered.length !== 1 ? 's' : ''} ready to weave into a guide
        </p>

        {!generated && !loading && (
          <button
            onClick={generate}
            disabled={!answered.length}
            style={{ ...styles.genBtn, ...(!answered.length ? styles.genBtnDisabled : {}) }}
          >
            Generate Travel Guide
          </button>
        )}

        {loading && (
          <div style={styles.loading}>
            <div style={styles.spin} />
            Crafting your guide…
          </div>
        )}

        {generated && guide && (
          <>
            <div style={styles.stbox}>{guide}</div>
            <div style={styles.srow}>
              <button onClick={() => navigator.clipboard.writeText(guide).then(() => alert('Copied!'))} style={styles.sbtn}>
                ⎘ Copy
              </button>
              <button onClick={toggleSpeak} style={{ ...styles.sbtn, ...styles.sbtnP }}>
                {speaking ? '⏹ Stop' : '▶ Listen'}
              </button>
              <button onClick={() => { setGenerated(false); setGuide('') }} style={styles.sbtn}>
                ↺ Regenerate
              </button>
            </div>
          </>
        )}

        {!answered.length && (
          <div style={styles.empty}>Add curiosity pins with questions and answers to generate a guide.</div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { flex: 1, overflowY: 'auto', padding: 32, background: '#f7f7f5' },
  inner: { maxWidth: 680, margin: '0 auto' },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 4, color: '#1a1a1a' },
  sub: { fontSize: 13, color: '#999', marginBottom: 26 },
  genBtn: { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 9, padding: '12px 24px', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', marginBottom: 24 },
  genBtnDisabled: { background: '#ccc', cursor: 'default' },
  loading: { display: 'flex', alignItems: 'center', gap: 12, color: '#999', fontSize: 14, marginBottom: 24 },
  spin: { width: 20, height: 20, border: '2px solid #eee', borderTopColor: '#999', borderRadius: '50%', animation: 'rot .75s linear infinite', flexShrink: 0 },
  stbox: { background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, padding: '24px 28px', fontSize: 14, lineHeight: 2, color: '#444', whiteSpace: 'pre-wrap', marginBottom: 14 },
  srow: { display: 'flex', gap: 9 },
  sbtn: { display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1.5px solid #e8e8e4', color: '#1a1a1a', borderRadius: 8, padding: '9px 17px', fontSize: 13, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer' },
  sbtnP: { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#ccc', fontSize: 13 },
}
