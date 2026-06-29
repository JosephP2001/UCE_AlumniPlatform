'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatWindow from '@/components/ChatWindow';

export default function MessagesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = sessionStorage.getItem('access_token');
    const userStr = sessionStorage.getItem('user');
    if (!storedToken || !userStr) { router.push('/auth/login'); return; }
    try {
      const user = JSON.parse(userStr);
      setToken(storedToken);
      setUserId(user.id);
      setReady(true);
    } catch {
      router.push('/auth/login');
    }
  }, [router]);

  if (!ready || !token || !userId) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Mensajes</h1>
      <ChatWindow token={token} currentUserId={userId} />
    </main>
  );
}
