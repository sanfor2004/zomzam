'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ToastOptions } from './Toast';
import { MAX_POST_IMAGES, validatePostImage } from './PostComposer.services';

// One attached image in the composer: a freshly-picked `file` (with a blob
// preview URL), or an existing server image kept from edit mode (`file: null`,
// `url` is its server path).
export interface ComposerImage {
  url: string;
  file: File | null;
}

type Toast = (options: ToastOptions) => void;

// ──────────────────────────────────────────────────────────
// Composer image attachment lifecycle.
//
// Owns the up-to-MAX_POST_IMAGES attachment list, validation (type/size/cap via
// the service), per-image + bulk removal, and blob object-URL cleanup. Derives
// the new File[] to upload and the kept server paths (edit mode) for the submit
// services. `toast` is injected so this stays decoupled from the Kit Toast host.
// ──────────────────────────────────────────────────────────
export function useComposerImages(initial: ComposerImage[], toast: Toast) {
  const [images, setImages] = useState<ComposerImage[]>(initial);

  // Revoke every blob preview URL on unmount so no object URL leaks. Kept in a
  // ref (not a dep) so add/remove mid-session doesn't re-run cleanup; only blob:
  // URLs are object URLs (edit-mode seeds are server paths, left untouched).
  const imagesRef = useRef(images);
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => {
    return () => {
      for (const img of imagesRef.current) {
        if (img.file && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
      }
    };
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ''; // reset so re-picking the same file still fires onChange
    if (picked.length === 0) return;

    const room = MAX_POST_IMAGES - images.length;
    if (room <= 0) {
      toast({ variant: 'error', title: 'Image limit reached', description: `You can attach up to ${MAX_POST_IMAGES} images.` });
      return;
    }

    const accepted: ComposerImage[] = [];
    for (const file of picked) {
      if (accepted.length >= room) {
        toast({ variant: 'info', title: 'Image limit reached', description: `Only the first ${MAX_POST_IMAGES} images were added.` });
        break;
      }
      const err = validatePostImage(file);
      if (err) { toast({ variant: 'error', ...err }); continue; }
      accepted.push({ url: URL.createObjectURL(file), file });
    }
    if (accepted.length) setImages((prev) => [...prev, ...accepted]);
  };

  // Drop one image; revoke its blob preview immediately (only freshly-picked
  // files carry a blob URL — edit-mode server paths are left untouched).
  const removeImageAt = (index: number) => {
    setImages((prev) => {
      const img = prev[index];
      if (img?.file && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Drop every image (post-submit reset). Revoke all blob previews first.
  const clearImages = () => {
    setImages((prev) => {
      for (const img of prev) {
        if (img.file && img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
      }
      return [];
    });
  };

  // Freshly-picked Files to upload (kept existing images carry file: null).
  const newImageFiles = images.filter((img) => img.file).map((img) => img.file!);
  // Existing server paths the editor kept (edit mode's declarative intent).
  const keptPaths = images.filter((img) => !img.file).map((img) => img.url);

  return { images, handleImageSelect, removeImageAt, clearImages, newImageFiles, keptPaths };
}
