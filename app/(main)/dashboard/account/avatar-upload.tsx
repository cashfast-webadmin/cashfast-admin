"use client"

import {
  formatBytes,
  useFileUpload,
  type FileWithPreview,
} from "@/hooks/use-file-upload"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CircleAlertIcon, UserIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { forwardRef, useImperativeHandle } from "react"

export interface AvatarUploadHandle {
  clearFiles: () => void
}

interface AvatarUploadProps {
  maxSize?: number
  className?: string
  onFileChange?: (file: FileWithPreview | null) => void
  defaultAvatar?: string
  /** When set, show "Save photo" when a new file is selected */
  onSave?: (file: File) => void
  /** When set and there is an existing avatar, show "Remove photo" */
  onRemoveExisting?: () => void
  isSaving?: boolean
  isRemoving?: boolean
}

export const AvatarUpload = forwardRef<AvatarUploadHandle, AvatarUploadProps>(
  function AvatarUpload(
    {
      maxSize = 2 * 1024 * 1024, // 2MB
      className,
      onFileChange,
      defaultAvatar,
      onSave,
      onRemoveExisting,
      isSaving = false,
      isRemoving = false,
    },
    ref
  ) {
  const [
    {
      files,
      isDragging,
      errors,
      removeFile,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      getInputProps,
    },
    clearFiles,
  ] = useFileUpload({
    maxFiles: 1,
    maxSize,
    accept: "image/*",
    multiple: false,
    onFilesChange: (files) => {
      onFileChange?.(files[0] ?? null)
    },
  })

  const currentFile = files[0]
  const previewUrl = currentFile?.preview ?? defaultAvatar
  const hasExistingAvatar = Boolean(defaultAvatar)

  useImperativeHandle(ref, () => ({ clearFiles }), [clearFiles])

  const handleRemove = () => {
    if (currentFile) {
      removeFile(currentFile.id)
    }
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative">
        <div
          className={cn(
            "group/avatar relative h-24 w-24 cursor-pointer overflow-hidden rounded-full border border-dashed transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/20",
            previewUrl && "border-solid"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <input {...getInputProps()} className="sr-only" aria-hidden />

          {/* Layer 1: image only - forced behind with isolate */}
          <div className="absolute inset-0 z-[0]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <UserIcon className="text-muted-foreground size-6" />
              </div>
            )}
          </div>

          {/* Layer 2: overlay + buttons - always on top */}
          <div className="absolute inset-0 z-[1] flex items-start justify-end p-0.5">
            {/* Cross when new file selected */}
            {currentFile && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
                className="size-6 rounded-full bg-background border-border shadow-sm hover:bg-muted"
                aria-label="Remove avatar"
              >
                <XIcon className="size-3.5" />
              </Button>
            )}

            {/* Hover overlay + cross when existing avatar */}
            {!currentFile && hasExistingAvatar && onRemoveExisting && (
              <div
                className="pointer-events-none absolute inset-0 rounded-full bg-black/50 opacity-0 transition-opacity group-hover/avatar:opacity-100 group-hover/avatar:pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isRemoving) onRemoveExisting()
                  }}
                  disabled={isRemoving}
                  className="absolute right-0.5 top-0.5 size-6 rounded-full bg-background border-border shadow-sm hover:bg-muted pointer-events-auto"
                  aria-label="Remove profile photo"
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-0.5 text-center">
        <p className="text-sm font-medium">
          {currentFile ? "Avatar uploaded" : "Upload avatar"}
        </p>
        <p className="text-muted-foreground text-xs">
          PNG, JPG up to {formatBytes(maxSize)}
        </p>
      </div>

      {(currentFile && onSave) && (
        <div className="inline-flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSave(currentFile.file)}
            disabled={isSaving}
          >
            {isSaving ? "Uploading…" : "Save photo"}
          </Button>
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs font-medium text-destructive hover:underline"
            aria-label="Remove selected image"
          >
            Remove
          </button>
        </div>
      )}

      {errors.length > 0 && (
        <Alert variant="destructive" className="mt-5">
          <CircleAlertIcon className="size-4" />
          <AlertTitle>File upload error(s)</AlertTitle>
          <AlertDescription>
            {errors.map((error, index) => (
              <p key={index} className="last:mb-0">
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
})
