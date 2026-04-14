import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function POST(req: Request) {
    try {
        const {
            pacienteId,
            profissionalId,
            descricao,
            medicamento,
            dosagem,
            quantidade,
            horario,
            duracao,
            nomeCondicao
        } = await req.json();

        if (!pacienteId) {
            return NextResponse.json({ error: "Dados insuficientes." }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            // 1. Resolve ou cria a condição baseada no nome
            let condicaoId: number | null = null;

            if (nomeCondicao) {
                // Busca o tipo de condição pelo nome
                const tipoRes = await client.query(
                    `SELECT id FROM condicoes_tipos WHERE LOWER(nome) ILIKE $1 LIMIT 1`,
                    [`%${nomeCondicao}%`]
                );

                let tipoId: number;
                if (tipoRes.rows.length > 0) {
                    tipoId = tipoRes.rows[0].id;
                } else {
                    // Cria o tipo de condição se não existir
                    const novoTipo = await client.query(
                        `INSERT INTO condicoes_tipos (nome) VALUES ($1) RETURNING id`,
                        [nomeCondicao]
                    );
                    tipoId = novoTipo.rows[0].id;
                }

                // Verifica se já existe uma condição desse tipo para esse paciente
                const condRes = await client.query(
                    `SELECT id FROM condicoes WHERE paciente_id::text = $1 AND condicao_tipo_id = $2 LIMIT 1`,
                    [pacienteId, tipoId]
                );

                if (condRes.rows.length > 0) {
                    condicaoId = condRes.rows[0].id;
                } else {
                    // Cria uma nova condição para o paciente
                    const novaCondRes = await client.query(
                        `INSERT INTO condicoes (paciente_id, condicao_tipo_id, descricao, data_cadastro) 
                         VALUES ($1, $2, $3, NOW()) RETURNING id`,
                        [pacienteId, tipoId, descricao || nomeCondicao]
                    );
                    condicaoId = novaCondRes.rows[0].id;
                }
            } else {
                // Fallback: criar condição genérica
                const tipoRes = await client.query(`SELECT id FROM condicoes_tipos LIMIT 1`);
                const tipoId = tipoRes.rows.length > 0 ? tipoRes.rows[0].id : 1;

                const novaCondRes = await client.query(
                    `INSERT INTO condicoes (paciente_id, condicao_tipo_id, descricao, data_cadastro) 
                     VALUES ($1, $2, $3, NOW()) RETURNING id`,
                    [pacienteId, tipoId, descricao || "Acompanhamento Geral"]
                );
                condicaoId = novaCondRes.rows[0].id;
            }

            // 2. Resolve medicamento_id se o medicamento existir
            let medicamentoId: string | null = null;
            if (medicamento) {
                const medRes = await client.query(
                    `SELECT id FROM medicamentos WHERE LOWER(nome) = LOWER($1) LIMIT 1`,
                    [medicamento]
                );
                if (medRes.rows.length > 0) {
                    medicamentoId = medRes.rows[0].id;
                }
            }

            // 3. Monta a descrição completa
            const partes: string[] = [];
            if (medicamento) partes.push(`Medicamento: ${medicamento}`);
            if (dosagem) partes.push(`Dosagem: ${dosagem}`);
            if (quantidade) partes.push(`Qtd: ${quantidade}`);
            if (horario) partes.push(`Horário: ${horario}`);
            if (duracao) partes.push(`Duração: ${duracao}`);
            if (descricao && descricao !== nomeCondicao) partes.push(descricao);
            const descricaoFinal = partes.join(" | ") || "Tratamento registrado durante consulta.";

            // 4. Verifica duplicidade
            const checkRes = await client.query(
                `SELECT id FROM tratamentos WHERE paciente_id::text = $1 AND condicao_id = $2 AND descricao = $3 LIMIT 1`,
                [pacienteId, condicaoId, descricaoFinal]
            );

            if (checkRes.rows.length > 0) {
                return NextResponse.json({ success: true, message: "Tratamento já registrado anteriormente." });
            }

            // 5. Insere o tratamento
            await client.query(
                `INSERT INTO tratamentos (
                    paciente_id, condicao_id, medicamento_id, medicamento, dosagem, 
                    descricao, status, profissional_id, horario, data_cadastro
                ) VALUES ($1, $2, $3, $4, $5, $6, 'ativo', $7, $8, NOW())`,
                [
                    pacienteId,
                    condicaoId,
                    medicamentoId,
                    medicamento || "",
                    dosagem || "",
                    descricaoFinal,
                    profissionalId || null,
                    horario || ""
                ]
            );

            return NextResponse.json({ success: true });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error("Erro ao salvar tratamento:", error);
        return NextResponse.json({ error: "Erro interno: " + (error?.message || "desconhecido") }, { status: 500 });
    }
}
