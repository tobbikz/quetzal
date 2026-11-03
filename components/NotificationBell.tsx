'use client';

import Link from 'next/link';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/app/actions';
import { formatWhen } from '@/lib/format';
import type { Notification } from '@/lib/types';

export function NotificationBell({
  unreadCount,
  items,
}: {
  unreadCount: number;
  items: Notification[];
}) {
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);
  return (
    <details className="notif-bell">
      <summary aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}>
        <span className="notif-bell-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1.5a3.5 3.5 0 0 0-3.5 3.5v1.3c0 .7-.2 1.4-.6 2L2.7 10a.7.7 0 0 0 .6 1.1h9.4a.7.7 0 0 0 .6-1.1l-1.2-1.7c-.4-.6-.6-1.3-.6-2V5A3.5 3.5 0 0 0 8 1.5Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path d="M6.4 12.5a1.7 1.7 0 0 0 3.2 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
        {unreadCount > 0 ? <span className="notif-badge">{badge}</span> : null}
      </summary>
      <div className="notif-menu">
        <div className="notif-menu-head">
          <div>
            <strong>Notifications</strong>
            {unreadCount > 0 ? <span className="notif-menu-count">{unreadCount} unread</span> : null}
          </div>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="notif-linkish">
                Mark all read
              </button>
            </form>
          ) : null}
        </div>
        {items.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1.5a3.5 3.5 0 0 0-3.5 3.5v1.3c0 .7-.2 1.4-.6 2L2.7 10a.7.7 0 0 0 .6 1.1h9.4a.7.7 0 0 0 .6-1.1l-1.2-1.7c-.4-.6-.6-1.3-.6-2V5A3.5 3.5 0 0 0 8 1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </div>
            <p className="notif-empty-title">You&apos;re all caught up</p>
            <p className="notif-empty-body">Mentions, assignments, and watch updates will show up here.</p>
          </div>
        ) : (
          <ul className="notif-list">
            {items.map((item) => (
              <li key={item.id} className={item.readAt ? 'read' : 'unread'}>
                <form action={markNotificationReadAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="href" value={item.href ?? '/notifications'} />
                  <button type="submit" className="notif-item">
                    {!item.readAt ? <span className="notif-dot" aria-hidden /> : <span className="notif-dot is-read" aria-hidden />}
                    <span className="notif-item-copy">
                      <span className="notif-item-title">{item.title}</span>
                      {item.body ? <span className="notif-item-body">{item.body}</span> : null}
                      <span className="notif-item-meta">{formatWhen(item.createdAt)}</span>
                    </span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <Link href="/notifications" className="notif-footer">
          View all notifications
        </Link>
      </div>
    </details>
  );
}
