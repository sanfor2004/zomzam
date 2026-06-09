/**
 * community.js — Zomzam Social Graph Client Engine
 *
 * Responsibilities:
 *  - Renders community page tabs: Friends, Requests Inbox, Following, Discover, Search
 *  - Handles all social actions with optimistic UI updates and SSE push refresh
 *  - Full keyboard navigation and accessible feedback
 */

/* ── Constants ───────────────────────────────────────────────────────────── */
const SOCIAL_API = '/api/social';

/* ── State ───────────────────────────────────────────────────────────────── */
let _activeTab = 'friends';
let _searchDebounce = null;

/* ── Bootstrap ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Auto-detect which tab to show based on the visible panel
  const visiblePanel = document.querySelector('[data-panel]:not(.hidden)');
  const initialTab = visiblePanel?.dataset.panel || 'friends';
  
  switchTab(initialTab);
  bindSearch();
  loadInboxBadge();

  // SSE handler for real-time notifications
  window.friendRequestReceived = (params) => {
    showToast(`👋 ${params.from_username} sent you a friend request!`, 'info');
    loadInboxBadge();
    if (_activeTab === 'requests') loadRequests();
  };

  window.friendRequestAccepted = (params) => {
    showToast(`🎉 ${params.from_username} accepted your friend request!`, 'success');
    if (_activeTab === 'friends') loadFriends();
  };
});

/* ── Tab System ─────────────────────────────────────────────────────────── */
/**
 * Switch the active community tab and load its data.
 * @param {string} tab - 'friends' | 'requests' | 'following' | 'discover' | 'search'
 */
function switchTab(tab) {
  _activeTab = tab;

  // Update tab button states (works for both topbar and inline tabs)
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    // Handle both topbar tabs and inline tabs
    btn.classList.toggle('tab-active', isActive);
    btn.classList.toggle('zz-topbar-tab-active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });

  // Show correct panel
  document.querySelectorAll('[data-panel]').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.panel !== tab);
  });

  // Load data for the selected tab
  switch (tab) {
    case 'friends':  loadFriends();   break;
    case 'requests': loadRequests();  break;
    case 'following': loadFollowing(); break;
    case 'discover': loadDiscover();  break;
    case 'search':
      document.getElementById('zz-community-search-input')?.focus();
      break;
  }
}

/* ── Data Loaders ────────────────────────────────────────────────────────── */

async function loadFriends() {
  const el = document.getElementById('zz-friends-grid');
  if (!el) return;
  el.innerHTML = renderSkeletons(6);

  const data = await apiGet('friends');
  if (!data.success) { el.innerHTML = renderEmpty('No friends yet. Send a request from Discover!'); return; }
  if (!data.friends.length) { el.innerHTML = renderEmpty('No friends yet. Send a request from Discover!'); return; }

  el.innerHTML = data.friends.map(u => renderUserCard(u, 'friend')).join('');
}

async function loadRequests() {
  const el = document.getElementById('zz-requests-list');
  if (!el) return;
  el.innerHTML = renderSkeletons(3);

  const [inData, outData] = await Promise.all([
    apiGet('requests_in'),
    apiGet('requests_out')
  ]);

  let html = '';
  if (inData.success && inData.requests.length) {
    html += `<p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Received (${inData.requests.length})</p>`;
    html += inData.requests.map(u => renderRequestCard(u, 'in')).join('');
  }
  if (outData.success && outData.requests.length) {
    html += `<p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6 mb-3">Sent (${outData.requests.length})</p>`;
    html += outData.requests.map(u => renderRequestCard(u, 'out')).join('');
  }
  if (!html) html = renderEmpty('No pending friend requests.');

  el.innerHTML = html;
  updateInboxBadge(inData.requests?.length ?? 0);
}

async function loadFollowing() {
  const el = document.getElementById('zz-following-grid');
  if (!el) return;
  el.innerHTML = renderSkeletons(6);

  const data = await apiGet('following');
  if (!data.success || !data.following.length) { el.innerHTML = renderEmpty('You\'re not following anyone yet.'); return; }
  el.innerHTML = data.following.map(u => renderUserCard(u, 'following')).join('');
}

async function loadDiscover() {
  const el = document.getElementById('zz-discover-grid');
  if (!el) return;
  el.innerHTML = renderSkeletons(8);

  const data = await apiGet('discover');
  if (!data.success) {
    el.innerHTML = renderEmpty('Failed to load users.');
    return;
  }
  
  if (!data.users || !data.users.length) {
    el.innerHTML = renderEmpty('No new users to discover right now.');
    return;
  }
  
  el.innerHTML = data.users.map(u => renderUserCard(u, 'discover')).join('');
}

/* ── Search ─────────────────────────────────────────────────────────────── */
function bindSearch() {
  const input = document.getElementById('zz-community-search-input');
  const autocomplete = document.getElementById('zz-search-autocomplete');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(_searchDebounce);
    const query = input.value.trim();
    
    if (query.length < 2) {
      if (autocomplete) autocomplete.classList.add('hidden');
      return;
    }
    
    _searchDebounce = setTimeout(() => runSearch(query), 300);
  });

  // Hide autocomplete when clicking outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !autocomplete?.contains(e.target)) {
      autocomplete?.classList.add('hidden');
    }
  });

  // Show autocomplete when input is focused and has value
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) {
      runSearch(input.value.trim());
    }
  });
}

async function runSearch(q) {
  const autocomplete = document.getElementById('zz-search-autocomplete');
  if (!autocomplete) return;

  if (q.length < 2) {
    autocomplete.classList.add('hidden');
    return;
  }

  // Show loading state
  autocomplete.innerHTML = `
    <div class="zz-search-autocomplete-item">
      <div class="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></div>
      <div class="flex-1">
        <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-1 animate-pulse"></div>
        <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded w-32 animate-pulse"></div>
      </div>
    </div>
  `.repeat(3);
  autocomplete.classList.remove('hidden');

  const data = await apiGet(`search&q=${encodeURIComponent(q)}`);
  
  if (!data.success || !data.users.length) {
    autocomplete.innerHTML = `
      <div class="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
        No users found for "${q}"
      </div>
    `;
    return;
  }

  // Render autocomplete items (max 8 results)
  autocomplete.innerHTML = data.users.slice(0, 8).map(u => `
    <a href="/u/${escapeHtml(u.username)}" class="zz-search-autocomplete-item">
      <img 
        src="${u.avatar || '/Assets/Img/default-avatar.png'}" 
        alt="${u.username}"
        class="zz-search-autocomplete-avatar"
        onerror="this.src='/Assets/Img/default-avatar.png'"
      >
      <div class="zz-search-autocomplete-info">
        <div class="zz-search-autocomplete-username">${escapeHtml(u.username)}</div>
        <div class="zz-search-autocomplete-email">${escapeHtml(u.email || '')}</div>
      </div>
    </a>
  `).join('');
}

/* ── Social Actions ─────────────────────────────────────────────────────── */

/**
 * Send a friend request.
 * @param {number} userId
 * @param {HTMLElement} btn - The button element (for optimistic UI)
 */
async function socialFriendRequest(userId, btn) {
  if (!btn) return;
  setButtonLoading(btn, true);

  const res = await apiPost('friend_request', { user_id: userId });

  if (res.success) {
    // Optimistic: transform button to Pending (Undo-able) state
    btn.outerHTML = `<button onclick="socialFriendCancel(${userId}, this)" class="zz-social-btn zz-btn-pending" title="Friend request sent">
      <span class="hover-hide"><span class="btn-icon">⏳</span>Pending</span>
      <span class="hover-show">✕ Undo</span>
    </button>`;
    showToast('Friend request sent!', 'success');
  } else {
    setButtonLoading(btn, false);
    showToast(res.message || 'Could not send request', 'error');
  }
}

/**
 * Cancel/Undo a pending friend request sent BY me.
 */
async function socialFriendCancel(userId, element) {
  if (!element) return;
  
  const isButton = element.tagName === 'BUTTON';
  if (isButton) setButtonLoading(element, true);

  const res = await apiPost('friend_cancel', { user_id: userId });

  if (res.success) {
    // If we are inside a request card, remove the whole card
    if (element.closest('[data-request-card]')) {
      element.closest('[data-request-card]').remove();
      // If no cards left in requests, show empty state
      const requestsList = document.getElementById('zz-requests-list');
      if (requestsList && !requestsList.querySelector('[data-request-card]')) {
        requestsList.innerHTML = renderEmpty('No pending friend requests.');
      }
    } else if (isButton) {
      // If we are on public profile, reload to refresh both buttons cleanly
      if (document.getElementById('zz-profile-social-actions')) {
        location.reload();
      } else {
        // Standard button transform back to "+ Add" for search/discover results
        element.outerHTML = `<button onclick="socialFriendRequest(${userId}, this)" class="zz-social-btn zz-btn-add">
          <span>+ Add</span>
        </button>`;
      }
    }
    showToast('Friend request cancelled', 'info');
  } else {
    if (isButton) setButtonLoading(element, false);
    showToast(res.message || 'Could not cancel request', 'error');
  }
}

/**
 * Accept an incoming friend request.
 */
async function socialFriendAccept(userId, card) {
  const res = await apiPost('friend_accept', { user_id: userId });

  if (res.success) {
    card?.remove();
    showToast('Friend request accepted! 🎉', 'success');
    loadInboxBadge();
    if (_activeTab === 'friends') loadFriends();
  } else {
    showToast(res.message || 'Error accepting request', 'error');
  }
}

/**
 * Decline an incoming friend request.
 */
async function socialFriendDecline(userId, card) {
  const res = await apiPost('friend_decline', { user_id: userId });

  if (res.success) {
    card?.remove();
    showToast('Request declined', 'info');
    loadInboxBadge();
  } else {
    showToast(res.message || 'Error declining request', 'error');
  }
}

/**
 * Unfollow a user.
 */
async function socialUnfollow(userId, btn) {
  setButtonLoading(btn, true);
  const res = await apiPost('unfollow', { user_id: userId });

  if (res.success) {
    btn?.closest('[data-user-card]')?.remove();
    showToast('Unfollowed', 'info');
    if (_activeTab === 'following') loadFollowing();
  } else {
    setButtonLoading(btn, false);
    showToast(res.message || 'Error', 'error');
  }
}

/**
 * Follow a user.
 */
async function socialFollow(userId, btn) {
  setButtonLoading(btn, true);
  const res = await apiPost('follow', { user_id: userId });

  if (res.success) {
    btn.outerHTML = `<button onclick="socialUnfollow(${userId}, this)" class="zz-social-btn zz-btn-following">
      <span class="btn-icon">✓</span><span>Following</span>
    </button>`;
    showToast('Now following!', 'success');
  } else {
    setButtonLoading(btn, false);
    showToast(res.message || 'Could not follow', 'error');
  }
}

/**
 * Unfriend a user (remove friendship).
 */
async function socialUnfriend(userId, btn) {
  // Show custom confirmation dialog
  const confirmed = await zzConfirm({
    title: 'Unfriend User',
    message: 'Are you sure you want to unfriend this person? You can send them a friend request again later.',
    confirmText: 'Unfriend',
    cancelText: 'Cancel',
    type: 'danger'
  });

  if (!confirmed) {
    return;
  }

  setButtonLoading(btn, true);
  const res = await apiPost('unfriend', { user_id: userId });

  if (res.success) {
    // Remove the entire card from friends list
    const card = btn.closest('[data-user-card]');
    if (card) {
      card.style.transform = 'scale(0.95)';
      card.style.opacity = '0';
      card.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        card.remove();
        // If friends grid is now empty, show empty state
        const friendsGrid = document.getElementById('zz-friends-grid');
        if (friendsGrid && !friendsGrid.querySelector('[data-user-card]')) {
          friendsGrid.innerHTML = renderEmpty('No friends yet. Send a request from Discover!');
        }
      }, 300);
    }
    showToast('Unfriended', 'info');
    if (_activeTab === 'friends') loadFriends();
  } else {
    setButtonLoading(btn, false);
    showToast(res.message || 'Could not unfriend', 'error');
  }
}

/* ── Inbox Badge ─────────────────────────────────────────────────────────── */
async function loadInboxBadge() {
  const data = await apiGet('requests_in');
  const count = data.success ? (data.requests?.length ?? 0) : 0;
  updateInboxBadge(count);
}

function updateInboxBadge(count) {
  document.querySelectorAll('.zz-inbox-badge').forEach(el => {
    el.textContent = count;
    el.classList.toggle('hidden', count === 0);
  });
  // Also update tab label
  const tab = document.querySelector('[data-tab="requests"] .zz-tab-label');
  if (tab) tab.textContent = count > 0 ? `Requests (${count})` : 'Requests';
}

/* ── Rendering ───────────────────────────────────────────────────────────── */

/**
 * Renders a user card appropriate for the given context.
 * @param {object} user
 * @param {'friend'|'following'|'discover'} context
 */
function renderUserCard(user, context) {
  const avatar = user.avatar
    ? `<img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.username)}" class="w-full h-full object-cover">`
    : `<span class="text-white font-bold text-lg">${escapeHtml(user.username.charAt(0).toUpperCase())}</span>`;

  const onlineBadge = user.is_online
    ? `<span class="absolute bottom-0 right-0 px-2 py-0.5 rounded-full text-[9px] font-bold border-2 border-white dark:border-slate-900 shadow-lg ${user.is_idle ? 'bg-amber-400 text-white' : 'bg-green-500 text-white'}">${user.is_idle ? 'Idle' : 'Online'}</span>`
    : '';

  // Name display logic: Use first + last name if available, otherwise username
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const displayName = fullName || user.username;
  const usernameOpacity = fullName ? 'opacity-50' : '';
  const usernameDisplay = fullName 
    ? `<span class="text-xs text-slate-400 dark:text-slate-500 ${usernameOpacity}">@${escapeHtml(user.username)}</span>`
    : '';

  // Best Match badge for discover page - now at card border
  const isBestMatch = context === 'discover' && user.matching_tags_count > 0;
  const bestBadge = isBestMatch 
    ? `<div class="absolute -top-2 -left-2 bg-gradient-to-br from-amber-400 to-amber-500 text-white px-2 py-0.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-xl border-2 border-white dark:border-slate-900 z-10">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
        <span>Best</span>
      </div>`
    : '';

  // Tags display - highlight matching tags
  const tags = Array.isArray(user.tags) ? user.tags : [];
  const matchingTags = user.matching_tags || [];
  const tagsHtml = tags.length 
    ? `<div class="flex flex-wrap gap-1.5 mt-2">${tags.map(tag => {
        const isMatching = matchingTags.includes(tag);
        const tagClass = isMatching 
          ? 'zz-user-tag bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 font-semibold'
          : 'zz-user-tag';
        return `<span class="${tagClass}">${escapeHtml(tag)}</span>`;
      }).join('')}</div>`
    : '';

  const bio = user.bio && !fullName ? `<p class="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 mt-1">${escapeHtml(user.bio)}</p>` : '';

  let actionBtn = '';
  if (context === 'friend') {
    actionBtn = `
      <div class="flex gap-2 w-full">
        <button onclick="window.location='/u/${escapeHtml(user.username)}'" class="zz-social-btn zz-btn-view rounded-lg px-3 py-1.5 flex-1">View Profile</button>
        <button onclick="socialUnfriend(${user.id}, this)" class="zz-social-btn zz-btn-unfriend rounded-lg px-3 py-1.5" title="Unfriend">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6"/></svg>
        </button>
      </div>`;
  } else if (context === 'following') {
    actionBtn = `<button onclick="socialUnfollow(${user.id}, this)" class="zz-social-btn zz-btn-following rounded-lg px-3 py-1.5">
      <span class="btn-icon">✓</span><span>Following</span>
    </button>`;
  } else if (context === 'discover') {
    actionBtn = `
      <div class="flex gap-2 w-full">
        <button onclick="socialFriendRequest(${user.id}, this)" class="zz-social-btn zz-btn-add rounded-lg px-3 py-1.5 flex-1">
          <span>+ Add</span>
        </button>
        <button onclick="socialFollow(${user.id}, this)" class="zz-social-btn zz-btn-follow rounded-lg px-3 py-1.5 flex-1">
          Follow
        </button>
      </div>`;
  }

  return `
  <div data-user-card="${user.id}" class="zz-user-card group relative ${isBestMatch ? 'ring-2 ring-amber-400/50 dark:ring-amber-500/50' : ''}">
    ${bestBadge}
    <div class="flex gap-3 mb-3">
      <a href="/u/${escapeHtml(user.username)}" class="relative flex-shrink-0">
        <div class="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center overflow-hidden border-2 border-transparent group-hover:border-primary-400 transition-all ${isBestMatch ? '!border-amber-400 dark:!border-amber-500' : ''}">
          ${avatar}
        </div>
        ${onlineBadge}
      </a>
      <div class="flex-1 min-w-0">
        <a href="/u/${escapeHtml(user.username)}" class="font-bold text-sm text-slate-900 dark:text-white hover:text-primary-500 transition-colors truncate block">${escapeHtml(displayName)}</a>
        ${usernameDisplay}
        ${bio}
        ${tagsHtml}
      </div>
    </div>
    ${actionBtn}
  </div>`;
}

/**
 * Renders an incoming or outgoing request card.
 */
function renderRequestCard(user, direction) {
  const avatar = user.avatar
    ? `<img src="${escapeHtml(user.avatar)}" alt="" class="w-full h-full object-cover">`
    : `<span class="text-white font-bold">${escapeHtml(user.username.charAt(0).toUpperCase())}</span>`;

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const timeAgo = relativeTime(user.requested_at);

  const actions = direction === 'in'
    ? `<button onclick="socialFriendAccept(${user.id}, this.closest('[data-request-card]'))"
         class="zz-social-btn zz-btn-accept">✓ Accept</button>
       <button onclick="socialFriendDecline(${user.id}, this.closest('[data-request-card]'))"
         class="zz-social-btn zz-btn-decline">✕ Decline</button>`
    : `<button onclick="socialFriendCancel(${user.id}, this)" class="zz-social-btn zz-btn-pending">
         <span class="hover-hide">⏳ Pending</span>
         <span class="hover-show">✕ Cancel</span>
       </button>`;

  return `
  <div data-request-card="${user.id}" class="zz-request-card">
    <div class="flex items-center gap-3">
      <a href="/u/${escapeHtml(user.username)}" class="flex-shrink-0">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center overflow-hidden">
          ${avatar}
        </div>
      </a>
      <div class="flex-1 min-w-0">
        <a href="/u/${escapeHtml(user.username)}" class="font-semibold text-sm text-slate-900 dark:text-white hover:text-primary-500 transition-colors">${escapeHtml(displayName)}</a>
        <p class="text-xs text-slate-400">@${escapeHtml(user.username)} · ${timeAgo}</p>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">${actions}</div>
    </div>
  </div>`;
}

function renderSkeletons(n, size = 'normal') {
  const h = size === 'small' ? 'h-16' : 'h-28';
  return Array.from({ length: n }, () =>
    `<div class="zz-skeleton ${h} rounded-2xl animate-pulse bg-slate-100 dark:bg-slate-800/60"></div>`
  ).join('');
}

function renderEmpty(msg) {
  return `<div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
    <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl mb-4">👥</div>
    <p class="text-sm text-slate-400 max-w-xs">${escapeHtml(msg)}</p>
  </div>`;
}

/* ── API Helpers ─────────────────────────────────────────────────────────── */
async function apiGet(action) {
  try {
    const res = await fetch(`${SOCIAL_API}?action=${action}`, { credentials: 'same-origin' });
    return await res.json();
  } catch { return { success: false, message: 'Network error' }; }
}

async function apiPost(action, body = {}) {
  try {
    const res = await fetch(`${SOCIAL_API}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch { return { success: false, message: 'Network error' }; }
}

/* ── UI Helpers ─────────────────────────────────────────────────────────── */
function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.dataset.origText = btn.innerHTML;
  btn.innerHTML = loading
    ? '<span class="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>'
    : (btn.dataset.origText || btn.innerHTML);
}

function showToast(message, type = 'info') {
  const colors = {
    success: 'bg-emerald-500',
    error:   'bg-red-500',
    info:    'bg-primary-500'
  };

  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-2xl
    ${colors[type] || colors.info} transform translate-y-4 opacity-0 transition-all duration-300`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
    setTimeout(() => {
      toast.classList.add('translate-y-4', 'opacity-0');
      setTimeout(() => toast.remove(), 350);
    }, 3500);
  });
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr + 'Z')) / 1000);
  if (diff < 60)      return `${diff}s ago`;
  if (diff < 3600)    return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Listen to real-time live social graph updates from SSE stream
window.addEventListener('zz-social-update', (e) => {
  const { action, from_user_id } = e.detail;
  const userIdStr = String(from_user_id);
  
  if (action === 'request_cancelled') {
    // Remove the incoming request card matching this user surgically
    const card = document.querySelector(`[data-request-card="${userIdStr}"]`);
    if (card) {
      card.style.transform = 'scale(0.95)';
      card.style.opacity = '0';
      card.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        card.remove();
        // If requests list empty, render empty state
        const requestsList = document.getElementById('zz-requests-list');
        if (requestsList && !requestsList.querySelector('[data-request-card]')) {
          requestsList.innerHTML = `
            <div class="px-4 py-8 text-center text-slate-500 italic text-sm">
              No pending friend requests.
            </div>`;
        }
      }, 300);
    }
  } else if (action === 'unfriended') {
    // Remove the user card from friends grid surgically
    const card = document.querySelector(`[data-user-card="${userIdStr}"]`);
    if (card) {
      card.style.transform = 'scale(0.95)';
      card.style.opacity = '0';
      card.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        card.remove();
        // If friends grid empty, show empty state
        const friendsGrid = document.getElementById('zz-friends-list');
        if (friendsGrid && !friendsGrid.querySelector('[data-user-card]')) {
          friendsGrid.innerHTML = `
            <div class="px-4 py-8 text-center text-slate-500 italic text-sm col-span-full">
              No friends yet.
            </div>`;
        }
      }, 300);
    }
  }
});
