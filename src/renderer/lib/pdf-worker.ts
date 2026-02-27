import { pdfjs } from 'react-pdf'

/**
 * Configure the PDF.js worker for offline Electron use.
 * Uses import.meta.url to resolve the worker file bundled by Vite,
 * ensuring it works in both development and production builds.
 *
 * Import this module once at the app entry point or in the PdfViewer component.
 */
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
