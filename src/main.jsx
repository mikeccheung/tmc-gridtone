import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

/**
 * Top-level error boundary to catch render-time issues from App
 * (prevents blank page; shows a minimal message).
 */
class RootErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, err: null } }
  static getDerivedStateFromError(err){ return { hasError: true, err } }
  componentDidCatch(err, info){ console.error('Root error:', err, info) }
  render(){
    if (this.state.hasError) {
      return (
        <div style={{padding:'16px', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Helvetica', color:'#eee', background:'#121214', minHeight:'100vh'}}>
          <h2 style={{marginTop:0}}>Something went wrong</h2>
          <p>Try a hard refresh. If the issue persists, clear site data or wait for the service worker to update.</p>
          <details style={{opacity:.8}}>
            <summary>Error details</summary>
            <pre style={{whiteSpace:'pre-wrap'}}>{String(this.state.err)}</pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
)

// Register (or reload) the service worker in production
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // If there's an updated SW waiting, tell it to activate now
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
      // When a new SW is installed, swap it in immediately
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        if (!sw) return
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    }).catch((e) => {
      console.warn('SW registration failed:', e)
    })
  })
}
