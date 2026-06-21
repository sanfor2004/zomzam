import { NextResponse } from 'next/server';
import { loginUser, registerUser, getUserById } from '@/lib/models/user';
import { signSession } from '@/lib/session';
import { withError, getSessionUser } from '@/lib/api-auth';
import { execute } from '@/lib/db';

export const POST = withError(async (request) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!action) {
    return NextResponse.json({ success: false, message: 'Action is required' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  if (action === 'register') {
    const { username, email, password } = body;
    const res = await registerUser(username, email, password);

    if (res.success && res.user) {
      const response = NextResponse.json(res, { status: 201 });
      // Fresh accounts start at token_version 0 (the column default).
      const token = await signSession(
        {
          id: res.user.id,
          username: res.user.username,
          email: res.user.email,
          role: 'user',
        },
        0
      );

      response.cookies.set('ZOMZAM_SESSION', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return response;
    }
    return NextResponse.json(res, { status: 400 });
  }

  if (action === 'login') {
    const { identifier, password, remember } = body;
    const res = await loginUser(identifier, password);

    if (res.success && res.user) {
      const response = NextResponse.json(res, { status: 200 });
      const token = await signSession(
        {
          id: res.user.id!,
          username: res.user.username!,
          email: res.user.email!,
          role: res.user.role!,
        },
        res.user.token_version ?? 0
      );

      const maxAge = remember ? 30 * 24 * 60 * 60 : undefined; // 30 days or session

      response.cookies.set('ZOMZAM_SESSION', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
      return response;
    }
    return NextResponse.json(res, { status: 401 });
  }

  if (action === 'logout') {
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.set('ZOMZAM_SESSION', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(0),
    });
    return response;
  }

  if (action === 'update_settings') {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { timezone, notifications_enabled, primary_currency, secondary_currency } = body;
    const updates: string[] = [];
    const params: any[] = [];

    if (timezone) {
      updates.push('timezone = ?');
      params.push(timezone);
    }

    if (notifications_enabled !== undefined) {
      updates.push('notifications_enabled = ?');
      params.push(notifications_enabled ? 1 : 0);
    }

    const allowedCurrencies = ['EGP', 'USD', 'EUR', 'GBP'];
    if (primary_currency) {
      if (!allowedCurrencies.includes(primary_currency)) {
        return NextResponse.json({ success: false, message: 'Invalid primary currency' }, { status: 400 });
      }
      updates.push('primary_currency = ?');
      params.push(primary_currency);
    }

    if (secondary_currency) {
      if (!allowedCurrencies.includes(secondary_currency)) {
        return NextResponse.json({ success: false, message: 'Invalid secondary currency' }, { status: 400 });
      }
      updates.push('secondary_currency = ?');
      params.push(secondary_currency);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, message: 'No settings provided' }, { status: 400 });
    }

    params.push(user.id);
    await execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    return NextResponse.json({ success: true, message: 'Settings updated successfully' });
  }

  return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
});

export const GET = withError(async (request) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'check') {
    const userPayload = await getSessionUser();

    if (userPayload) {
      const user = await getUserById(userPayload.id);
      if (user) {
        return NextResponse.json({
          success: true,
          authenticated: true,
          user,
        });
      }
    }

    const response = NextResponse.json({
      success: true,
      authenticated: false,
    });
    // No valid session — clear any stale cookie.
    response.cookies.set('ZOMZAM_SESSION', '', { path: '/', expires: new Date(0) });
    return response;
  }

  return NextResponse.json({ success: false, message: 'Invalid action or method' }, { status: 400 });
});
