import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Accessible modal rendered via a portal into document.body.
 * - Centers content with a backdrop.
 * - Focus-lock lite: moves focus into the modal on open and returns it on close.
 * - Closes on ESC and backdrop click.
 */
export default function Modal({ open, onClose, title = 'Dialog', children }) {
  const contentRef = useRef(null)
  const lastFocusedRef = useRef(null)

  useEffect(() => {
    if (!open) return

    // Save last focused element to restore on close
    lastFocusedRef.current = document.activeElement

    // Prevent body scroll
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the modal
    const t = setTimeout(() => {
      const node = contentRef.current
      if (!node) return
      const firstFocusable = node.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      ;(firstFocusable || node).focus()
    }, 0)

    // ESC to close
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)

    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      if (lastFocusedRef.current instanceof HTMLElement) {
        lastFocusedRef.current.focus()
      }
    }
  }, [open, onClose])

  // Backdrop click (only when clicking outside the modal content)
  const handleBackdropMouseDown = (e) => {
    if (!contentRef.current) return
    if (!contentRef.current.contains(e.target)) onClose?.()
  }

  if (!open) return null

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={contentRef}
        tabIndex={-1}
        onMouseDown={(e)=>e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
