import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.tipo_usuario?.toLowerCase();

  // Permissão: Medico, Enfermeiro ou Gestor
  if (!userRole || !["medico", "enfermeiro", "gestor"].includes(userRole)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const cpf = searchParams.get("cpf")?.replace(/\D/g, "");

  if (!cpf) {
    return NextResponse.json({ error: "CPF não fornecido" }, { status: 400 });
  }

  try {
    const client = await pool.connect();

    // 1. Buscar usuário/paciente pelo CPF
    const userRes = await client.query(
      "SELECT id, nome, documento, email, telefone, sexo, data_nascimento FROM usuarios WHERE REPLACE(REPLACE(documento, '.', ''), '-', '') = $1 LIMIT 1",
      [cpf]
    );

    if (userRes.rows.length === 0) {
      client.release();
      return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
    }

    const patient = userRes.rows[0];
    const patientId = patient.id;

    // 2. Buscar Histórico (Triagens/Relatos)
    // Usando a mesma lógica resiliente de busca de paciente no histórico
    const historyRes = await client.query(`
      SELECT 
        h.id, h.descricao, h.data_cadastro, 
        hc.classificacao,
        COALESCE(json_agg(hsint.sintoma ORDER BY hsint.id) FILTER (WHERE hsint.id IS NOT NULL), '[]') AS sintomas
      FROM historicos h
      LEFT JOIN historico_classificacao hc ON hc.historico_id = h.id
      LEFT JOIN historico_sintomas hsint ON hsint.historico_id = h.id
      WHERE (
        TRIM(h.paciente_id::text) = TRIM($1::text) OR 
        REPLACE(REPLACE(h.paciente_id::text, '.', ''), '-', '') = $2
      )
      GROUP BY h.id, hc.classificacao
      ORDER BY h.data_cadastro DESC
    `, [patientId, cpf]);

    // 3. Buscar Exames
    const examesRes = await client.query(
      "SELECT id, descricao, data_cadastro FROM exames WHERE usuario_id = $1 ORDER BY data_cadastro DESC",
      [patientId]
    );

    // 4. Buscar Tratamentos (Com Joins para Medicamentos e Instruções)
    const tratamentosRes = await client.query(`
      SELECT 
        t.id, 
        m.nome AS medicamento, 
        it.instrucao AS frequencia, 
        it.horario,
        t.data_cadastro 
      FROM tratamentos t
      LEFT JOIN medicamentos m ON t.medicamento_id = m.id
      LEFT JOIN instrucoes_tratamento it ON it.tratamento_id = t.id
      WHERE t.paciente_id = $1
      ORDER BY t.data_cadastro DESC
    `, [patientId]);

    // 5. Buscar Condições
    let condicoes = [];
    try {
      const condRes = await client.query(`
        SELECT c.id, ct.nome AS tipo, c.desde_quando, c.descricao
        FROM condicoes c
        JOIN condicoes_tipos ct ON c.condicao_tipo_id = ct.id
        WHERE c.usuario_id = $1
        ORDER BY c.desde_quando DESC
      `, [patientId]);
      condicoes = condRes.rows;
    } catch (e) {
      console.warn("Tabela condicoes não encontrada ou erro na query:", e);
    }

    client.release();

    // Estruturar dados para a TreeView
    return NextResponse.json({
      patient,
      history: historyRes.rows,
      exames: examesRes.rows,
      tratamentos: tratamentosRes.rows,
      condicoes
    });

  } catch (error: any) {
    console.error("Erro na API de árvore completa:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
