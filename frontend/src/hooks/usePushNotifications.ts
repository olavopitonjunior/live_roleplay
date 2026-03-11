import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unsupported';
  loading: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function usePushNotifications() {
  const { user, orgId, authMethod } = useAuth();
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'unsupported',
    loading: false,
  });

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setState((prev) => ({
      ...prev,
      isSupported: supported,
      permission: supported ? Notification.permission : 'unsupported',
    }));

    if (supported && Notification.permission === 'granted') {
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState((prev) => ({ ...prev, isSubscribed: !!subscription }));
    } catch {
      // Ignore errors
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !VAPID_PUBLIC_KEY || authMethod !== 'jwt' || !user?.id) {
      return false;
    }

    setState((prev) => ({ ...prev, loading: true }));

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));

      if (permission !== 'granted') {
        setState((prev) => ({ ...prev, loading: false }));
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const subJson = subscription.toJSON();

      // Store subscription in database
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_profile_id: user.id,
          org_id: orgId || null,
          endpoint: subJson.endpoint!,
          p256dh_key: subJson.keys?.p256dh || null,
          auth_key: subJson.keys?.auth || null,
          platform: 'web',
          device_name: navigator.userAgent.includes('Mobile') ? 'Mobile Web' : 'Desktop Web',
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'user_profile_id,endpoint' }
      );

      if (error) {
        console.error('Failed to save push subscription:', error);
        setState((prev) => ({ ...prev, loading: false }));
        return false;
      }

      setState((prev) => ({ ...prev, isSubscribed: true, loading: false }));
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      setState((prev) => ({ ...prev, loading: false }));
      return false;
    }
  }, [state.isSupported, authMethod, user?.id, orgId]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Remove from database
        if (user?.id) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('user_profile_id', user.id)
            .eq('endpoint', endpoint);
        }
      }

      setState((prev) => ({ ...prev, isSubscribed: false, loading: false }));
      return true;
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
      setState((prev) => ({ ...prev, loading: false }));
      return false;
    }
  }, [user?.id]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
