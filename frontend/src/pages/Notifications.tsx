import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  is_read: boolean;
  sent_at: string;
  read_at: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  assignment_new: '📋',
  assignment_due: '⏰',
  feedback_ready: '📊',
  trial_ending: '⚠️',
  team_update: '👥',
  session_complete: '✅',
};

export function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('notification_log')
      .select('*')
      .eq('user_profile_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(50);

    setNotifications((data as Notification[]) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase
      .from('notification_log')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    );
  };

  const markAllRead = async () => {
    if (!user?.id) return;

    await supabase
      .from('notification_log')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_profile_id', user.id)
      .eq('is_read', false);

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() }))
    );
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-black">
              ←
            </button>
            <h1 className="text-lg font-bold text-black">Notificacoes</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg mb-2">Nenhuma notificacao</p>
            <p className="text-gray-300 text-sm">Voce sera notificado sobre tarefas, feedbacks e atualizacoes.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => markAsRead(notif.id)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-100 transition-colors ${
                  !notif.is_read ? 'bg-blue-50/50' : ''
                }`}
              >
                <span className="text-xl mt-0.5">
                  {TYPE_ICONS[notif.notification_type] || '🔔'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-sm ${!notif.is_read ? 'font-semibold text-black' : 'text-gray-700'}`}>
                      {notif.title}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(notif.sent_at)}</span>
                  </div>
                  {notif.body && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                  )}
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Notifications;
