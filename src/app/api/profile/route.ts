import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { comparePassword } from '@/lib/auth';
import { getUserById } from '@/lib/models/user';
import { execute, queryOne } from '@/lib/db';
import { processImageUpload, deleteUploadFile, ImageUploadError } from '@/lib/uploads';

export const POST = withAuth(async (request, user) => {
  const contentType = request.headers.get('content-type') || '';

  let firstName: string | null = null;
  let lastName: string | null = null;
  let bio: string | null = null;
  let tags: string | null = null;
  let removeAvatar = false;
  let avatarFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    firstName = formData.get('first_name') as string | null;
    lastName = formData.get('last_name') as string | null;
    bio = formData.get('bio') as string | null;
    tags = formData.get('tags') as string | null;
    removeAvatar = formData.get('remove_avatar') === '1';
    avatarFile = formData.get('avatar') as File | null;
  } else {
    const body = await request.json().catch(() => ({}));
    firstName = body.first_name ?? null;
    lastName = body.last_name ?? null;
    bio = body.bio ?? null;
    tags = body.tags ?? null;
    removeAvatar = body.remove_avatar === '1' || body.remove_avatar === true;
  }

  // Validation
  if (firstName && firstName.length > 100) {
    return NextResponse.json({ success: false, message: 'First name is too long (max 100 characters)' }, { status: 400 });
  }
  if (lastName && lastName.length > 100) {
    return NextResponse.json({ success: false, message: 'Last name is too long (max 100 characters)' }, { status: 400 });
  }
  if (bio && bio.length > 500) {
    return NextResponse.json({ success: false, message: 'Bio is too long (max 500 characters)' }, { status: 400 });
  }
  if (tags) {
    try {
      const parsed = JSON.parse(tags);
      if (!Array.isArray(parsed) || parsed.length > 10) {
        return NextResponse.json({ success: false, message: 'Tags must be an array of max 10 items' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid tags format' }, { status: 400 });
    }
  }

  // Retrieve old avatar
  const currentUser = await getUserById(user.id);
  const oldAvatar = currentUser?.avatar || null;
  let avatarPath: string | null = null;

  if (removeAvatar) {
    await deleteUploadFile(oldAvatar);
    avatarPath = '';
  } else if (avatarFile && avatarFile.size > 0) {
    try {
      avatarPath = await processImageUpload(avatarFile, {
        subdir: 'avatars',
        filenamePrefix: `avatar_${user.id}`,
      });
      // Remove old avatar only once the new one is safely uploaded
      await deleteUploadFile(oldAvatar);
    } catch (err) {
      if (err instanceof ImageUploadError) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      console.error('Image processing failed:', err);
      return NextResponse.json({ success: false, message: 'Failed to process image file.' }, { status: 500 });
    }
  }

  // Build SQL update dynamically
  const updates: string[] = [];
  const params: any[] = [];

  if (firstName !== null) {
    updates.push('first_name = ?');
    params.push(firstName);
  }
  if (lastName !== null) {
    updates.push('last_name = ?');
    params.push(lastName);
  }
  if (bio !== null) {
    updates.push('bio = ?');
    params.push(bio);
  }
  if (tags !== null) {
    updates.push('tags = ?');
    params.push(tags);
  }
  if (avatarPath !== null) {
    updates.push('avatar = ?');
    params.push(avatarPath === '' ? null : avatarPath);
  }

  if (updates.length > 0) {
    updates.push('updated_at = NOW()');
    params.push(user.id);
    await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const updatedUser = await getUserById(user.id);

  return NextResponse.json({
    success: true,
    message: 'Profile updated successfully',
    user: updatedUser,
  });
});

/**
 * DELETE /api/profile
 * Permanently deletes the user's account after verifying their current password.
 * All associated data (tasks, money records, notifications) is cascade-deleted by FK constraints.
 */
export const DELETE = withAuth(async (request, user) => {
  const body = await request.json();
  const { password } = body;

  if (!password) {
    return NextResponse.json({ success: false, message: 'Current password is required to delete account' }, { status: 400 });
  }

  // Verify password before deletion — getUserById omits password, so query directly
  const currentUser = await queryOne<{ password: string; avatar: string | null }>(
    'SELECT password, avatar FROM users WHERE id = ? LIMIT 1',
    [user.id]
  );
  if (!currentUser) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  const passwordValid = await comparePassword(password, currentUser.password);
  if (!passwordValid) {
    return NextResponse.json({ success: false, message: 'Incorrect password. Account deletion aborted.' }, { status: 403 });
  }

  // Remove the avatar blob if it exists and is not the default
  await deleteUploadFile(currentUser.avatar);

  // Delete the user — ON DELETE CASCADE handles all child tables
  await execute('DELETE FROM users WHERE id = ?', [user.id]);

  // Clear session cookie
  const response = NextResponse.json({ success: true, message: 'Account permanently deleted' });
  response.cookies.set('ZOMZAM_SESSION', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return response;
});

export const dynamic = 'force-dynamic';
