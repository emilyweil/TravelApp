import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import MapView from './components/MapView'
import Journal from './components/Journal'
import ShareGuide from './components/ShareGuide'
import Header from './components/Header'

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [view, setView] = useState('map')
  const [pins, setPins] = useState([])
  const [pinsLoading, setPinsLoading] = useState(false)

  // ── Auth ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Load pins from Supabase when signed in ────────────────────────
  useEffect(() => {
    if (!session) { setPins([]); return }
    setPinsLoading(true)
    supabase
      .from('pins')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setPins(data)
        setPinsLoading(false)
      })
  }, [session])

  // ── Pin CRUD ──────────────────────────────────────────────────────
  const savePin = useCallback(async (pin) => {
    if (!session) return pin
    const row = {
      user_id: session.user.id,
      label: pin.label,
      lat: pin.lat,
      lng: pin.lng,
      type: pin.type,
      question: pin.question || null,
      answer: pin.answer || null,
    }
    if (pin.id && !String(pin.id).startsWith('tmp_')) {
      // Update existing
      const { data, error } = await supabase.from('pins').update(row).eq('id', pin.id).select().single()
      if (!error && data) return data
    } else {
      // Insert new
      const { data, error } = await supabase.from('pins').insert(row).select().single()
      if (!error && data) return data
    }
    return pin
  }, [session])

  const addPin = useCallback(async (pin) => {
    const saved = await savePin(pin)
    setPins(prev => [saved, ...prev.filter(p => p.id !== pin.id)])
    return saved
  }, [savePin])

  const updatePin = useCallback(async (pin) => {
    const saved = await savePin(pin)
    setPins(prev => prev.map(p => p.id === pin.id ? saved : p))
    return saved
  }, [savePin])

  const deletePin = useCallback(async (id) => {
    setPins(prev => prev.filter(p => p.id !== id))
    if (session && !String(id).startsWith('tmp_')) {
      await supabase.from('pins').delete().eq('id', id)
    }
  }, [session])

  // ── Sign out ──────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setPins([])
  }, [])

  if (authLoading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5' }}>
      <div className="spin" style={{ width: 28, height: 28, border: '2.5px solid #eee', borderTopColor: '#1a1a1a', borderRadius: '50%', animation: 'rot .75s linear infinite' }} />
    </div>
  )

  if (!session) return <Auth />

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f7f7f5' }}>
      <Header
        view={view}
        setView={setView}
        pinCount={pins.length}
        user={session.user}
        onSignOut={signOut}
      />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {view === 'map' && (
          <MapView
            pins={pins}
            onAddPin={addPin}
            onUpdatePin={updatePin}
            onDeletePin={deletePin}
            pinsLoading={pinsLoading}
          />
        )}
        {view === 'journal' && (
          <Journal
            pins={pins}
            onGoToPin={(pin) => { setView('map') }}
            onDeletePin={deletePin}
          />
        )}
        {view === 'share' && (
          <ShareGuide pins={pins} />
        )}
      </div>
    </div>
  )
}
