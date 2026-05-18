export async function sendAppEmail({ to, subject, text }) {
  const providerUrl = process.env.EMAIL_WEBHOOK_URL;
  if (!providerUrl) {
    console.log(JSON.stringify({
      level: "info",
      event: "email.skipped",
      to,
      subject,
      reason: "EMAIL_WEBHOOK_URL is not configured",
    }));
    return { sent: false };
  }

  const response = await fetch(providerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.EMAIL_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ to, subject, text }),
  });

  return { sent: response.ok };
}
