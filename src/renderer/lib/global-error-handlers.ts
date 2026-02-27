/**
 * Global error handlers for the renderer process.
 *
 * Captures uncaught exceptions and unhandled promise rejections,
 * then reports them to the main process via IPC for persistence
 * in the app_logs table.
 */

/**
 * Register global error handlers on the window object.
 * Should be called once at application startup before React renders.
 */
export function registerRendererErrorHandlers(): void {
  window.onerror = (message, _source, _lineno, _colno, error) => {
    window.electronAPI['db:logs:report-error']('error', `[renderer] ${String(message)}`, { stack: error?.stack })
  }

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    window.electronAPI['db:logs:report-error']('error', `[renderer] Unhandled rejection: ${String(event.reason)}`, {})
  }
}
