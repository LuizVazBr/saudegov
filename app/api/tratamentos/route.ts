import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: Number(process.env.PG_PORT || 5432),
});

export async function GET(req: Request) {
  const userId = req.url.includes("usuario_id=")
    ? new URL(req.url).searchParams.get("usuario_id")
    : null;

  if (!userId) {
    return NextResponse.json({ error: "Usuário não informado" }, { status: 400 });
  }

  try {
    const client = await pool.connect();

    const res = await client.query(`
      SELECT 
        t.id, 
        ct.nome AS nome_condicao, 
        m.nome AS medicamento, 
        t.dosagem AS dosagem,
        it.instrucao, 
        it.horario, 
        it.tipo, 
        it.quantidade,
        ht.data_inicio AS historico_data_inicio
      FROM tratamentos t
      LEFT JOIN condicoes c ON t.condicao_id = c.id
      LEFT JOIN condicoes_tipos ct ON c.condicao_tipo_id = ct.id
      LEFT JOIN medicamentos m ON t.medicamento_id = m.id
      LEFT JOIN instrucoes_tratamento it ON it.tratamento_id = t.id
      LEFT JOIN historico_tratamentos ht ON ht.tratamento_id = t.id
      WHERE c.usuario_id = $1
      ORDER BY t.id, it.tipo DESC, it.horario
    `, [userId]);

    client.release();

    // Agrupar instruções por tratamento, sem duplicatas
    const tratamentosMap: Record<string, any> = {};
    res.rows.forEach(row => {
      if (!tratamentosMap[row.id]) {
        tratamentosMap[row.id] = {
          id: row.id,
          nome: row.nome_condicao,
          medicamento: row.medicamento,
          dosagem: row.dosagem,
          historico: row.historico_data_inicio ? { data_inicio: row.historico_data_inicio } : null,
          instrucoes: [],
        };
      }

      if (row.instrucao) {
        // Evitar duplicatas: mesma instrução e horário
        const exists = tratamentosMap[row.id].instrucoes.find(
          (i: any) =>
            i.instrucao === row.instrucao &&
            i.horario === (row.horario ? row.horario.slice(0,5) : null)
        );

        if (!exists) {
          tratamentosMap[row.id].instrucoes.push({
            instrucao: row.instrucao,
            horario: row.horario ? row.horario.slice(0,5) : null, // HH:MM
            tipo: row.tipo,
            quantidade: row.quantidade || 1,
          });
        }
      }
    });

    return NextResponse.json(Object.values(tratamentosMap));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao buscar tratamentos" }, { status: 500 });
  }
}
