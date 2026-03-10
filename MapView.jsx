import { useState, useEffect, useRef, useCallback } from 'react'

const GKEY = import.meta.env.VITE_GOOGLE_MAPS_KEY
const PROXY_URL = import.meta.env.VITE_PROXY_URL

const COLORS = { curiosity: '#f97316', favorite: '#3b82f6', food: '#22c55e', history: '#8b5cf6' }
const ICONS  = { curiosity: '?', favorite: '♥', food: '🍽', history: '🏛' }
const LABELS = { curiosity: 'Curiosity', favorite: 'Favorite', food: 'Food', history: 'History' }

// ── Google Maps loader (idempotent) ──────────────────────────────
let mapsPromise = null
function loadGoogleMaps() {
  if (mapsPromise) return mapsPromise
  mapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(); return }
    window.__gmCb = resolve
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GKEY}&libraries=places,marker&v=beta&callback=__gmCb`
    s.onerror = reject
    document.head.appendChild(s)
  })
  return mapsPromise
}

// ── SVG pin element ───────────────────────────────────────────────
function makePinEl(pin) {
  const c = COLORS[pin.type] || '#f97316'
  const i = ICONS[pin.type] || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <path d="M17 2C9.8 2 4 7.8 4 15C4 25.5 17 42 17 42S30 25.5 30 15C30 7.8 24.2 2 17 2Z"
      fill="${c}" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="17" cy="15" r="8" fill="rgba(255,255,255,0.22)"/>
    <text x="17" y="20" text-anchor="middle" font-size="11"
      font-family="system-ui,sans-serif" fill="white" font-weight="700">${i}</text>
  </svg>`
  const el = document.createElement('div')
  el.innerHTML = svg
  el.style.cssText = 'cursor:pointer;transform-origin:bottom center'
  return el
}

export default function MapView({ pins, onAddPin, onUpdatePin, onDeletePin }) {
  const mapDivRef  = useRef(null)
  const gmapRef    = useRef(null)
  const geocoderRef = useRef(null)
  const markersRef = useRef({})   // id → AdvancedMarkerElement

  const [mapsReady, setMapsReady] = useState(false)
  const [dropping, setDropping]   = useState(false)
  const [panel, setPanel]         = useState(null)  // null | { mode:'new'|'view', pin, coords }
  const [formState, setFormState] = useState({ label: '', type: 'curiosity', question: '' })
  const [suggestions, setSuggestions]   = useState([])
  const [searchVal, setSearchVal]       = useState('')
  const [selPlace, setSelPlace]         = useState(null)
  const [speaking, setSpeaking]         = useState(false)
  const sugTimerRef = useRef(null)

  // ── Load Google Maps ──────────────────────────────────────────
  useEffect(() => {
    loadGoogleMaps().then(() => setMapsReady(true)).catch(console.error)
  }, [])

  // ── Init map ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !mapDivRef.current) return
    const map = new google.maps.Map(mapDivRef.current, {
      center: { lat: 40.7831, lng: -73.9712 },
      zoom: 15,
      mapId: 'curiosity_map',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      styles: mapStyles,
    })
    gmapRef.current = map
    geocoderRef.current = new google.maps.Geocoder()

    map.addListener('click', e => {
      if (!dropping) return
      const lat = e.latLng.lat(), lng = e.latLng.lng()
      setDropping(false)
      openNewPinForm({ lat, lng }, null)
    })

    return () => { /* map cleanup not needed */ }
  }, [mapsReady]) // eslint-disable-line

  // ── Sync markers with pins ────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !gmapRef.current) return
    const { AdvancedMarkerElement } = google.maps.marker
    const currentIds = new Set(pins.map(p => String(p.id)))

    // Remove markers for deleted pins
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        markersRef.current[id].map = null
        delete markersRef.current[id]
      }
    })

    // Add/update markers
    pins.forEach(pin => {
      const sid = String(pin.id)
      if (markersRef.current[sid]) {
        markersRef.current[sid].content = makePinEl(pin)
      } else {
        const el = makePinEl(pin)
        const m = new AdvancedMarkerElement({
          position: { lat: pin.lat, lng: pin.lng },
          map: gmapRef.current,
          title: pin.label,
          content: el,
          gmpDraggable: true,
          zIndex: 100,
        })
        m.addListener('click', () => {
          setPanel({ mode: 'view', pin })
        })
        m.addListener('dragend', async (event) => {
          const lat = event.latLng.lat()
          const lng = event.latLng.lng()
          const updated = { ...pin, lat, lng }
          await onUpdatePin(updated)
        })
        markersRef.current[sid] = m
      }
    })
  }, [pins, mapsReady]) // eslint-disable-line

  // ── Search ────────────────────────────────────────────────────
  const doSearch = useCallback(async (query) => {
    if (query.length < 2) { setSuggestions([]); return }
    try {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GKEY}`
      )
      const d = await r.json()
      if (!d.results?.length) { setSuggestions([]); return }
      const queryLooksNamed = !/^\d/.test(query.trim())
      setSuggestions(d.results.slice(0, 6).map((res, idx) => {
        const c = res.address_components
        const named = c.find(x => x.types.some(t =>
          ['establishment','point_of_interest','premise','natural_feature','park'].includes(t)
        ))
        let name
        if (idx === 0 && queryLooksNamed && !named) name = query.trim()
        else name = named?.long_name || res.formatted_address.split(',')[0]
        return {
          name,
          addr: res.formatted_address,
          lat: res.geometry.location.lat,
          lng: res.geometry.location.lng,
          vp: res.geometry.viewport,
        }
      }))
    } catch { setSuggestions([]) }
  }, [])

  const onSearchInput = (val) => {
    setSearchVal(val)
    setSelPlace(null)
    clearTimeout(sugTimerRef.current)
    sugTimerRef.current = setTimeout(() => doSearch(val), 350)
  }

  const pickSuggestion = (item) => {
    setSearchVal('')
    setSuggestions([])
    setSelPlace(null)
    if (item.vp) {
      gmapRef.current?.fitBounds({
        south: item.vp.southwest.lat, west: item.vp.southwest.lng,
        north: item.vp.northeast.lat, east: item.vp.northeast.lng,
      })
    } else {
      gmapRef.current?.setCenter({ lat: item.lat, lng: item.lng })
      gmapRef.current?.setZoom(17)
    }
    openNewPinForm({ lat: item.lat, lng: item.lng }, item.name)
  }

  // ── Pin form ──────────────────────────────────────────────────
  const openNewPinForm = (coords, autoName) => {
    setFormState({ label: autoName || '', type: 'curiosity', question: '' })
    setPanel({ mode: 'new', coords, pin: null })
  }

  const closePanel = () => {
    setPanel(null)
    speechSynthesis.cancel()
    setSpeaking(false)
  }

  const handleSave = async () => {
    const { coords } = panel
    const q = formState.question.trim()
    const pinData = {
      id: `tmp_${Date.now()}`,
      lat: coords.lat,
      lng: coords.lng,
      type: formState.type,
      label: formState.label || `${coords.lat.toFixed(3)}°, ${coords.lng.toFixed(3)}°`,
      question: q || null,
      answer: null,
      created_at: new Date().toISOString(),
    }

    // Close form, add pin to list immediately
    setPanel({ mode: 'view', pin: pinData })
    const saved = await onAddPin(pinData)
    const withId = { ...pinData, ...saved }

    if (q) {
      setPanel({ mode: 'view', pin: { ...withId, loading: true } })
      try {
        const answer = await askClaude(q, withId)
        const final = { ...withId, answer, loading: false }
        await onUpdatePin(final)
        setPanel(p => p?.pin?.id === withId.id || p?.pin?.id === pinData.id
          ? { mode: 'view', pin: final }
          : p
        )
      } catch (err) {
        const final = { ...withId, answer: `Could not get answer: ${err.message}`, loading: false }
        await onUpdatePin(final)
        setPanel(p => p ? { mode: 'view', pin: final } : p)
      }
    } else {
      setPanel({ mode: 'view', pin: withId })
    }
  }

  const handleDelete = async (id) => {
    await onDeletePin(id)
    closePanel()
  }

  // ── Speech ────────────────────────────────────────────────────
  const toggleSpeak = (text) => {
    if (speaking) {
      speechSynthesis.cancel()
      setSpeaking(false)
    } else {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 0.93
      u.onend = () => setSpeaking(false)
      speechSynthesis.speak(u)
      setSpeaking(true)
    }
  }

  // ── Dropping cursor ───────────────────────────────────────────
  useEffect(() => {
    if (gmapRef.current) {
      gmapRef.current.setOptions({ draggableCursor: dropping ? 'crosshair' : null })
    }
  }, [dropping])

  const panelPin = panel?.pin

  return (
    <div style={styles.wrap}>
      {/* Toolbar */}
      <div style={styles.bar}>
        <div style={styles.srchwrap}>
          <span style={styles.srchIcon}>⌕</span>
          <input
            style={styles.srch}
            value={searchVal}
            onChange={e => onSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setSuggestions([]) }}
            placeholder="Search a place or address…"
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <div style={styles.sugBox}>
              {suggestions.map((s, i) => (
                <div key={i} style={styles.sugItem} onMouseDown={() => pickSuggestion(s)}>
                  <div style={styles.sugMain}>{s.name}</div>
                  <div style={styles.sugSec}>{s.addr}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {dropping ? (
          <span style={styles.dropTip}>Click on map location</span>
        ) : (
          <button onClick={() => setDropping(true)} style={styles.dropBtn}>
            📍 Drop Pin
          </button>
        )}
      </div>

      {/* Map + Panel */}
      <div style={styles.mapWrap}>
        <div ref={mapDivRef} style={styles.map} />

        {/* Side panel */}
        <div style={{ ...styles.panel, width: panel ? 340 : 0 }}>
          {panel?.mode === 'new' && (
            <NewPinForm
              formState={formState}
              setFormState={setFormState}
              coords={panel.coords}
              onSave={handleSave}
              onCancel={closePanel}
            />
          )}
          {panel?.mode === 'view' && panelPin && (
            <PinPanel
              pin={panelPin}
              speaking={speaking}
              onToggleSpeak={toggleSpeak}
              onDelete={() => handleDelete(panelPin.id)}
              onClose={closePanel}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── New Pin Form ──────────────────────────────────────────────────
function NewPinForm({ formState, setFormState, coords, onSave, onCancel }) {
  return (
    <>
      <div style={styles.ph}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.slbl}>New Pin</div>
          <div style={styles.ptitle}>{formState.label || 'New location'}</div>
          <div style={styles.pmeta}>{coords.lat.toFixed(5)}°, {coords.lng.toFixed(5)}°</div>
        </div>
        <button onClick={onCancel} style={styles.xbtn}>✕</button>
      </div>
      <div style={styles.pb}>
        <div style={styles.fsec}>
          <label style={styles.flbl}>Location Name</label>
          <input
            style={styles.finp}
            value={formState.label}
            onChange={e => setFormState(f => ({ ...f, label: e.target.value }))}
            placeholder="e.g. Peace Fountain, that weird bronze crab…"
          />
        </div>
        <div style={styles.fsec}>
          <label style={styles.flbl}>Pin Type</label>
          <div style={styles.tgrid}>
            {Object.entries(COLORS).map(([t, c]) => (
              <div
                key={t}
                onClick={() => setFormState(f => ({ ...f, type: t }))}
                style={{ ...styles.topt, ...(formState.type === t ? styles.toptOn : {}) }}
              >
                <div style={{ ...styles.tdot, background: c }} />
                {LABELS[t]}
              </div>
            ))}
          </div>
        </div>
        <div style={styles.fsec}>
          <label style={styles.flbl}>Ask a Question <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0, color: '#bbb' }}>(optional)</span></label>
          <textarea
            style={{ ...styles.finp, resize: 'none', lineHeight: 1.6 }}
            rows={4}
            value={formState.question}
            onChange={e => setFormState(f => ({ ...f, question: e.target.value }))}
            placeholder="What's the history here? What does that mural mean?"
          />
        </div>
        <div style={styles.frow}>
          <button onClick={onCancel} style={styles.bcnl}>Cancel</button>
          <button onClick={onSave} style={styles.bsave}>
            {formState.question.trim() ? 'Save & Ask AI →' : 'Save Pin'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── View Pin Panel ────────────────────────────────────────────────
function PinPanel({ pin, speaking, onToggleSpeak, onDelete, onClose }) {
  const c = COLORS[pin.type] || '#f97316'
  return (
    <>
      <div style={styles.ph}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ ...styles.ptag, background: c }}>{ICONS[pin.type]} {LABELS[pin.type]}</span>
          <div style={styles.ptitle}>{pin.label}</div>
          <div style={styles.pmeta}>
            {pin.created_at ? new Date(pin.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
            {' · '}{Number(pin.lat).toFixed(4)}°, {Number(pin.lng).toFixed(4)}°
          </div>
        </div>
        <button onClick={onClose} style={styles.xbtn}>✕</button>
      </div>
      <div style={styles.pb}>
        {pin.question && (
          <div style={{ marginBottom: 15 }}>
            <span style={styles.slbl}>Your Question</span>
            <div style={styles.qbox}>"{pin.question}"</div>
          </div>
        )}
        {pin.loading ? (
          <div style={styles.ldwrap}>
            <div style={styles.spin} />
            <div style={{ fontSize: 13 }}>Getting your answer…</div>
          </div>
        ) : pin.answer ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={styles.slbl}>Answer</span>
              <button onClick={() => onToggleSpeak(pin.answer)} style={{ ...styles.lbtn, ...(speaking ? styles.lbtnOn : {}) }}>
                {speaking ? '⏹ Stop' : '▶ Listen'}
              </button>
            </div>
            <div style={styles.atxt}>{pin.answer}</div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic' }}>No question saved for this pin.</p>
        )}
      </div>
      <div style={styles.pf}>
        <button onClick={onDelete} style={styles.rmbtn}>Remove this pin</button>
      </div>
    </>
  )
}

// ── Claude API call ───────────────────────────────────────────────
async function askClaude(question, loc) {
  const lat = Number(loc.lat)
  const lng = Number(loc.lng)
  const name = loc.label || ''

  // Reverse geocode for verified address
  let verifiedAddress = ''
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GKEY}`)
    const d = await r.json()
    if (d.results?.[0]) verifiedAddress = d.results[0].formatted_address
  } catch {}

  const locationContext = verifiedAddress
    ? `Verified street address (Google reverse geocoding): ${verifiedAddress}\nCoordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
    : `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `You are an expert travel guide with deep knowledge of local history, architecture, culture, and hidden gems.

The traveler has pinned this exact location:
${locationContext}
Traveler's pin label: "${name}"

Before answering, search the web for what landmarks, public art, sculptures, or points of interest exist at or within 1 block of this address. Use that search to ground your answer in what is actually there.

The traveler's question: ${question}

Answer in 3-5 paragraphs like a knowledgeable local friend who just looked this up. Be specific about what's actually at this location.`
      }],
    }),
  })

  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error?.message || `Error ${res.status}`)
  }
  const d = await res.json()
  return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n') || 'No response.'
}

// ── Map styles ────────────────────────────────────────────────────
const mapStyles = [
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#c5dff0' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5a90b8' }] },
  { featureType: 'landscape', elementType: 'geometry.fill', stylers: [{ color: '#f3f2ee' }] },
  { featureType: 'landscape.natural', elementType: 'geometry.fill', stylers: [{ color: '#e8ede3' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#d5e8c8' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#5e8f4c' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#999' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0dbd4' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#f4ecdd' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#555' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#555' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#666' }] },
  { featureType: 'road.local', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#444' }] },
  { featureType: 'road.highway', elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#c0c0c0' }] },
  { featureType: 'administrative', elementType: 'labels.text.fill', stylers: [{ color: '#333' }] },
  { featureType: 'administrative', elementType: 'labels.text.stroke', stylers: [{ color: '#f0eeea' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#333' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#555' }] },
]

// ── Styles ────────────────────────────────────────────────────────
const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  bar: {
    height: 52, flexShrink: 0, background: '#fff', borderBottom: '1px solid #e8e8e4',
    display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', zIndex: 20, position: 'relative',
  },
  srchwrap: { position: 'relative', flex: 1, maxWidth: 430 },
  srchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#bbb', fontSize: 15, pointerEvents: 'none' },
  srch: {
    width: '100%', padding: '8px 12px 8px 34px', border: '1.5px solid #e0e0da', borderRadius: 9,
    fontSize: 13, fontFamily: 'inherit', background: '#fafaf8', outline: 'none', boxSizing: 'border-box',
  },
  sugBox: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '100%',
    background: '#fff', border: '1.5px solid #e0e0da', borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,.1)', zIndex: 9999, overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
  },
  sugItem: { padding: '10px 14px', fontSize: 13, cursor: 'pointer', borderTop: '1px solid #f4f4f2' },
  sugMain: { fontWeight: 600, color: '#1a1a1a' },
  sugSec: { fontSize: 11, color: '#999', marginTop: 1 },
  dropBtn: {
    background: '#fff', border: '1.5px solid #e0e0da', borderRadius: 9, padding: '7px 14px',
    fontSize: 13, fontFamily: 'inherit', fontWeight: 500, color: '#555', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  dropTip: { fontSize: 13, color: '#888', fontStyle: 'italic', whiteSpace: 'nowrap' },
  mapWrap: { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },
  map: { flex: 1, minWidth: 0, minHeight: 0 },
  panel: {
    flexShrink: 0, overflow: 'hidden', background: '#fff', borderLeft: '1px solid #e8e8e4',
    display: 'flex', flexDirection: 'column', transition: 'width .2s ease',
  },
  ph: { padding: '15px 17px', borderBottom: '1px solid #f0f0ef', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 },
  pb: { flex: 1, overflowY: 'auto', padding: 17 },
  pf: { padding: '11px 17px', borderTop: '1px solid #f0f0ef', flexShrink: 0 },
  xbtn: { width: 26, height: 26, background: '#f0f0ee', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#666', flexShrink: 0, marginLeft: 8 },
  ptag: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, color: '#fff', fontSize: 11, fontWeight: 600 },
  ptitle: { fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginTop: 7, lineHeight: 1.4, wordBreak: 'break-word' },
  pmeta: { fontSize: 11, color: '#bbb', marginTop: 3 },
  slbl: { display: 'block', fontSize: 10, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 7 },
  qbox: { background: '#fafaf8', borderLeft: '3px solid #222', padding: '10px 13px', borderRadius: '0 7px 7px 0', fontSize: 13, color: '#444', fontStyle: 'italic', lineHeight: 1.65, marginBottom: 16 },
  atxt: { fontSize: 13, lineHeight: 1.9, color: '#444', whiteSpace: 'pre-wrap' },
  ldwrap: { textAlign: 'center', padding: '40px 16px', color: '#bbb' },
  spin: { width: 24, height: 24, border: '2.5px solid #eee', borderTopColor: '#222', borderRadius: '50%', animation: 'rot .75s linear infinite', margin: '0 auto 12px' },
  lbtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0f0ee', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontFamily: 'inherit', fontWeight: 500, color: '#444', cursor: 'pointer' },
  lbtnOn: { background: '#1a1a1a', color: '#fff' },
  rmbtn: { width: '100%', background: 'none', border: '1.5px solid #fce8e8', color: '#c44', borderRadius: 8, padding: 8, fontSize: 12, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer' },
  fsec: { marginBottom: 14 },
  flbl: { display: 'block', fontSize: 10, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 },
  finp: { width: '100%', background: '#fafaf8', border: '1.5px solid #e8e8e4', color: '#1a1a1a', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' },
  tgrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 },
  topt: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 8, border: '1.5px solid #e8e8e4', background: '#fafaf8', fontSize: 12, fontWeight: 500, color: '#666', cursor: 'pointer' },
  toptOn: { borderColor: '#1a1a1a', background: '#fff', color: '#1a1a1a', fontWeight: 600 },
  tdot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  frow: { display: 'flex', gap: 8, marginTop: 4 },
  bcnl: { flex: 1, background: '#f0f0ee', border: 'none', color: '#666', borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer' },
  bsave: { flex: 2, background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: 10, fontSize: 13, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer' },
}
