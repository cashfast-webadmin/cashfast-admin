"use client"

import { useCallback, useRef, useState } from "react"

/** Metadata for a file or URL-based placeholder (e.g. default cover image). */
export interface FileMetadata {
  id: string
  name: string
  size?: number
  type?: string
  url: string
}

export interface FileWithPreview {
  id: string
  file: File | FileMetadata
  preview: string
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export interface UseFileUploadOptions {
  accept?: string
  maxFiles?: number
  maxSize?: number
  multiple?: boolean
  onFilesChange?: (files: FileWithPreview[]) => void
}

export interface UseFileUploadReturn {
  files: FileWithPreview[]
  isDragging: boolean
  errors: string[]
  removeFile: (id: string) => void
  openFileDialog: () => void
  getInputProps: () => {
    accept: string
    type: string
    ref: (el: HTMLInputElement | null) => void
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    style: React.CSSProperties
  }
  handleDragEnter: (e: React.DragEvent) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
}

function makeId() {
  return Math.random().toString(36).slice(2)
}

function processFiles(
  fileList: File[],
  maxFiles: number,
  maxSize: number | undefined
): { next: FileWithPreview[]; errors: string[] } {
  const errors: string[] = []
  const next: FileWithPreview[] = []
  const limit = Math.min(fileList.length, maxFiles)
  for (let i = 0; i < limit; i++) {
    const file = fileList[i]
    if (maxSize != null && file.size > maxSize) {
      errors.push(`${file.name} exceeds ${formatBytes(maxSize)}`)
      continue
    }
    next.push({
      id: makeId(),
      file,
      preview: URL.createObjectURL(file),
    })
  }
  return { next, errors }
}

export function useFileUpload(
  options: UseFileUploadOptions = {}
): [UseFileUploadReturn, () => void] {
  const {
    accept = "image/*",
    maxFiles = 1,
    maxSize,
    onFilesChange,
  } = options
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  const applyFiles = useCallback(
    (next: FileWithPreview[], newErrors: string[] = []) => {
      setFiles((prev) => {
        prev.forEach((f) => f.preview && URL.revokeObjectURL(f.preview))
        return next
      })
      setErrors(newErrors)
      onFilesChange?.(next)
    },
    [onFilesChange]
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id)
      const removed = prev.find((f) => f.id === id)
      if (removed?.preview) URL.revokeObjectURL(removed.preview)
      onFilesChange?.(next)
      return next
    })
    setErrors([])
  }, [onFilesChange])

  const clearFiles = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((f) => f.preview && URL.revokeObjectURL(f.preview))
      return []
    })
    setErrors([])
    onFilesChange?.([])
  }, [onFilesChange])

  const openFileDialog = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files
      if (!selected?.length) return
      const fileList = Array.from(selected)
      const { next, errors: newErrors } = processFiles(fileList, maxFiles, maxSize)
      applyFiles(next, newErrors)
      e.target.value = ""
    },
    [maxFiles, maxSize, applyFiles]
  )

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const items = e.dataTransfer.files
      if (!items?.length) return
      const fileList = Array.from(items).filter((f) => f.type.startsWith("image/"))
      const { next, errors: newErrors } = processFiles(fileList, maxFiles, maxSize)
      applyFiles(next, newErrors)
    },
    [maxFiles, maxSize, applyFiles]
  )

  const getInputProps = useCallback(
    () => ({
      accept,
      type: "file",
      ref: (el: HTMLInputElement | null) => {
        inputRef.current = el
      },
      onChange: handleChange,
      style: { position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", clip: "rect(0,0,0,0)", clipPath: "inset(50%)" } as React.CSSProperties,
    }),
    [accept, handleChange]
  )

  return [
    {
      files,
      isDragging,
      errors,
      removeFile,
      openFileDialog,
      getInputProps,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
    },
    clearFiles,
  ]
}
