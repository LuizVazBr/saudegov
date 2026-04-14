import { NextResponse } from "next/server";
import { addSubscription } from "@/lib/subscriptions";

export async function POST(req: Request) {
  const body = await req.json();
  const { pacienteId, subscription } = body;

  if (!pacienteId || !subscription) {
    return NextResponse.json({ ok: false, error: "Dados incompletos" }, { status: 400 });
  }

  await addSubscription(pacienteId, subscription);

  return NextResponse.json({ ok: true });
}
