'use client';

import { useEffect, useRef, useState } from 'react';
import { useMessaging, messagingApi, Conversation, Message } from '@/hooks/useMessaging';

interface Props {
  token: string;
  currentUserId: string;
}

export default function ChatWindow({ token, currentUserId }: Props) {
  const { connected, messages: wsMessages, unread, sendWsMessage, markRead, setMessages } =
    useMessaging(token);

  const [conversations,       setConversations]       = useState<Conversation[]>([]);
  const [activeConversation,  setActiveConversation]  = useState<Conversation | null>(null);
  const [historicMessages,    setHistoricMessages]    = useState<Message[]>([]);
  const [input,               setInput]               = useState('');
  const [loadingConvs,        setLoadingConvs]        = useState(true);
  const [sending,             setSending]             = useState(false);
  const [newRecipient,        setNewRecipient]        = useState('');
  const [showNewChat,         setShowNewChat]         = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversations on mount
  useEffect(() => {
    messagingApi.getConversations(token)
      .then(r => setConversations(r.conversations))
      .catch(console.error)
      .finally(() => setLoadingConvs(false));
  }, [token]);

  // Load history when selecting a conversation
  useEffect(() => {
    if (!activeConversation) return;
    messagingApi.getMessages(token, activeConversation._id)
      .then(r => {
        setHistoricMessages(r.messages);
        setMessages([]);
        markRead(activeConversation._id);
      })
      .catch(console.error);
  }, [activeConversation, token, markRead, setMessages]);

  // Merge historic + real-time, scroll to bottom
  const allMessages = [
    ...historicMessages,
    ...wsMessages.filter(m => m.conversationId === activeConversation?._id),
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  const handleSend = async () => {
    if (!input.trim() || !activeConversation || sending) return;
    setSending(true);
    try {
      sendWsMessage(activeConversation._id, input.trim());
      setInput('');
    } finally {
      setSending(false);
    }
  };

  const handleStartConversation = async () => {
    if (!newRecipient.trim()) return;
    try {
      const { conversation } = await messagingApi.startConversation(token, newRecipient.trim());
      setConversations(prev => [conversation, ...prev.filter(c => c._id !== conversation._id)]);
      setActiveConversation(conversation);
      setShowNewChat(false);
      setNewRecipient('');
    } catch (err) {
      alert('No se pudo crear la conversación. Verifica el ID del usuario.');
    }
  };

  const otherParticipant = (conv: Conversation) =>
    conv.participants.find(p => p !== currentUserId) ?? 'Usuario';

  return (
    <div className="flex h-[600px] border border-gray-200 rounded-xl overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-64 flex flex-col border-r border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">Mensajes</span>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {unread}
              </span>
            )}
            <button
              onClick={() => setShowNewChat(s => !s)}
              className="text-blue-600 text-xs hover:underline"
            >
              + Nuevo
            </button>
          </div>
        </div>

        {showNewChat && (
          <div className="p-2 border-b border-gray-200 bg-white">
            <input
              className="w-full text-xs border border-gray-300 rounded px-2 py-1 mb-1"
              placeholder="ID del destinatario"
              value={newRecipient}
              onChange={e => setNewRecipient(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStartConversation()}
            />
            <button
              onClick={handleStartConversation}
              className="w-full text-xs bg-blue-600 text-white rounded py-1 hover:bg-blue-700"
            >
              Iniciar chat
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <p className="text-xs text-gray-400 p-3">Cargando...</p>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-gray-400 p-3">Sin conversaciones</p>
          ) : (
            conversations.map(conv => (
              <button
                key={conv._id}
                onClick={() => setActiveConversation(conv)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 transition-colors border-b border-gray-100 ${
                  activeConversation?._id === conv._id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <p className="font-medium text-gray-700 truncate">{otherParticipant(conv)}</p>
                {conv.lastMessage && (
                  <p className="text-gray-400 truncate">{conv.lastMessage}</p>
                )}
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t border-gray-200">
          <span className={`text-xs ${connected ? 'text-green-600' : 'text-red-500'}`}>
            {connected ? '● Conectado' : '○ Reconectando...'}
          </span>
        </div>
      </aside>

      {/* ── Chat area ── */}
      <main className="flex-1 flex flex-col bg-white">
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Selecciona una conversación
          </div>
        ) : (
          <>
            <header className="px-4 py-2 border-b border-gray-200 text-sm font-medium text-gray-700">
              {otherParticipant(activeConversation)}
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {allMessages.map((msg, i) => {
                const isMine = msg.senderId === currentUserId;
                return (
                  <div key={msg._id ?? i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                        isMine
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p className={`text-xs mt-0.5 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMine && msg.readAt ? ' ✓✓' : isMine ? ' ✓' : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <footer className="px-3 py-2 border-t border-gray-200 flex gap-2">
              <input
                className="flex-1 text-sm border border-gray-300 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Escribe un mensaje..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={!connected}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || !connected || sending}
                className="bg-blue-600 text-white text-sm rounded-full px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Enviar
              </button>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
