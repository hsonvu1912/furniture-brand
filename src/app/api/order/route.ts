// =============================================================================
// /api/order — nhận đơn hàng từ /design Configurator, forward sang Apps Script
// Webhook (deployment ID stored as KE_ORDER_WEBHOOK secret).
//
// Body shape (từ client):
//   { contact: { name, phone, email?, address?, note? },
//     preset:  { slug, name },
//     values:  ParamValues,
//     price:   { total },
//     cutlist: { totalPanels, totalWeightKg, ... } }
//
// Apps Script append row Sheet + email notify maume.decor@gmail.com.
// =============================================================================
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WEBHOOK_BASE = "https://script.google.com/macros/s/";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Validate min fields
    const contact = body.contact as { name?: string; phone?: string } | undefined;
    if (!contact?.name || !contact?.phone) {
      return NextResponse.json(
        { error: "Thiếu tên hoặc số điện thoại" },
        { status: 400 },
      );
    }

    // Lấy webhook ID từ secret
    const deploymentId = process.env.KE_ORDER_WEBHOOK;
    if (!deploymentId) {
      console.error("KE_ORDER_WEBHOOK secret chưa set");
      return NextResponse.json({ error: "Server config missing" }, { status: 500 });
    }
    const webhookUrl = WEBHOOK_BASE + deploymentId + "/exec";

    // Forward sang Apps Script. CF Worker fetch handles 302 redirects + POST preservation OK.
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "follow",
    });

    const text = await upstream.text();
    // Apps Script trả JSON content qua redirect. Cố parse, fallback text.
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text.slice(0, 500) };
    }

    if (!upstream.ok) {
      console.error("Apps Script error:", upstream.status, text.slice(0, 200));
      return NextResponse.json(
        { error: `Webhook fail (${upstream.status})`, detail: result },
        { status: 502 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Order API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
