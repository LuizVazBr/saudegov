import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { invalidateTriageCache } from "@/lib/redis";

export async function POST(req: Request) {
  const client = await pool.connect();

  try {
    const { qrValue } = await req.json(); // valor lido do QR

    // Buscar histórico pelo QR lido (assumindo que QR = historico.id)
    const histRes = await client.query<{ id: string }>(
      "SELECT id FROM historicos WHERE id = $1",
      [qrValue]
    );

    if ((histRes?.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Histórico não encontrado" }, { status: 404 });
    }

    const historicoId = histRes.rows[0].id;

    // Verificar se já existe check-in
    const checkRes = await client.query<{ id: string }>(
      "SELECT id FROM historico_status WHERE historico_id = $1 AND status = 'checkin'",
      [historicoId]
    );

    if ((checkRes?.rowCount ?? 0) > 0) {
      return NextResponse.json({ message: "Check-in já realizado", historicoId });
    }

    // Inserir novo status check-in
    await client.query(
      "INSERT INTO historico_status (historico_id, status, data_cadastro) VALUES ($1, $2, NOW())",
      [historicoId, "checkin"]
    );

    // Invalida o cache para o gestor
    await invalidateTriageCache();

    return NextResponse.json({ message: "Check-in realizado", historicoId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao realizar check-in" }, { status: 500 });
  } finally {
    client.release();
  }
}
