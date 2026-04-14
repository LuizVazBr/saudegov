
import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function GET() {
    try {
        const client = await pool.connect();

        // 1. Tabela de Disponibilidade Médica (Slots)
        await client.query(`
      CREATE TABLE IF NOT EXISTS disponibilidade_medico (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        medico_id UUID NOT NULL, -- Refere-se a usuarios.id
        data_hora TIMESTAMP NOT NULL,
        disponivel BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

        // 2. Tabela de Agendamentos
        await client.query(`
      CREATE TABLE IF NOT EXISTS agendamentos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paciente_id UUID NOT NULL, -- Refere-se a usuarios.id
        medico_id UUID NOT NULL,
        data_hora TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'agendado', -- agendado, cancelado, realizado
        link_sala VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

        // 3. Inserir alguns dados de exemplo (slots) para testes se vazio
        const checkSlots = await client.query("SELECT count(*) FROM disponibilidade_medico");
        if (parseInt(checkSlots.rows[0].count) === 0) {
            // Tenta pegar um medico existente ou cria um ID ficticio se nao tiver
            // Pega o primeiro usuario tipo 'medico' ou 'admin' para associar
            const medicoRes = await client.query("SELECT id FROM usuarios WHERE tipo_usuario IN ('medico', 'admin', 'gestor') LIMIT 1");
            let medicoId = medicoRes.rows[0]?.id;

            // Se não tiver médico, não insere slots automaticos para evitar erro de FK inexistente (embora não defini FK explicita no script acima para simplicidade, mas é bom ter um ID valido)
            // Como o user falou "tenho tabela de médicos", vou assumir que usuarios com tipo_usuario=medico existem ou vou usar um UUID placeholder se permitir.
            // Mas o melhor é deixar vazio se n achou.

            if (medicoId) {
                // Cria slots para hoje e amanhã
                const hoje = new Date();
                hoje.setHours(14, 0, 0, 0); // 14:00 hoje

                await client.query(`
                INSERT INTO disponibilidade_medico (medico_id, data_hora) VALUES 
                ($1, $2),
                ($1, $3),
                ($1, $4)
            `, [
                    medicoId,
                    new Date(hoje.getTime()), // 14:00
                    new Date(hoje.getTime() + 3600000), // 15:00
                    new Date(hoje.getTime() + 86400000) // 14:00 amanhã
                ]);
            }
        }

        client.release();
        return NextResponse.json({ success: true, message: "Tabelas de telemedicina verificadas/criadas." });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
