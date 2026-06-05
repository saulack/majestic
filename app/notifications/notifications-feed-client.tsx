"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import type { InAppNotification } from "@/lib/types";

const notificationToneByType: Record<InAppNotification["type"], string> = {
  feature_status: "border-cyan-200 bg-cyan-50 text-cyan-900",
  reservation_invite: "border-emerald-200 bg-emerald-50 text-emerald-900",
  request_boost: "border-amber-200 bg-amber-50 text-amber-900"
};

const notificationLabelByType: Record<InAppNotification["type"], string> = {
  feature_status: "Request update",
  reservation_invite: "Reservation invite",
  request_boost: "Boost"
};

export function NotificationsFeedClient({ initialNotifications }: { initialNotifications: InAppNotification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.isRead).length, [notifications]);

  async function markAsRead(notificationId: string) {
    setBusy(true);
    setStatus("");

    const response = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId })
    });

    const payload = (await response.json()) as { success?: boolean; error?: string; readAt?: string };
    setBusy(false);

    if (!response.ok || !payload.success) {
      setStatus(payload.error ?? "Unable to update notification.");
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              isRead: true,
              readAt: payload.readAt ?? notification.readAt
            }
          : notification
      )
    );
  }

  async function markAllAsRead() {
    const unreadNotifications = notifications.filter((notification) => !notification.isRead);
    if (unreadNotifications.length === 0) {
      setStatus("All notifications are already read.");
      return;
    }

    setBusy(true);
    setStatus("");

    const response = await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds: unreadNotifications.map((notification) => notification.id) })
    });

    const payload = (await response.json()) as { success?: boolean; error?: string; readAt?: string };
    setBusy(false);

    if (!response.ok || !payload.success) {
      setStatus(payload.error ?? "Unable to mark all notifications as read.");
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.isRead
          ? notification
          : {
              ...notification,
              isRead: true,
              readAt: payload.readAt ?? notification.readAt
            }
      )
    );

    setStatus("All notifications marked as read.");
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#2f7b84]">In-app notifications</p>
          <h2 className="mt-2 text-xl sm:text-2xl">Notifications</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-slate-500">Unread: {unreadCount}</p>
          <button
            type="button"
            disabled={busy || unreadCount === 0}
            onClick={() => {
              void markAllAsRead();
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:opacity-60"
          >
            Mark all as read
          </button>
        </div>
      </div>

      {status ? <p className="mt-3 text-sm text-slate-600">{status}</p> : null}

      <div className="mt-5 grid gap-3">
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            No notifications yet.
          </div>
        ) : (
          notifications.map((notification) => (
            <article key={notification.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{notification.body}</p>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${notificationToneByType[notification.type]}`}>
                  {notificationLabelByType[notification.type]}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <span>{format(parseISO(notification.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                <div className="flex items-center gap-2">
                  {!notification.isRead ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void markAsRead(notification.id);
                      }}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
                    >
                      Mark read
                    </button>
                  ) : (
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Read</span>
                  )}
                  {notification.href ? (
                    <Link href={notification.href} className="font-medium text-amber-700 hover:text-amber-800">
                      Open
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
