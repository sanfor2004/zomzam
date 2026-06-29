'use client';
import { Button } from '@/components/ui';

import React, { useState, useEffect, useRef } from 'react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { User, Upload, Trash2, X, Plus, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import {
  fetchProfile, uploadAvatarRequest, removeAvatarRequest, saveProfileRequest, validateAvatarFile,
} from './page.services';

export default function MyProfilePage() {
  const { t } = useTranslation();
  const router = useRouter();

  // Profile data states
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);

  // File upload states — avatar changes upload immediately on selection (see
  // uploadAvatar/handleRemoveAvatar), independent of the Save button below.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Tag input state
  const [tagInput, setTagInput] = useState('');

  // UI status states
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  usePageEntrance(containerRef, [isPageLoading]);

  // Fetch initial profile data
  useEffect(() => {
    (async () => {
      try {
        const user = await fetchProfile();
        if (!user) { router.push('/sign'); return; }
        setUsername(user.username);
        setEmail(user.email);
        setFirstName(user.first_name);
        setLastName(user.last_name);
        setBio(user.bio);
        setCurrentAvatarUrl(user.avatar);
        setTags(user.tags);
      } catch (err) {
        console.error('Failed to load profile details:', err);
      } finally {
        setIsPageLoading(false);
      }
    })();
  }, [router]);

  // Clean up image preview URL if it changes
  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // Upload the avatar immediately — no separate "Save" step for photo changes.
  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await uploadAvatarRequest(file);
      if (data.success) {
        setCurrentAvatarUrl(data.avatar);
        setAvatarPreview(null);
        setSuccessMsg('Profile photo updated');
      } else {
        setAvatarPreview(null);
        setErrorMsg(data.message || 'Failed to upload photo');
      }
    } catch (err) {
      console.error(err);
      setAvatarPreview(null);
      setErrorMsg('An error occurred while uploading the photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-picking the same file still fires onChange
    if (!file) return;

    const err = validateAvatarFile(file);
    if (err) { setErrorMsg(err); return; }

    setErrorMsg(null);
    setAvatarPreview(URL.createObjectURL(file));
    uploadAvatar(file);
  };

  // Trigger file select dialog
  const triggerFileSelect = () => {
    if (avatarUploading) return;
    fileInputRef.current?.click();
  };

  // Handle avatar removal — fires immediately, same as upload.
  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const data = await removeAvatarRequest();
      if (data.success) {
        setCurrentAvatarUrl(null);
        setAvatarPreview(null);
        setSuccessMsg('Profile photo removed');
      } else {
        setErrorMsg(data.message || 'Failed to remove photo');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred while removing the photo');
    } finally {
      setAvatarUploading(false);
    }
  };

  // Add tag
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = tagInput.trim().toLowerCase();
      if (!trimmed) return;

      if (tags.includes(trimmed)) {
        setTagInput('');
        return;
      }

      if (tags.length >= 10) {
        setErrorMsg('You can add a maximum of 10 tags');
        return;
      }

      setTags(prev => [...prev, trimmed]);
      setTagInput('');
      setErrorMsg(null);
    }
  };

  const addTagButton = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;

    if (tags.includes(trimmed)) {
      setTagInput('');
      return;
    }

    if (tags.length >= 10) {
      setErrorMsg('You can add a maximum of 10 tags');
      return;
    }

    setTags(prev => [...prev, trimmed]);
    setTagInput('');
    setErrorMsg(null);
  };

  // Remove tag
  const handleRemoveTag = (indexToRemove: number) => {
    setTags(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Handle Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const data = await saveProfileRequest({ firstName, lastName, bio, tags });
      if (data.success) {
        setSuccessMsg(t('profile_success'));
        // Force header re-render to load updated details
        window.location.reload();
      } else {
        setErrorMsg(data.message || 'Failed to save profile details');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('An error occurred during submission');
    } finally {
      setIsSaving(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  // Choose the display avatar
  let displayAvatar = '/Assets/Img/default-avatar.png';
  if (avatarPreview) {
    displayAvatar = avatarPreview;
  } else if (currentAvatarUrl) {
    displayAvatar = currentAvatarUrl;
  }

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Profile icon badge, title + description copy
          ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">
            {t('profile_title')}
          </h1>
          <p className="text-xs text-slate-400">
            {t('profile_desc')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: LEFT COLUMN — AVATAR + ACCOUNT INFO
            Contains: Avatar frame with upload/remove, hidden file input,
            photo action buttons, account info card, public-profile link
            ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col items-center text-center">
            
            {/* Avatar Photo Frame — click/tap anywhere on the photo to change it
                (auto-uploads on selection, no separate Save step) */}
            <div className="relative group w-32 h-32 rounded-3xl overflow-hidden shadow-lg mb-5 bg-[#111318] isolate [transform:translateZ(0)] outline outline-2 outline-offset-2 outline-transparent hover:outline-primary-500/50 transition-colors duration-300">
              <img
                src={displayAvatar}
                alt="Profile photo"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <Button variant="unstyled"
                type="button"
                onClick={triggerFileSelect}
                disabled={avatarUploading}
                aria-label={t('profile_avatar_change')}
                className={`absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center gap-1.5 transition-opacity duration-200 cursor-pointer text-white text-[10px] font-bold uppercase tracking-wider ${
                  avatarUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                {avatarUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>{t('profile_avatar_change')}</span>
                  </>
                )}
              </Button>
            </div>

            {/* Hidden Input file */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            {/* Photo Action Buttons — delete only; changing the photo is done by
                clicking the frame above */}
            {(currentAvatarUrl || avatarPreview) && (
              <div className="flex gap-2 w-full justify-center">
                <Button variant="unstyled"
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  className="p-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/10 rounded-xl text-red-500 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-default"
                  title={t('profile_avatar_remove')}
                  aria-label={t('profile_avatar_remove')}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}

            <span className="text-[9px] text-slate-400 mt-4 max-w-[180px] leading-relaxed block">
              Max file size is 2MB. Valid formats: JPEG, PNG, GIF, WEBP. Image metadata is stripped automatically.
            </span>
          </div>

          {/* Social Stats Info */}
          <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Account Information
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Username</span>
                <span className="text-sm font-bold text-white">@{username}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Email Address</span>
                <span className="text-sm font-bold text-white">{email}</span>
              </div>
              <a
                href={`/u/${username}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs text-primary-500 hover:text-primary-600 font-bold transition-all pt-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                View Public Profile
              </a>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: RIGHT COLUMN — IDENTITY & BIO FORM
            Contains: Success/error banners, first/last name, bio textarea,
            interests tag selector, save button
            ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-8">
          
          <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple">

            <div className="mb-6 pb-4 border-b border-slate-850">
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
                Identity & Bio
              </h2>
            </div>

            {successMsg && <Alert variant="success" className="mb-6">{successMsg}</Alert>}
            {errorMsg && <Alert variant="error" className="mb-6">{errorMsg}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* First Name & Last Name */}
              <div data-entrance="list-item" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    {t('profile_first_name')}
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={100}
                    className="w-full h-11 px-4 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                    {t('profile_last_name')}
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={100}
                    className="w-full h-11 px-4 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white"
                  />
                </div>
              </div>

              {/* Bio Field */}
              <div data-entrance="list-item">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  {t('profile_bio')}
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="Tell us about yourself, your skills, or current projects..."
                  className="w-full p-4 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white resize-none"
                />
                <div className="flex justify-end mt-1.5">
                  <span className="text-[9px] text-slate-400 font-semibold">
                    {bio.length}/500 characters
                  </span>
                </div>
              </div>

              {/* Interactive Interests Tags Selector */}
              <div data-entrance="list-item">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {t('profile_tags')}
                  </label>
                  <span className="text-[9px] text-slate-400 font-semibold">
                    {tags.length}/10 tags
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 p-3.5 bg-slate-900/30 border border-slate-850 rounded-xl min-h-[50px] mb-3">
                  {tags.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No tags selected. Add some below!</span>
                  ) : (
                    tags.map((tag, idx) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-primary-500/10 border border-primary-500/20 text-primary-500 font-bold text-xs rounded-xl"
                      >
                        <span>#{tag}</span>
                        <Button variant="unstyled"
                          type="button"
                          onClick={() => handleRemoveTag(idx)}
                          className="hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </span>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Type a tag (e.g. typescript) and press Enter or comma"
                    className="flex-grow h-11 px-4 bg-slate-900/30 border border-slate-850 rounded-xl text-sm focus:outline-none focus:border-primary-500 transition-all text-white"
                  />
                  <Button variant="unstyled"
                    type="button"
                    onClick={addTagButton}
                    className="h-11 px-4 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>

                <p className="text-[9px] text-slate-400 mt-2 leading-relaxed">
                  {t('profile_tags_desc')}
                </p>
              </div>

              <Button variant="unstyled"
                type="submit"
                disabled={isSaving}
                className="w-full h-11 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-400 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {t('profile_save')}
              </Button>

            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
