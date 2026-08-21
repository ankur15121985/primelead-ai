/**
 * React hook for managing push notifications.
 *
 * Provides subscribe/unsubscribe/status functionality.
 * Automatically registers the service worker and handles VAPID key exchange.
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  subscriptionCount: number;
  loading: boolean;
}

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>({
    supported: false,
    permission: 'default',
    subscribed: false,
    subscriptionCount: 0,
    loading: true,
  });

  // Check support and current subscription status
  useEffect(() => {
    async function checkStatus() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus((s) => ({ ...s, supported: false, loading: false }));
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        const permission = Notification.permission;

        // Also check server-side status
        let serverStatus = { subscriptionCount: 0 };
        try {
          serverStatus = await api<{ subscriptionCount: number }>('/push/status');
        } catch {
          // ignore
        }

        setStatus({
          supported: true,
          permission,
          subscribed: Boolean(subscription),
          subscriptionCount: serverStatus.subscriptionCount || (subscription ? 1 : 0),
          loading: false,
        });
      } catch {
        setStatus((s) => ({ ...s, loading: false }));
      }
    }
    checkStatus();
  }, []);

  /** Subscribe to push notifications. */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus((s) => ({ ...s, permission }));
        return false;
      }

      // Get VAPID key from server
      const { publicKey } = await api<{ publicKey: string }>('/push/vapid-key');

      // Register service worker if needed
      const reg = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const sub = subscription.toJSON();
      if (!sub.endpoint || !sub.keys) return false;

      // Save subscription to server
      await api('/push/subscribe', {
        body: {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          userAgent: navigator.userAgent,
        },
      });

      setStatus((s) => ({
        ...s,
        permission: 'granted',
        subscribed: true,
        subscriptionCount: s.subscriptionCount + 1,
      }));

      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      return false;
    }
  }, []);

  /** Unsubscribe from push notifications. */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator)) return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Remove from server
        await api('/push/unsubscribe', {
          body: { endpoint },
        });
      }

      setStatus((s) => ({
        ...s,
        subscribed: false,
        permission: Notification.permission,
        subscriptionCount: Math.max(0, s.subscriptionCount - 1),
      }));

      return true;
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
      return false;
    }
  }, []);

  return {
    ...status,
    subscribe,
    unsubscribe,
  };
}
