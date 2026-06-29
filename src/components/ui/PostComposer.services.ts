// ──────────────────────────────────────────────────────────
// PostComposer — client-side submit services + image validation.
//
// Builds the multipart POST /api/posts requests (create / quote / edit) and the
// pure client-side image validator. No React, no DB — the composer owns editor
// state, toasts, and reset; these own request SHAPE so they're testable. The
// server re-validates everything (never trust the client).
// ──────────────────────────────────────────────────────────
import type { PostType } from '@/app/(dashboard)/home/shared';

// Product cap: a post carries at most 3 images. Mirrors the server cap in
// createPost/editPost so the user gets instant feedback.
export const MAX_POST_IMAGES = 3;

// Image attachment allowlist/cap — mirrors the server allowlist (api/posts).
export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const POST_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const POST_IMAGE_ACCEPT = POST_IMAGE_TYPES.join(',');

// Returns a toast-ready {title, description} when a picked file is rejected, or
// null when it passes. Keeps the type/size rules in one testable place.
export function validatePostImage(file: File): { title: string; description: string } | null {
  if (!POST_IMAGE_TYPES.includes(file.type)) {
    return { title: 'Unsupported image', description: 'Use a JPG, PNG, or WebP image.' };
  }
  if (file.size > POST_IMAGE_MAX_BYTES) {
    return { title: 'Image too large', description: 'Maximum image size is 5 MB.' };
  }
  return null;
}

interface ApiResult {
  success?: boolean;
  message?: string;
  post?: any;
  content_html?: string;
  image_path?: string | null;
  image_paths?: string[] | null;
  visibility?: string;
}

function appendImages(fd: FormData, files: File[]): void {
  // Repeated `image` parts the server reads via getAll.
  for (const f of files) fd.append('image', f);
}

// No Content-Type header anywhere below — the browser sets the multipart
// boundary itself.
async function postForm(fd: FormData): Promise<ApiResult> {
  const res = await fetch('/api/posts', { method: 'POST', body: fd });
  return res.json();
}

export function createPostRequest(p: {
  contentHtml: string;
  visibility: string;
  postType: PostType;
  skillTag: string;
  imageFiles: File[];
}): Promise<ApiResult> {
  const fd = new FormData();
  fd.append('content_html', p.contentHtml);
  fd.append('visibility', p.visibility);
  fd.append('type', p.postType);
  if (p.postType === 'ask' && p.skillTag.trim()) fd.append('skill_tag', p.skillTag.trim());
  appendImages(fd, p.imageFiles);
  return postForm(fd);
}

export function quoteRequest(p: {
  contentHtml: string;
  repostOf: number;
  imageFiles: File[];
}): Promise<ApiResult> {
  const fd = new FormData();
  fd.append('content_html', p.contentHtml);
  fd.append('visibility', 'public'); // a quote republishes public content
  fd.append('repost_of', String(p.repostOf));
  appendImages(fd, p.imageFiles); // the quote's OWN image(s) (optional)
  return postForm(fd);
}

export function editPostRequest(p: {
  postId: number;
  contentHtml: string;
  visibility: string;
  keptPaths: string[];
  imageFiles: File[];
}): Promise<ApiResult> {
  const fd = new FormData();
  fd.append('action', 'post_edit');
  fd.append('post_id', String(p.postId));
  fd.append('content_html', p.contentHtml);
  fd.append('visibility', p.visibility);
  // Declarative image intent: the server drops any prior image not in kept_paths.
  fd.append('kept_paths', JSON.stringify(p.keptPaths));
  appendImages(fd, p.imageFiles);
  return postForm(fd);
}
