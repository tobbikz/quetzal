import Link from 'next/link';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/app/actions';
import { listNotifications, unreadNotificationCount } from '@/lib/db';
import { formatWhen } from '@/lib/format';
import { currentUser } from '@/lib/session';

export default async function NotificationsPage() {
  const user = await currentUser();
  const items = await listNotifications(user.id, 80);
  const unread = await unreadNotificationCount(user.id);

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="crumb current">Notifications</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-sub">
              {unread ? `${unread} unread` : 'All caught up'} · {items.length} total
            </p>
          </div>
          {unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <input type="hidden" name="next" value="/notifications" />
              <button type="submit" className="btn">
                Mark all read
              </button>
            </form>
          ) : null}
        </div>
        <section className="panel">
          {items.length === 0 ? (
            <div className="empty-state" role="status">
              <p className="empty-state-title">No notifications yet</p>
              <div className="empty-state-body">
                <p>Comments, @mentions, and watches will show up here.</p>
              </div>
            </div>
          ) : (
            <ul className="notif-page-list">
              {items.map((item) => (
                <li key={item.id} className={item.readAt ? 'read' : 'unread'}>
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="href" value={item.href ?? '/notifications'} />
                    <input type="hidden" name="next" value="/notifications" />
                    <button type="submit" className="notif-page-item">
                      <span className="notif-item-title">{item.title}</span>
                      {item.body ? <span className="notif-item-body">{item.body}</span> : null}
                      <span className="notif-item-meta">
                        {item.kind} · {formatWhen(item.createdAt)}
                        {item.readAt ? '' : ' · unread'}
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
