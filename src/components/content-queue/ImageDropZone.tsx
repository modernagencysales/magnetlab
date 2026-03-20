/**
 * ImageDropZone.
 * Drag-and-drop + click-to-browse image upload for content queue posts.
 * Persists images to Supabase Storage via the queue upload API.
 * Never fetches data directly — uses frontend API client.
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { uploadQueuePostImage } from '@/frontend/api/content-queue';

// ─── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// ─── Types ──────────────────────────────────────────────────────────────────

type UploadState = 'idle' | 'uploading' | 'error';

interface ImageDropZoneProps {
  postId: string;
  existingImageUrl: string | null;
  onImageUploaded: (imageUrl: string, storagePath: string) => void;
  onImageRemoved: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ImageDropZone({
  postId,
  existingImageUrl,
  onImageUploaded,
  onImageRemoved,
}: ImageDropZoneProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── File Handling ──────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (file: File) => {
      setErrorMsg(null);

      if (!ALLOWED_TYPES.has(file.type)) {
        setErrorMsg('Invalid type. Use PNG, JPG, WebP, or GIF.');
        return;
      }

      if (file.size > MAX_SIZE_BYTES) {
        setErrorMsg(`Too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`);
        return;
      }

      setUploadState('uploading');
      try {
        const result = await uploadQueuePostImage(postId, file);
        onImageUploaded(result.imageUrl, result.storagePath);
        setUploadState('idle');
      } catch (err) {
        setUploadState('error');
        setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [postId, onImageUploaded]
  );

  // ─── Drag Events ────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [handleFile]
  );

  // ─── Render: Existing Image ─────────────────────────────────────────────

  if (existingImageUrl) {
    return (
      <div className="relative">
        <Image
          src={existingImageUrl}
          alt="Post image"
          width={540}
          height={256}
          className="max-h-64 w-full rounded object-cover"
          unoptimized
        />
        <button
          type="button"
          onClick={onImageRemoved}
          className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80"
          title="Remove image"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // ─── Render: Drop Zone ──────────────────────────────────────────────────

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={uploadState === 'uploading'}
        className={`flex w-full items-center justify-center gap-2 rounded border border-dashed px-3 py-2.5 text-xs transition-colors ${
          dragOver
            ? 'border-violet-400 bg-violet-50 text-violet-600 dark:border-violet-600 dark:bg-violet-950/30 dark:text-violet-400'
            : uploadState === 'error'
              ? 'border-red-300 text-red-500 dark:border-red-700 dark:text-red-400'
              : 'border-border text-muted-foreground hover:border-violet-300 hover:text-violet-500 dark:hover:border-violet-700'
        } disabled:cursor-wait disabled:opacity-60`}
      >
        {uploadState === 'uploading' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <ImagePlus className="h-3.5 w-3.5" />
            Drop image or click to browse
          </>
        )}
      </button>
      {errorMsg && <p className="mt-1 text-[10px] text-red-500">{errorMsg}</p>}
    </div>
  );
}
