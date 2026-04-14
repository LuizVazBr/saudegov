import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export const dynamic = "force-dynamic";

// GET /api/setup-termos
// Rota de setup único — cria a tabela termos_aceite se não existir
export async function GET() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS termos_aceite (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL DEFAULT 'telemedicina',
        aceito_em TIMESTAMP NOT NULL DEFAULT NOW(),
        ip VARCHAR(45),
        user_agent TEXT
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS termos_aceite_paciente_tipo_unique
        ON termos_aceite(paciente_id, tipo);
    `);
    return NextResponse.json({ success: true, message: "Tabela termos_aceite criada/verificada com sucesso." });
  } catch (error: any) {
    console.error("Erro no setup:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
