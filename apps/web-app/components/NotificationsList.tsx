'use client';

import { useEffect, useState } from 'react';

type Notification = {
  id: number;
  user_id: string;
  type: 'job_created' | 'new_match' | string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

const NOTIFICATIONS_URL = process.env.NEXT_PUBLIC_NOTIFICATIONS_URL ?? '';

const TYPE_STYLES: Record<string, string> = {
  new_match:   'bg-blue-950 text-blue-300 border-blue-900',
  job_created: 'bg-green-950 text-green-300 border-green-900',
};

const TYPE_ICONS: Record<string, string> = {
  new_match:   '🤝',
  job_created: '💼',
};

export default function NotificationsList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const userStr = sessionStorage.getItem('user');
    const token = sessionStorage.getItem('access_token');
    if (!userStr || !token) return;

    try {
      const user = JSON.parse(userStr);
      const id = String(user.id);
      setUserId(id);

      fetch(`${NOTIFICATIONS_URL}/api/notification/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(data => {
          setNotifications(data.notifications || []);
          setLoading(false);
        })
        .catch(() => {
          setError('Could not connect to notification-service');
          setLoading(false);
        });
    } catch {
      setError('Session error — please log in again');
      setLoading(false);
    }
  }, []);

  const markRead = async (id: number) => {
    const token = sessionStorage.getItem('access_token');
    await fetch(`${NOTIFICATIONS_URL}/api/notification/notifications/${id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-200">Notifications</h2>
          {unreadCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-medium">
              {unreadCount} new
            </span>
          )}
        </div>
      </div>

      {loading && (
        <p className="text-gray-400 text-sm">Loading notifications...</p>
      )}

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
          No notifications yet.
        </div>
      )}

      <div className="space-y-3">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`bg-gray-900 border rounded-xl p-4 transition-colors ${
              n.read
                ? 'border-gray-800 opacity-60'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-lg mt-0.5">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-white">{n.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      TYPE_STYLES[n.type] ?? 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}>
                      {n.type.replace('_', ' ')}
                    </span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>
                  {n.message && (
                    <p className="text-gray-400 text-sm mt-1">{n.message}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-2">
                    🕐 {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {!n.read && (
                <button
                  onClick={() => markRead(n.id)}
                  className="shrink-0 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
