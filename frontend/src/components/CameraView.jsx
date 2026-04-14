import { useEffect, useRef, useState } from 'react'
import { detectMonitorPhoto } from '../utils/monitorSpoofDetector'

const RESOLUTION_TIERS = [
  { width: { ideal: 3840 }, height: { ideal: 2160 } },
  { width: { ideal: 1920 }, height: { ideal: 1080 } },
  { width: { ideal: 1280 }, height: { ideal: 720 } },
  {},
]

// Tries each resolution tier in order, falling back on OverconstrainedError or similar.
// Races against a 30-second timeout to unstick iOS getUserMedia hangs.
async function startCamera(facingMode) {
  async function tryTiers() {
    for (let i = 0; i < RESOLUTION_TIERS.length; i++) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode, ...RESOLUTION_TIERS[i] },
          audio: false,
        })
      } catch {
        if (i === RESOLUTION_TIERS.length - 1) throw new Error('camera unavailable')
      }
    }
  }

  return Promise.race([
    tryTiers(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000)),
  ])
}

function buildPreview(sourceCanvas) {
  const MAX_SIDE = 1600
  const scale = Math.min(1, MAX_SIDE / Math.max(sourceCanvas.width, sourceCanvas.height))
  if (scale === 1) return sourceCanvas.toDataURL('image/jpeg', 0.9)

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sourceCanvas.width * scale)
  canvas.height = Math.round(sourceCanvas.height * scale)
  canvas.getContext('2d').drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

export default function CameraView({ appState, capturedImage, onCapture, failCount, maxAttempts }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [cameraError, setCameraError] = useState(null)

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    if (appState !== 'idle') { stopStream(); return }

    let cancelled = false
    setCameraError(null)

    startCamera(facingMode)
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        video.play().catch(() => {})
        // GPU kick: promotes the video element to its own compositing layer,
        // fixing the WKWebView black-frame rendering bug (WeChat, iOS in-app browsers)
        requestAnimationFrame(() => {
          if (videoRef.current) videoRef.current.style.webkitTransform = 'translateZ(0)'
        })
      })
      .catch(err => {
        if (cancelled) return
        console.error('Camera failed:', err)
        setCameraError('Camera access was denied or unavailable. Please check your permissions in Settings and try again.')
      })

    return () => { cancelled = true; stopStream() }
  }, [appState, facingMode])

  function handleCapture() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)

    const monitorCheck = detectMonitorPhoto(canvas)
    const dataUrl = buildPreview(canvas)

    if (monitorCheck.isMonitorPhoto) {
      onCapture({ dataUrl, monitorCheck })
      return
    }

    canvas.toBlob(blob => {
      if (!blob) return
      onCapture({ blob, dataUrl, monitorCheck })
    }, 'image/jpeg', 0.95)
  }

  const attemptsLeft = maxAttempts - failCount

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {appState !== 'idle' ? (
        <>
          <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
          {appState === 'processing' && (
            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
          )}
        </>
      ) : cameraError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 opacity-50">
            <path d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            <path d="M3 3l18 18" />
          </svg>
          <p className="text-sm leading-relaxed" style={{ color: '#9ca3af' }}>{cameraError}</p>
        </div>
      ) : (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

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

          {/* Bottom controls: flip + shutter + spacer */}
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-10">
            <button
              onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
              aria-label="Flip camera"
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75"
                strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>

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

            <div className="w-11 h-11" /> {/* spacer keeps shutter centred */}
          </div>
        </>
      )}
    </div>
  )
}
