export const config = { runtime: "edge" };

export default async function handler() {
  const hasKey = !!process.env.RESEND_API_KEY;
  return new Response(
    JSON.stringify({ ok: true, resend_key_present: hasKey }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
