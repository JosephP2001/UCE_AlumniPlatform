'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const MESSAGING_URL = process.env.NEXT_PUBLIC_MESSAGING_URL || '';

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  readAt?: string;
  createdAt: string;
}

export interface Conversation {
  _id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: string;
}

type WsEvent =
  | { type: 'connected'; userId: string }
  | { type: 'new_message'; message: Message }
  | { type: 'messages_read'; conversationId: string }
  | { type: 'pong' }
  | { type: 'error'; error: string };

export function useMessaging(token: string | null) {
  const wsRef    = useRef<WebSocket | null>(null);
  const pingRef  = useRef<NodeJS.Timeout | null>(null);
  const [connected, setConnected]   = useState(false);
  const [messages,  setMessages]    = useState<Message[]>([]);
  const [unread,    setUnread]      = useState(0);

  // Derive WS base from NEXT_PUBLIC_MESSAGING_URL (http → ws, https → wss)
  const wsBase = MESSAGING_URL.replace(/^http/, 'ws');

  const connect = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${wsBase}/api/messaging/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 25_000);
    };

    ws.onmessage = (evt) => {
      const data: WsEvent = JSON.parse(evt.data);
      if (data.type === 'new_message') {
        setMessages(prev => [...prev, data.message]);
        setUnread(n => n + 1);
      }
      if (data.type === 'messages_read') {
        setMessages(prev =>
          prev.map(m =>
            m.conversationId === data.conversationId && !m.readAt
              ? { ...m, readAt: new Date().toISOString() }
              : m
          )
        );
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);
      // Reconnect after 3 s
      setTimeout(connect, 3_000);
    };

    ws.onerror = () => ws.close();
  }, [token, wsBase]);

  useEffect(() => {
    connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendWsMessage = useCallback((conversationId: string, content: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'send_message', conversationId, content }));
  }, []);

  const markRead = useCallback((conversationId: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'mark_read', conversationId }));
    setUnread(0);
  }, []);

  return { connected, messages, unread, sendWsMessage, markRead, setMessages };
}

// ── REST helpers ───────────────────────────────────────────────

async function apiFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${MESSAGING_URL}/api/messaging${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`messaging API ${res.status}`);
  return res.json();
}

export const messagingApi = {
  getConversations: (token: string) =>
    apiFetch<{ conversations: Conversation[] }>('/conversations', token),

  startConversation: (token: string, recipientId: string) =>
    apiFetch<{ conversation: Conversation }>('/conversations', token, {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    }),

  getMessages: (token: string, conversationId: string, page = 1) =>
    apiFetch<{ messages: Message[]; total: number; page: number }>(
      `/conversations/${conversationId}/messages?page=${page}`, token
    ),

  sendMessage: (token: string, conversationId: string, content: string) =>
    apiFetch<{ message: Message }>(`/conversations/${conversationId}/messages`, token, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  markAsRead: (token: string, conversationId: string) =>
    apiFetch(`/conversations/${conversationId}/read`, token, { method: 'PATCH' }),

  getUnreadCount: (token: string) =>
    apiFetch<{ unread: number }>('/unread', token),
};
