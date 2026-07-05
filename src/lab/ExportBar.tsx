import { useCallback, useRef, type ChangeEvent } from 'react'
import type { useExportActions } from './useExportActions'

type ExportBarProps = {
  actions: ReturnType<typeof useExportActions>
}

// The editor's header: title plus one button per export target and the
// diagram.json upload input, extracted from App.tsx to keep it under the
// constitution's file-size cap. Purely presentational — every behavior
// comes in through the useExportActions result.
export function ExportBar({ actions }: ExportBarProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const { handleUploadJson } = actions

  const handleClickUpload = useCallback(() => {
    uploadInputRef.current?.click()
  }, [])

  const handleUploadFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      handleUploadJson(file)
    },
    [handleUploadJson],
  )

  return (
    <header className="lab-bar">
      <span className="lab-title">Diagram Lab</span>
      <span className="lab-meta">React Flow authoring tool for system topology diagrams</span>
      <button type="button" className="lab-export" onClick={actions.handleExportSvg}>
        {actions.svgExportLabel}
      </button>
      <button type="button" className="lab-export" onClick={actions.handleExportComponent}>
        {actions.componentExportLabel}
      </button>
      <button type="button" className="lab-export" onClick={actions.handleDownloadBundle}>
        {actions.bundleExportLabel}
      </button>
      <button type="button" className="lab-export" onClick={actions.handleExportJson}>
        {actions.jsonExportLabel}
      </button>
      <button type="button" className="lab-export" onClick={handleClickUpload}>
        {actions.uploadLabel}
      </button>
      <input
        ref={uploadInputRef}
        type="file"
        accept="application/json"
        className="lab-upload-input"
        onChange={handleUploadFileChange}
      />
    </header>
  )
}
