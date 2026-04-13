/**
 * src/hooks/useCanvasExport.js
 *
 * Hook for exporting a canvas element to a base64 PNG string.
 */

import { useCallback } from 'react'

/**
 * @param {React.RefObject<HTMLCanvasElement>} canvasRef
 * @returns {{ exportToPNG: () => string|null }}
 */
export function useCanvasExport(canvasRef) {
  /**
   * Export the canvas contents as a base64 data URL (PNG).
   * @returns {string|null}
   */
  const exportToPNG = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  }, [canvasRef])

  return { exportToPNG }
}
