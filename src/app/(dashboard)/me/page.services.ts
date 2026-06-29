// ──────────────────────────────────────────────────────────
// My profile — client-side data services.
//
// Wraps the profile read (/api/auth?action=check) and the three /api/profile
// multipart writes (avatar upload, avatar remove, identity save) + the avatar
// validator. No React — the page owns form/tag/preview state.
// ──────────────────────────────────────────────────────────

export interface ProfileUser {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  bio: string;
  avatar: string | null;
  tags: string[];
}

export interface ProfileInput {
  firstName: string;
  lastName: string;
  bio: string;
  tags: string[];
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Client-side avatar pre-check (server re-validates). Returns an error message or
// null when the file passes.
export function validateAvatarFile(file: File): string | null {
  if (file.size > AVATAR_MAX_BYTES) return 'Image size cannot exceed 2MB';
  if (!AVATAR_TYPES.includes(file.type)) return 'Only JPEG, PNG, GIF and WEBP formats are supported';
  return null;
}

// Returns the normalized profile, or null when the viewer isn't authenticated
// (the page redirects to /sign). Throws on a network error (the page logs +
// stays, matching the original behavior — no redirect on transient failure).
export async function fetchProfile(): Promise<ProfileUser | null> {
  const res = await fetch('/api/auth?action=check');
  const data = await res.json();
  if (!(data.success && data.authenticated && data.user)) return null;
  const u = data.user;

  let tags: string[] = [];
  if (u.tags) {
    try {
      const parsed = typeof u.tags === 'string' ? JSON.parse(u.tags) : u.tags;
      if (Array.isArray(parsed)) tags = parsed;
    } catch { /* malformed tags column → no tags */ }
  }

  return {
    username: u.username || '',
    email: u.email || '',
    first_name: u.first_name || '',
    last_name: u.last_name || '',
    bio: u.bio || '',
    avatar: u.avatar || null,
    tags,
  };
}

async function profileForm(fd: FormData): Promise<any> {
  const res = await fetch('/api/profile', { method: 'POST', body: fd });
  return res.json();
}

export async function uploadAvatarRequest(file: File): Promise<{ success: boolean; avatar: string | null; message?: string }> {
  const fd = new FormData();
  fd.append('avatar', file);
  const data = await profileForm(fd);
  return { success: !!data.success, avatar: data.user?.avatar ?? null, message: data.message };
}

export async function removeAvatarRequest(): Promise<{ success: boolean; message?: string }> {
  const fd = new FormData();
  fd.append('remove_avatar', '1');
  const data = await profileForm(fd);
  return { success: !!data.success, message: data.message };
}

export async function saveProfileRequest(input: ProfileInput): Promise<{ success: boolean; message?: string }> {
  const fd = new FormData();
  fd.append('first_name', input.firstName);
  fd.append('last_name', input.lastName);
  fd.append('bio', input.bio);
  fd.append('tags', JSON.stringify(input.tags));
  const data = await profileForm(fd);
  return { success: !!data.success, message: data.message };
}
