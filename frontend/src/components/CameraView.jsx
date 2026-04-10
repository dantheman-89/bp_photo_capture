import { useEffect, useRef, useState } from 'react'

export default function CameraView({ appState, capturedImage, onCapture, failCount, maxAttempts }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [facingMode, setFacingMode] = useState('environment') // 'environment' = rear, 'user' = front

  // Restart camera whenever appState becomes idle or facingMode changes
  useEffect(() => {
    if (appState === 'idle') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [appState, facingMode])

  async function startCamera() {
    try {
      // Stop any existing stream before starting a new one (important when flipping)
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error('Camera access denied:', err)
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  function handleFlip() {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
  }

  function handleCapture() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    canvas.toBlob(
      blob => {
        const dataUrl = canvas.toDataURL('image/jpeg')
        onCapture(blob, dataUrl)
      },
      'image/jpeg',
      0.9
    )
  }

  const isIdle = appState === 'idle'
  const attemptsLeft = maxAttempts - failCount

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {isIdle ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Viewfinder corner brackets */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-6 left-6 w-10 h-10 border-t-2 border-l-2 border-white opacity-60 rounded-tl-sm" />
            <div className="absolute top-6 right-6 w-10 h-10 border-t-2 border-r-2 border-white opacity-60 rounded-tr-sm" />
            <div className="absolute bottom-20 left-6 w-10 h-10 border-b-2 border-l-2 border-white opacity-60 rounded-bl-sm" />
            <div className="absolute bottom-20 right-6 w-10 h-10 border-b-2 border-r-2 border-white opacity-60 rounded-br-sm" />
          </div>

          {/* Attempt counter — only show after first failure */}
          {failCount > 0 && (
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: attemptsLeft <= 3 ? '#b91c1c' : '#9ca3af',
                border: `1px solid ${attemptsLeft <= 3 ? '#b91c1c' : '#3a3a3a'}`,
              }}
            >
              {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining
            </div>
          )}

          {/* Bottom controls row: flip button + shutter + spacer (for visual balance) */}
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-10">

            {/* Flip camera button */}
            <button
              onClick={handleFlip}
              aria-label="Flip camera"
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75"
                strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>

            {/* Shutter button */}
            <button
              onClick={handleCapture}
              aria-label="Take photo"
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(to right, #F05A23 35%, #ED186B 65%)',
                boxShadow: '0 0 0 3px rgba(240,90,35,0.25), 0 0 0 6px rgba(237,24,107,0.1)',
              }}
            >
              <div className="w-6 h-6 rounded-full bg-white opacity-90" />
            </button>

            {/* Spacer to keep shutter centred */}
            <div className="w-11 h-11" />
          </div>
        </>
      ) : (
        <>
          <img
            src={capturedImage}
            alt="Captured"
            className="w-full h-full object-cover"
          />
          {appState === 'processing' && (
            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
          )}
        </>
      )}
    </div>
  )
}
