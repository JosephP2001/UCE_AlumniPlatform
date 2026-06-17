'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ServiceStatus from '@/components/ServiceStatus';
import JobsList from '@/components/JobsList';

type User = {
  id: number;
  username: string;
  name: string;
  avatar: string;
  provider: string;
  role?: string;
};

const ROLES = [
  {
    id: 'student',
    label: 'Student / Alumni',
    description: 'Browse and apply to job listings',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 13c0 3.866-4.03 7-9 7s-9-3.134-9-7a12.08 12.08 0 012.84-2.422L12 14z" />
      </svg>
    ),
  },
  {
    id: 'company',
    label: 'Company',
    description: 'Post job listings for UCE alumni',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
];

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'unauthorized') setAuthError('You must be logged in to access that page.');
    if (error === 'forbidden') setAuthError('Your role does not have access to that page.');

    const token = sessionStorage.getItem('access_token');
    const userStr = sessionStorage.getItem('user');

    if (!token || !userStr) {
      router.push('/auth/login');
      return;
    }

    try {
      const parsed: User = JSON.parse(userStr);
      setUser(parsed);
      if (!parsed.role) setShowRolePicker(true);
    } catch {
      router.push('/auth/login');
    }
  }, [router, searchParams]);

  const selectRole = (role: string) => {
    if (!user) return;
    const updated = { ...user, role };
    sessionStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
    setShowRolePicker(false);
  };

  const logout = () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    router.push('/auth/login');
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-950 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-white">UCE Alumni</span>
          </div>

          <div className="flex items-center gap-3">
            {user.role && (
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                user.role === 'company'
                  ? 'bg-blue-950 text-blue-300 border-blue-900'
                  : 'bg-green-950 text-green-300 border-green-900'
              }`}>
                {user.role}
              </span>
            )}
            <button
              onClick={() => setShowRolePicker(true)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              change role
            </button>
            {/* Profile link */}
            <button
              onClick={() => router.push('/profile')}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              my profile
            </button>
            {/* Notifications link */}
            <button
              onClick={() => router.push('/notifications')}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              notifications
            </button>
            <div className="flex items-center gap-2">
              {user.avatar && (
                <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full" />
              )}
              <span className="text-sm text-gray-300 hidden sm:block">{user.name || user.username}</span>
            </div>
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              logout
            </button>
          </div>
        </div>
      </nav>

      {/* Role picker modal */}
      {showRolePicker && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-1">Who are you?</h2>
            <p className="text-gray-400 text-sm mb-6">
              Select your role on the platform. You can change it later.
            </p>
            <div className="space-y-3">
              {ROLES.map(role => (
                <button
                  key={role.id}
                  onClick={() => selectRole(role.id)}
                  className="w-full flex items-start gap-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-600 rounded-xl p-4 text-left transition-all group"
                >
                  <span className="text-gray-400 group-hover:text-blue-400 transition-colors mt-0.5">
                    {role.icon}
                  </span>
                  <div>
                    <p className="text-white font-medium text-sm">{role.label}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{role.description}</p>
                  </div>
                </button>
              ))}
            </div>
            {user.role && (
              <button
                onClick={() => setShowRolePicker(false)}
                className="mt-4 w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Auth error banner */}
        {authError && (
          <div className="bg-yellow-950 border border-yellow-800 rounded-xl px-4 py-3 text-yellow-300 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {authError}
          </div>
        )}

        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Hello, {user.name?.split(' ')[0] || user.username} 👋
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {user.role === 'company'
                ? 'Manage your job listings and connect with UCE alumni.'
                : 'Explore job opportunities from companies hiring UCE alumni.'}
            </p>
          </div>
          <div className="flex gap-2">
            {user.role === 'student' && (
              <>
                <a
                  href="/notifications"
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Notifications
                </a>
                <a
                  href="/profile"
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  My profile
                </a>
              </>
            )}
            {user.role === 'company' && (
              <a
                href="/jobs/new"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                + Post job
              </a>
            )}
          </div>
        </div>

        {/* Service Status */}
        <ServiceStatus />

        {/* Jobs */}
        <JobsList />

      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
