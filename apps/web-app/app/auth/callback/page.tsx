'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        sessionStorage.setItem('access_token', token);
        sessionStorage.setItem('user', JSON.stringify(user));
        router.push('/');
      } catch {
        router.push('/?error=auth_failed');
      }
    } else {
      router.push('/?error=auth_failed');
    }
  }, [searchParams, router]);

  return (
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-400">Completing login...</p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <Suspense fallback={<p className="text-gray-400">Loading...</p>}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}