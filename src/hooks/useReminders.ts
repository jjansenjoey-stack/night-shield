import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { useToast } from '@/components/ui/Toast';
import { formatEventDate } from '@/lib/format';
import { appUrl } from '@/lib/url';

const FIRED_KEY = 'ns.remindersFired.v1';
const DAY_MS = 86400000;
const HOUR_MS = 3600000;

function readFired(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}') as Record<string, true>;
  } catch {
    return {};
  }
}

function markFired(key: string) {
  const fired = readFired();
  fired[key] = true;
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    /* non-fatal */
  }
}

/**
 * Prompt 53 — nudges for events the user has RSVP'd to, a day out and an hour
 * out. Uses the Notification API when permission has already been granted,
 * and always falls back to an in-app toast so the reminder is never silent.
 */
export function useReminders() {
  const user = useAppStore((s) => s.user);
  const rsvps = useAppStore((s) => s.rsvps);
  const data = useAppStore((s) => s.data);
  const toast = useToast();
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];

    if (!user || !data) return undefined;

    const mine = new Set(
      rsvps.filter((r) => r.user_id === user.id && r.rsvp_status === 'going').map((r) => r.event_id),
    );
    const fired = readFired();
    const now = Date.now();

    for (const event of data.events) {
      if (!mine.has(event.id)) continue;
      const start = new Date(event.start_time).getTime();

      for (const [label, lead] of [
        ['1d', DAY_MS],
        ['1h', HOUR_MS],
      ] as const) {
        const key = `${event.id}:${label}`;
        if (fired[key]) continue;

        const fireAt = start - lead;
        const delay = fireAt - now;
        // Only schedule reminders that land inside this session's lifetime.
        if (delay <= 0 || delay > DAY_MS) continue;

        const timer = window.setTimeout(() => {
          const message = `Your event "${event.title}" is ${label === '1d' ? 'tomorrow' : 'in an hour'} — ${formatEventDate(event.start_time)}`;
          markFired(key);

          if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
          ) {
            new Notification('Night Shield', { body: message });
          }
          toast.show(message, 'info', {
            label: 'View event',
            onClick: () => window.location.assign(appUrl(`/events?event=${event.id}`)),
          });
        }, delay);

        timers.current.push(timer);
      }
    }

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, [user, rsvps, data, toast]);
}

/** Called from a click — browsers refuse the prompt otherwise. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}
