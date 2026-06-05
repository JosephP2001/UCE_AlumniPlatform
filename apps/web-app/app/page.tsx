'use client';

import { useEffect, useState } from 'react';
import JobsList from '@/components/JobsList';
import ServiceStatus from '@/components/ServiceStatus';

type User = {
  id: number;
  username: string;
  name: string;
  avatar: string;
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('access_token');
      }
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    setUser(null);
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">UCE Alumni Platform</h1>
            <p className="text-gray-400 text-sm mt-1">Universidad Central del Ecuador</p>
          </div>
          {user ? (
            <div className="flex items-center gap-3">
              <img src={user.avatar} alt={user.username} className="w-8 h-8 rounded-full" />
              <span className="text-sm text-gray-300">{user.name || user.username}</span>
              <button onClick={handleLogout} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Logout</button>
            </div>
          ) : (
            <a href="/api/auth/github" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Login with GitHub</a>
          )}
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-8 py-10 space-y-10">
        <ServiceStatus />
        <JobsList />
      </div>
    </main>
  );
}
