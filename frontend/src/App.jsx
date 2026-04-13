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
