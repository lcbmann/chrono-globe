import { useEffect, useRef } from 'react'

export const useDialogFocus = <T extends HTMLElement>(open: boolean, onClose: () => void) => {
  const dialogRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusDialog = () => {
      if (dialog?.contains(document.activeElement)) return
      const target = dialog?.querySelector<HTMLElement>('[data-dialog-focus]')
        || dialog?.querySelector<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
      target?.focus()
    }
    const focusFrame = window.requestAnimationFrame(focusDialog)
    // Sliding sheets can still be visibility:hidden on the first frame. Retry
    // after their transition without stealing focus from an in-dialog control.
    const focusTimer = window.setTimeout(focusDialog, 250)
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hidden && element.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1) as HTMLElement
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeydown)
      const isVisibleFocusable = (element: HTMLElement | null) => Boolean(
        element
        && element.isConnected
        && element.matches('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
        && element.getClientRects().length > 0
        && window.getComputedStyle(element).visibility !== 'hidden',
      )
      const fallback = [...document.querySelectorAll<HTMLElement>('[data-dialog-return]')].find(isVisibleFocusable)
      if (isVisibleFocusable(previousFocus)) previousFocus?.focus()
      else fallback?.focus()
    }
  }, [open])

  return dialogRef
}
