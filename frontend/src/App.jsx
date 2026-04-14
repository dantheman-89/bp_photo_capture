import { useState } from 'react'
import CameraView from './components/CameraView'
import ResultPanel from './components/ResultPanel'

// App states:
// 'idle'        → camera live, waiting for photo
// 'processing'  → photo taken, waiting for API response
// 'success'     → high-confidence reading received
// 'low'         → low-confidence reading (retake allowed, up to MAX_ATTEMPTS)
// 'network_err' → backend unreachable
// 'exhausted'   → MAX_ATTEMPTS consecutive non-high results — contact support

const MAX_ATTEMPTS = 10

export default function App() {
  const [appState, setAppState] = useState('idle')
  const [capturedImage, setCapturedImage] = useState(null)
  const [reading, setReading] = useState(null)
  const [failCount, setFailCount] = useState(0)

  async function handleCapture({ blob, dataUrl, monitorCheck }) {
    setCapturedImage(dataUrl)

    if (monitorCheck?.isMonitorPhoto) {
      setReading({
        sys: 0,
        dia: 0,
        pulse: 0,
        confidence: 'failed',
        message: monitorCheck.message,
      })
      setAppState('screened_out')
      return
    }

    if (!blob) {
      setReading({
        sys: 0,
        dia: 0,
        pulse: 0,
        confidence: 'failed',
        message: 'Unable to prepare this photo for analysis. Please try again.',
      })
      setAppState('low')
      return
    }

    setAppState('processing')

    try {
      const formData = new FormData()
      formData.append('image', blob, 'capture.jpg')

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      // 502/503/504 = proxy couldn't reach the backend — treat as connection failure
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        setAppState('network_err')
        return
      }

      if (!response.ok) throw new Error(`Server error: ${response.status}`)

      const data = await response.json()
      setReading(data)

      if (data.confidence === 'high') {
        setFailCount(0) // reset on success
        setAppState('success')
      } else {
        const newCount = failCount + 1
        setFailCount(newCount)
        setAppState(newCount >= MAX_ATTEMPTS ? 'exhausted' : 'low')
      }
    } catch (err) {
      // TypeError from fetch itself = no network at all (e.g. offline)
      if (err instanceof TypeError) {
        setAppState('network_err')
      } else {
        const newCount = failCount + 1
        setFailCount(newCount)
        setAppState(newCount >= MAX_ATTEMPTS ? 'exhausted' : 'low')
      }
    }
  }

  function handleRetake() {
    setCapturedImage(null)
    setReading(null)
    setAppState('idle')
  }

  return (
    <div className="flex flex-col h-dvh max-w-md mx-auto" style={{ backgroundColor: '#121212' }}>

      {/* Landscape guard — covers the app when phone is rotated sideways */}
      <div
        className="landscape-guard fixed inset-0 z-50 flex-col items-center justify-center gap-4 px-8 text-center"
        style={{ backgroundColor: '#121212' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48, opacity: 0.5 }}>
          <path d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
        </svg>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Please rotate your phone to portrait mode to use this app.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <CameraView
          appState={appState}
          capturedImage={capturedImage}
          onCapture={handleCapture}
          failCount={failCount}
          maxAttempts={MAX_ATTEMPTS}
        />
      </div>
      <div className="h-2/5 panel-card">
        <ResultPanel
          appState={appState}
          reading={reading}
          failCount={failCount}
          maxAttempts={MAX_ATTEMPTS}
          onRetake={handleRetake}
        />
      </div>
    </div>
  )
}
