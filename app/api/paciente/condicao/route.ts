import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function POST(req: Request) {
    try {
        const { pacienteId, descricao, desdeQuando } = await req.json();

        if (!pacienteId || !descricao) {
            return NextResponse.json({ error: "Dados insuficientes." }, { status: 400 });
        }

        const client = await pool.connect();
        try {
            // 1. Descobre as colunas reais da tabela condicoes
            const colsRes = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'condicoes'
            `);
            const cols = colsRes.rows.map((r: any) => r.column_name);

            // 2. Resolve a coluna do paciente (usuario_id ou paciente_id)
            const pacientCol = cols.includes("usuario_id") ? "usuario_id" : cols.includes("paciente_id") ? "paciente_id" : null;
            if (!pacientCol) {
                throw new Error("Tabela condicoes não possui coluna de paciente.");
            }

            // 3. Lógica ANTI-DUPLICIDADE: verifica se já existe exatamente essa condição para o paciente
            const checkRes = await client.query(
                `SELECT id FROM condicoes WHERE ${pacientCol}::text = $1 AND descricao = $2`,
                [pacienteId, descricao]
            );

            if (checkRes.rows.length > 0) {
                return NextResponse.json({ success: true, message: "Condição já registrada anteriormente." });
            }

            const dateColInfo = colsRes.rows.find((r: any) => r.column_name === 'desde_quando');
            const isTipoMandatory = colsRes.rows.find((r: any) => r.column_name === 'condicao_tipo_id')?.is_nullable === 'NO';

            // Sanitize date
            let sanitizedDate = desdeQuando || null;
            if (sanitizedDate && dateColInfo?.data_type === 'date') {
                if (/^\d{4}$/.test(sanitizedDate)) sanitizedDate = `${sanitizedDate}-01-01`;
                const dateObj = new Date(sanitizedDate);
                if (isNaN(dateObj.getTime())) sanitizedDate = null;
            }

            let tipoId = null;
            if (isTipoMandatory) {
                const tipoRes = await client.query(`SELECT id FROM condicoes_tipos LIMIT 1`);
                tipoId = tipoRes.rows.length > 0 ? tipoRes.rows[0].id : 1;
            }

            const insertCols = [pacientCol, "descricao", "data_cadastro"];
            const params = [pacienteId, descricao];

            if (sanitizedDate) {
                insertCols.push("desde_quando");
                params.push(sanitizedDate);
            }

            if (tipoId !== null && cols.includes("condicao_tipo_id")) {
                insertCols.push("condicao_tipo_id");
                params.push(tipoId);
            }

            await client.query(
                `INSERT INTO condicoes (${insertCols.filter(c => c !== 'data_cadastro').join(", ")}, data_cadastro)
                 VALUES (${insertCols.map((_, i) => `$${i + 1}`).join(", ")}, NOW())`,
                params
            );

            return NextResponse.json({ success: true });
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error("Erro ao salvar condição:", error);
        return NextResponse.json({ error: "Erro interno: " + (error?.message || "desconhecido") }, { status: 500 });
    }
}
