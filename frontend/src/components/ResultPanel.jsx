export default function ResultPanel({ appState, reading, failCount, maxAttempts, onRetake }) {

  if (appState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-6">
        <div className="w-8 h-8 mb-1 opacity-30">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>
        </div>
        <p className="text-sm text-gray-400 tracking-wide">Point camera at your blood pressure monitor</p>
      </div>
    )
  }

  if (appState === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-gray-700" />
          <div
            className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#F05A23 transparent transparent transparent' }}
          />
        </div>
        <p className="text-sm text-gray-400 tracking-widest uppercase">Analyzing</p>
      </div>
    )
  }

  if (appState === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 px-6">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#10b981' }}>
            Reading confirmed
          </span>
        </div>
        <div className="flex gap-6">
          <Stat label="SYS" value={reading.sys} unit="mmHg" />
          <Divider />
          <Stat label="DIA" value={reading.dia} unit="mmHg" />
          <Divider />
          <Stat label="Pulse" value={reading.pulse} unit="bpm" />
        </div>
        <button onClick={onRetake} className="btn-ghost mt-1">Take another</button>
      </div>
    )
  }

  const attemptsLeft = maxAttempts - failCount

  if (appState === 'low') {
    return (
      <AlertPanel
        label="Low confidence"
        message={reading?.message || 'Ensure the monitor display is clearly visible and well-lit.'}
      >
        <p className="text-xs text-gray-600">
          Attempt {failCount} of {maxAttempts}
          {attemptsLeft <= 3 && <span style={{ color: '#b91c1c' }}> — {attemptsLeft} remaining</span>}
        </p>
        <button onClick={onRetake} className="btn-brand">Try again</button>
      </AlertPanel>
    )
  }

  if (appState === 'screened_out') {
    return (
      <AlertPanel
        label="Screen photo blocked"
        message={reading?.message || 'Please photograph the blood pressure monitor directly, not another screen.'}
      >
        <button onClick={onRetake} className="btn-brand">Take another</button>
      </AlertPanel>
    )
  }

  if (appState === 'network_err') {
    return (
      <AlertPanel
        label="Connection failed"
        message="Unable to reach the analysis service. Please check your internet connection and try again."
      >
        <button onClick={onRetake} className="btn-brand">Retry</button>
      </AlertPanel>
    )
  }

  if (appState === 'exhausted') {
    return (
      <AlertPanel
        label="Maximum attempts reached"
        message={`We were unable to read your blood pressure monitor after ${maxAttempts} attempts. Please contact our customer service team for assistance.`}
      >
        <div
          className="mt-1 px-5 py-3 rounded-xl text-sm text-gray-300 leading-relaxed"
          style={{ backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}
        >
          <p className="text-xs tracking-widest uppercase text-gray-500 mb-1">Customer Service</p>
          <p className="font-medium">1800 XXX XXXX</p>
          <p className="text-gray-500 text-xs mt-0.5">Mon – Fri, 9am – 6pm</p>
        </div>
      </AlertPanel>
    )
  }

  return null
}

function AlertPanel({ label, message, children }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#b91c1c' }} />
        <span className="text-xs font-medium tracking-widest uppercase" style={{ color: '#b91c1c' }}>
          {label}
        </span>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
      {children}
    </div>
  )
}

function Stat({ label, value, unit }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-widest">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="text-xs text-gray-600">{unit}</span>
    </div>
  )
}

function Divider() {
  return <div className="w-px self-stretch my-2" style={{ backgroundColor: '#2e2e2e' }} />
}
