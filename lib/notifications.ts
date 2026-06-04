import type { ChannelPreference, Reservation, UserProfile } from "@/lib/types";

type NotificationPayload = {
  user: UserProfile;
  reservation: Reservation;
  channel: ChannelPreference;
};

async function sendEmail(_payload: NotificationPayload): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [_payload.user.email],
      subject: "Reservation confirmation",
      html: `
        <h2>Reservation confirmed</h2>
        <p>Hello ${_payload.user.fullName},</p>
        <p>Your reservation is confirmed for <strong>${_payload.reservation.startDate}</strong> to <strong>${_payload.reservation.endDate}</strong>.</p>
        <p><a href="${appUrl}/reservations">View reservations</a></p>
      `
    })
  });
}

async function sendSms(_payload: NotificationPayload): Promise<void> {
  // Wire Twilio SMS here.
  void _payload;
}

async function sendWhatsapp(_payload: NotificationPayload): Promise<void> {
  // Wire WhatsApp Cloud API or Twilio WhatsApp here.
  void _payload;
}

export async function sendReservationNotification(payload: NotificationPayload): Promise<void> {
  if (payload.channel === "email") {
    await sendEmail(payload);
    return;
  }

  if (payload.channel === "sms") {
    await sendSms(payload);
    return;
  }

  await sendWhatsapp(payload);
}

export async function sendReservationConfirmationEmail(params: {
  email: string;
  fullName: string;
  bookingDate: string;
  startDate: string;
  endDate: string;
  durationNights: number;
  bookedByName?: string;
  appUrl?: string;
}): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return;
  }

  const appUrl = params.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const durationLabel = `${params.durationNights} ${params.durationNights === 1 ? "night" : "nights"}`;
  const formatLongDate = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(parsed);
  };
  const formatDateTime = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(parsed);
  };

  const bookingDateLabel = formatDateTime(params.bookingDate);
  const startDateLabel = formatLongDate(params.startDate);
  const endDateLabel = formatLongDate(params.endDate);
  const bookedByOtherHtml = params.bookedByName
    ? `<p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#1d3a3f;background:#eef8f6;border:1px solid rgba(190,222,217,0.9);border-radius:10px;padding:10px 12px;">This reservation was created by <strong>${params.bookedByName}</strong>.</p>`
    : "";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.email],
      subject: "Your reservation is confirmed",
      html: `
        <div style="margin:0;padding:30px 14px;background:radial-gradient(circle at 12% 0%,rgba(255,210,172,0.35),transparent 36%),radial-gradient(circle at 88% 2%,rgba(152,228,215,0.35),transparent 36%),linear-gradient(180deg,#ecf8f4 0%,#f7fcf9 58%);font-family:'Avenir Next','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1d3a3f;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background:#fffdfc;border:1px solid rgba(190,222,217,0.8);border-radius:16px;box-shadow:0 18px 38px rgba(62,116,121,0.12);overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 20px 28px;background:linear-gradient(180deg,rgba(210,239,236,0.5),rgba(255,255,255,0));">
                <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#587578;font-weight:700;">Majestic</p>
                <h2 style="margin:0;font-size:26px;line-height:1.2;color:#1d3a3f;">Reservation confirmed</h2>
                <p style="margin:10px 0 0 0;font-size:15px;line-height:1.6;color:#587578;">Hi ${params.fullName}, your booking is locked in and ready.</p>
                ${bookedByOtherHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 10px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid rgba(190,222,217,0.85);border-radius:12px;background:#f9fefc;">
                  <tr>
                    <td style="padding:12px 14px;border-bottom:1px solid rgba(190,222,217,0.65);font-size:13px;color:#587578;width:38%;">Booked on</td>
                    <td style="padding:12px 14px;border-bottom:1px solid rgba(190,222,217,0.65);font-size:14px;color:#1d3a3f;font-weight:600;">${bookingDateLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;border-bottom:1px solid rgba(190,222,217,0.65);font-size:13px;color:#587578;">Check-in</td>
                    <td style="padding:12px 14px;border-bottom:1px solid rgba(190,222,217,0.65);font-size:14px;color:#1d3a3f;font-weight:600;">${startDateLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;border-bottom:1px solid rgba(190,222,217,0.65);font-size:13px;color:#587578;">Check-out</td>
                    <td style="padding:12px 14px;border-bottom:1px solid rgba(190,222,217,0.65);font-size:14px;color:#1d3a3f;font-weight:600;">${endDateLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;font-size:13px;color:#587578;">Duration</td>
                    <td style="padding:12px 14px;font-size:14px;color:#1d3a3f;font-weight:600;">${durationLabel}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 28px 28px;">
                <a href="${appUrl}/reservations" style="display:inline-block;background:#70b9cd;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:11px;border:1px solid #5a9aaf;">Open reservations</a>
                <p style="margin:16px 0 0 0;font-size:13px;line-height:1.6;color:#587578;">Need to make a change? Visit your reservations page in Majestic any time.</p>
              </td>
            </tr>
          </table>
        </div>
      `
    })
  });
}

export async function sendFeatureRequestStatusEmail(params: {
  email: string;
  fullName: string;
  title: string;
  status: "completed" | "rejected";
  appUrl?: string;
}): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return;
  }

  const appUrl = params.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const statusLabel = params.status === "completed" ? "Completed" : "Rejected";
  const statusColor = params.status === "completed" ? "#0f766e" : "#b91c1c";
  const statusBackground = params.status === "completed" ? "#ecfdf5" : "#fff1f2";
  const statusBorder = params.status === "completed" ? "#99f6e4" : "#fecdd3";
  const message =
    params.status === "completed"
      ? "Good news: this request is now complete and ready."
      : "This request has been reviewed and will not be implemented right now.";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.email],
      subject: `Feature request update: ${statusLabel}`,
      html: `
        <div style="margin:0;padding:30px 14px;background:radial-gradient(circle at 12% 0%,rgba(255,210,172,0.35),transparent 36%),radial-gradient(circle at 88% 2%,rgba(152,228,215,0.35),transparent 36%),linear-gradient(180deg,#ecf8f4 0%,#f7fcf9 58%);font-family:'Avenir Next','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1d3a3f;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto;background:#fffdfc;border:1px solid rgba(190,222,217,0.8);border-radius:16px;box-shadow:0 18px 38px rgba(62,116,121,0.12);overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 20px 28px;background:linear-gradient(180deg,rgba(210,239,236,0.5),rgba(255,255,255,0));">
                <p style="margin:0 0 10px 0;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:#587578;font-weight:700;">Majestic</p>
                <h2 style="margin:0;font-size:26px;line-height:1.2;color:#1d3a3f;">Feature request update</h2>
                <p style="margin:10px 0 0 0;font-size:15px;line-height:1.6;color:#587578;">Hi ${params.fullName}, ${message}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 10px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid rgba(190,222,217,0.85);border-radius:12px;background:#f9fefc;">
                  <tr>
                    <td style="padding:12px 14px;border-bottom:1px solid rgba(190,222,217,0.65);font-size:13px;color:#587578;width:38%;">Request</td>
                    <td style="padding:12px 14px;border-bottom:1px solid rgba(190,222,217,0.65);font-size:14px;color:#1d3a3f;font-weight:600;">${params.title}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;font-size:13px;color:#587578;">Status</td>
                    <td style="padding:12px 14px;">
                      <span style="display:inline-block;background:${statusBackground};color:${statusColor};border:1px solid ${statusBorder};border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">${statusLabel}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 28px 28px;">
                <a href="${appUrl}/feature-requests" style="display:inline-block;background:#70b9cd;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 18px;border-radius:11px;border:1px solid #5a9aaf;">Open requests</a>
              </td>
            </tr>
          </table>
        </div>
      `
    })
  });
}
