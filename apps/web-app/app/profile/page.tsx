'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Profile = {
  id: number;
  user_id: string;
  username: string;
  full_name: string;
  career: string;
  graduation_year: number;
  bio: string;
  skills: string;
  location: string;
  linkedin_url: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
};

type User = {
  id: number;
  username: string;
  name: string;
  avatar: string;
};

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL ?? '';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

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

      fetch(`${PROFILE_URL}/api/profile/${parsed.id}`)
        .then(r => {
          if (r.status === 404) return null;
          if (!r.ok) throw new Error(`Error ${r.status}`);
          return r.json();
        })
        .then(data => {
          setProfile(data?.profile ?? null);
          setLoading(false);
        })
        .catch(() => {
          setError('Could not load profile');
          setLoading(false);
        });
    } catch {
      router.push('/auth/login');
    }
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // No profile yet
  if (!profile) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">No profile yet</h1>
          <p className="text-gray-400 text-sm mb-8">
            Create your alumni profile to connect with companies and opportunities.
          </p>
          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/profile/edit')}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Create profile
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Back */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-8 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </button>

        {/* Profile card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">

          {/* Avatar + name */}
          <div className="flex items-start gap-5 mb-8">
            {user?.avatar ? (
              <img src={user.avatar} alt={profile.full_name} className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl font-bold">
                {profile.full_name?.[0] ?? '?'}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">{profile.full_name || profile.username}</h1>
              <p className="text-blue-400 text-sm mt-1">@{profile.username}</p>
              {profile.career && (
                <p className="text-gray-400 text-sm mt-1">{profile.career}</p>
              )}
            </div>
            <button
              onClick={() => router.push('/profile/edit')}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          </div>

          {/* Info grid */}
          <div className="space-y-5">

            {profile.bio && (
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">About</p>
                <p className="text-gray-300 text-sm">{profile.bio}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {profile.graduation_year && (
                <div className="bg-gray-950 rounded-xl p-4">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Graduation</p>
                  <p className="text-white text-sm font-medium">{profile.graduation_year}</p>
                </div>
              )}
              {profile.location && (
                <div className="bg-gray-950 rounded-xl p-4">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Location</p>
                  <p className="text-white text-sm font-medium">📍 {profile.location}</p>
                </div>
              )}
            </div>

            {profile.skills && (
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.split(',').map((skill, i) => (
                    <span key={i} className="text-xs bg-blue-950 text-blue-300 border border-blue-900 px-2.5 py-1 rounded-full">
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.linkedin_url && (
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">LinkedIn</p>
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  {profile.linkedin_url}
                </a>
              </div>
            )}

            <div className="pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-600">
                Member since {new Date(profile.created_at).toLocaleDateString()}
                {profile.updated_at !== profile.created_at && (
                  <> · Updated {new Date(profile.updated_at).toLocaleDateString()}</>
                )}
              </p>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
