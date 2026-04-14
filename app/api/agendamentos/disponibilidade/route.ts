
import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";

export async function GET(request: Request) {
  try {
    const client = await pool.connect();

    // Busca slots disponíveis com informações completas do médico
    const result = await client.query(`
      SELECT 
        dm.id as slot_id,
        dm.data_hora,
        u.nome as medico_nome,
        p.id as medico_id,
        p.especialidade,
        p.crm,
        p.estado_atuacao,
        p.foto
      FROM disponibilidade_medico dm
      JOIN profissionais p ON p.id = dm.medico_id
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE dm.data_hora > NOW()
      AND dm.disponivel = TRUE
      AND p.atende_telemedicina = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM agendamentos a 
        WHERE a.medico_id = p.id
        AND a.data_hora = dm.data_hora
        AND a.status != 'cancelado'
      )
      ORDER BY dm.data_hora ASC
    `);

    client.release();
    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error("Erro ao buscar disponibilidade:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
