import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const pacienteId = searchParams.get("pacienteId");

    if (!pacienteId) {
        return NextResponse.json({ error: "pacienteId não informado" }, { status: 400 });
    }

    try {
        const client = await pool.connect();

        try {
            // ── Informações Básicas do Paciente (Join Hiper-Resiliente) ─────────────────────────────
            const userRes = await client.query(
                `SELECT nome, email, data_nascimento 
                 FROM usuarios 
                 WHERE 
                    TRIM(id::text) = TRIM($1) OR 
                    REPLACE(REPLACE(documento, '.', ''), '-', '') = REPLACE(REPLACE($1, '.', ''), '-', '') OR
                    LOWER(TRIM(email)) = LOWER(TRIM($1)) OR
                    LOWER(TRIM(nome)) = LOWER(TRIM($1))
                 LIMIT 1`,
                [pacienteId]
            );
            const usuario = userRes.rows[0] || {};

            let idade: number | null = null;
            if (usuario.data_nascimento) {
                const diff = Date.now() - new Date(usuario.data_nascimento).getTime();
                idade = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
            }

            // ── Histórico completo (todas as triagens do paciente) ────────────
            const historicoRes = await client.query(`
                SELECT
                    h.id,
                    h.descricao,
                    h.tipo,
                    h.data_cadastro,
                    hc.classificacao,
                    COALESCE(
                        json_agg(hs.sintoma) FILTER (WHERE hs.id IS NOT NULL), '[]'
                    ) AS sintomas
                FROM historicos h
                LEFT JOIN historico_classificacao hc ON hc.historico_id = h.id
                LEFT JOIN historico_sintomas hs ON hs.historico_id = h.id
                WHERE h.paciente_id::text = $1
                GROUP BY h.id, h.descricao, h.tipo, h.data_cadastro, hc.classificacao
                ORDER BY h.data_cadastro DESC
            `, [pacienteId]);

            const historicos = historicoRes.rows;
            const maisRecente = historicos[0] || null;

            // Todos os sintomas únicos agregados de todas as triagens
            const todosSintomas: string[] = Array.from(new Set(
                historicos.flatMap((h: any) => Array.isArray(h.sintomas) ? h.sintomas : []).filter(Boolean)
            ));

            // ── Condições (comorbidades) ────────────────────────────────────
            const condicoesRes = await client.query(
                `SELECT id, descricao, desde_quando, data_cadastro
                 FROM condicoes WHERE usuario_id::text = $1
                 ORDER BY data_cadastro DESC`,
                [pacienteId]
            );

            // ── Tratamentos ─────────────────────────────────────────────────
            let tratamentos: any[] = [];
            try {
                const tratamentosRes = await client.query(
                    `SELECT id, descricao, medicamento, dosagem, duracao, horario, data_cadastro
                     FROM tratamentos WHERE paciente_id::text = $1
                     ORDER BY data_cadastro DESC`,
                    [pacienteId]
                );
                tratamentos = tratamentosRes.rows;
            } catch {
                // tabela pode não existir ainda — ignora silenciosamente
            }

            return NextResponse.json({
                nome: usuario.nome || "Não informado",
                email: usuario.email || null,
                idade,
                classificacao_risco: maisRecente?.classificacao || "Não classificado",
                descricao_recente: maisRecente?.descricao || null,
                tipo_recente: maisRecente?.tipo || null,
                data_recente: maisRecente?.data_cadastro || null,
                sintomas_recentes: todosSintomas,
                historicos,
                exames_anexados: [],
                condicoes_cronicas: condicoesRes.rows,
                tratamentos_ativos: tratamentos
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("Erro ao buscar resumo do paciente:", error);
        return NextResponse.json({ error: "Erro ao buscar resumo" }, { status: 500 });
    }
}
