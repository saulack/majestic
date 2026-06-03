import type { ChannelPreference, Reservation, UserProfile } from "@/lib/types";

type NotificationPayload = {
  user: UserProfile;
  reservation: Reservation;
  channel: ChannelPreference;
};

async function sendEmail(_payload: NotificationPayload): Promise<void> {
  // Wire SendGrid or Resend here.
  void _payload;
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
