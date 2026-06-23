'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ProfileFormData = {
  full_name: string;
  career: string;
  graduation_year: string;
  bio: string;
  skills: string;
  location: string;
  linkedin_url: string;
};

type User = {
  id: number;
  username: string;
  name: string;
  avatar: string;
};

const INITIAL: ProfileFormData = {
  full_name: '',
  career: '',
  graduation_year: '',
  bio: '',
  skills: '',
  location: '',
  linkedin_url: '',
};

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL ?? '';

export default function ProfileEditPage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileFormData>(INITIAL);
  const [user, setUser] = useState<User | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    const userStr = sessionStorage.getItem('user');

    if (!token || !userStr) {
      router.push('/auth/login');
      return;
    }

    try {
      const parsed: User = JSON.parse(userStr);
      setUser(parsed);

      // Try to load existing profile
      fetch(`${PROFILE_URL}/api/profile/${parsed.id}`)
        .then(r => {
          if (r.status === 404) return null;
          if (!r.ok) throw new Error(`Error ${r.status}`);
          return r.json();
        })
        .then(data => {
          if (data?.profile) {
            const p = data.profile;
            setForm({
              full_name: p.full_name ?? '',
              career: p.career ?? '',
              graduation_year: p.graduation_year?.toString() ?? '',
              bio: p.bio ?? '',
              skills: p.skills ?? '',
              location: p.location ?? '',
              linkedin_url: p.linkedin_url ?? '',
            });
            setIsEdit(true);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } catch {
      router.push('/auth/login');
    }
  }, [router]);

  const set = (field: keyof ProfileFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);

    const token = sessionStorage.getItem('access_token');
    const url = isEdit
      ? `${PROFILE_URL}/api/profile/${user.id}`
      : `${PROFILE_URL}/api/profile`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          graduation_year: form.graduation_year ? parseInt(form.graduation_year) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isEdit ? 'Profile updated!' : 'Profile created!'}
          </h1>
          <p className="text-gray-400 text-sm mb-8">
            Your alumni profile is now visible on the platform.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/profile')}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              View profile
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex items-center gap-3">
            {user?.avatar && (
              <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">
                {isEdit ? 'Edit profile' : 'Create your profile'}
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                {isEdit ? 'Update your alumni information' : 'Introduce yourself to companies and recruiters'}
              </p>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-red-400 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-5">

          {/* Full name + career */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Full name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={set('full_name')}
                placeholder="Joseph Ponce"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Career / Degree</label>
              <input
                type="text"
                value={form.career}
                onChange={set('career')}
                placeholder="Sistemas de Información"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Location + graduation year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={set('location')}
                placeholder="Quito, Ecuador"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Graduation year</label>
              <input
                type="number"
                value={form.graduation_year}
                onChange={set('graduation_year')}
                placeholder="2025"
                min="2000"
                max="2035"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Bio</label>
            <textarea
              value={form.bio}
              onChange={set('bio')}
              rows={3}
              placeholder="Tell companies a bit about yourself..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Skills</label>
            <input
              type="text"
              value={form.skills}
              onChange={set('skills')}
              placeholder="Node.js, TypeScript, AWS, Docker, React"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-gray-600 mt-1">Separate skills with commas</p>
          </div>

          {/* LinkedIn */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">LinkedIn URL</label>
            <input
              type="url"
              value={form.linkedin_url}
              onChange={set('linkedin_url')}
              placeholder="https://linkedin.com/in/yourprofile"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => router.push('/profile')}
              className="px-5 py-2.5 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                isEdit ? 'Save changes' : 'Create profile'
              )}
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}
