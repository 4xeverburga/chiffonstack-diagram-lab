import { useCallback, useEffect, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { downloadDiagram, parseDiagram } from './exportDiagram'
import { copyComponentCodeToClipboard } from './exportComponentCode'
import { downloadBundle } from './exportBundle'
import { copySvgToClipboard, downloadSvg } from './exportSvg'
import type { DesignTokens } from './designTokens'

export type ExportStatus = 'idle' | 'copied' | 'error' | 'empty'
export type UploadStatus = 'idle' | 'loaded' | 'error'

const STATUS_RESET_MS = 1800

// Owns every export button's handler + transient status label so App.tsx
// stays a thin shell as more export targets (component, bundle, SVG) land
// alongside the existing JSON/code exports (constitution IV line-cap goal).
export function useExportActions(
  nodes: Node[],
  edges: Edge[],
  tokens: DesignTokens,
  onImportDiagram: (nodes: Node[], edges: Edge[]) => void,
) {
  const [jsonExportStatus, setJsonExportStatus] = useState<ExportStatus>('idle')
  const [svgExportStatus, setSvgExportStatus] = useState<ExportStatus>('idle')
  const [componentExportStatus, setComponentExportStatus] = useState<ExportStatus>('idle')
  const [bundleExportStatus, setBundleExportStatus] = useState<ExportStatus>('idle')
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')

  const handleExportJson = useCallback(() => {
    try {
      downloadDiagram(nodes, edges)
      setJsonExportStatus('copied')
    } catch (error: unknown) {
      console.error('Failed to download diagram JSON', error)
      setJsonExportStatus('error')
    }
  }, [nodes, edges])

  const handleUploadJson = useCallback(
    (file: File) => {
      file
        .text()
        .then((text) => {
          const { nodes: importedNodes, edges: importedEdges } = parseDiagram(text)
          onImportDiagram(importedNodes, importedEdges)
          setUploadStatus('loaded')
        })
        .catch((error: unknown) => {
          console.error('Failed to import diagram JSON', error)
          setUploadStatus('error')
        })
    },
    [onImportDiagram],
  )

  const handleExportSvg = useCallback(() => {
    if (nodes.length === 0) {
      setSvgExportStatus('empty')
      return
    }
    try {
      downloadSvg(nodes, edges, tokens)
    } catch (error: unknown) {
      console.error('Failed to download diagram SVG', error)
      setSvgExportStatus('error')
      return
    }
    copySvgToClipboard(nodes, edges, tokens)
      .then(() => setSvgExportStatus('copied'))
      .catch((error: unknown) => {
        console.error('Failed to copy diagram SVG', error)
        setSvgExportStatus('error')
      })
  }, [nodes, edges, tokens])

  const handleExportComponent = useCallback(() => {
    if (nodes.length === 0) {
      setComponentExportStatus('empty')
      return
    }
    copyComponentCodeToClipboard(nodes, edges, tokens)
      .then(() => setComponentExportStatus('copied'))
      .catch((error: unknown) => {
        console.error('Failed to copy component code', error)
        setComponentExportStatus('error')
      })
  }, [nodes, edges, tokens])

  const handleDownloadBundle = useCallback(() => {
    if (nodes.length === 0) {
      setBundleExportStatus('empty')
      return
    }
    try {
      downloadBundle(nodes, edges, tokens)
      setBundleExportStatus('copied')
    } catch (error: unknown) {
      console.error('Failed to download diagram bundle', error)
      setBundleExportStatus('error')
    }
  }, [nodes, edges, tokens])

  useEffect(() => {
    if (jsonExportStatus === 'idle') return
    const timer = setTimeout(() => setJsonExportStatus('idle'), STATUS_RESET_MS)
    return () => clearTimeout(timer)
  }, [jsonExportStatus])

  useEffect(() => {
    if (uploadStatus === 'idle') return
    const timer = setTimeout(() => setUploadStatus('idle'), STATUS_RESET_MS)
    return () => clearTimeout(timer)
  }, [uploadStatus])

  useEffect(() => {
    if (svgExportStatus === 'idle') return
    const timer = setTimeout(() => setSvgExportStatus('idle'), STATUS_RESET_MS)
    return () => clearTimeout(timer)
  }, [svgExportStatus])

  useEffect(() => {
    if (componentExportStatus === 'idle') return
    const timer = setTimeout(() => setComponentExportStatus('idle'), STATUS_RESET_MS)
    return () => clearTimeout(timer)
  }, [componentExportStatus])

  useEffect(() => {
    if (bundleExportStatus === 'idle') return
    const timer = setTimeout(() => setBundleExportStatus('idle'), STATUS_RESET_MS)
    return () => clearTimeout(timer)
  }, [bundleExportStatus])

  const jsonExportLabel =
    jsonExportStatus === 'copied' ? 'Downloaded!' : jsonExportStatus === 'error' ? 'Download failed' : 'Export JSON'
  const uploadLabel = uploadStatus === 'loaded' ? 'Loaded!' : uploadStatus === 'error' ? 'Upload failed' : 'Upload JSON'
  const svgExportLabel =
    svgExportStatus === 'copied'
      ? 'Downloaded!'
      : svgExportStatus === 'error'
        ? 'Download failed'
        : svgExportStatus === 'empty'
          ? 'Add nodes first'
          : 'Export SVG'
  const componentExportLabel =
    componentExportStatus === 'copied'
      ? 'Copied!'
      : componentExportStatus === 'error'
        ? 'Copy failed'
        : componentExportStatus === 'empty'
          ? 'Add nodes first'
          : 'Export component'
  const bundleExportLabel =
    bundleExportStatus === 'copied'
      ? 'Downloaded!'
      : bundleExportStatus === 'error'
        ? 'Download failed'
        : bundleExportStatus === 'empty'
          ? 'Add nodes first'
          : 'Download bundle'

  return {
    handleExportJson,
    handleExportSvg,
    handleExportComponent,
    handleDownloadBundle,
    handleUploadJson,
    jsonExportLabel,
    svgExportLabel,
    componentExportLabel,
    bundleExportLabel,
    uploadLabel,
  }
}

