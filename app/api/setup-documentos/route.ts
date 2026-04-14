import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function GET() {
    try {
        const client = await pool.connect();

        // 1. Tabela de Medicamentos corrigida para o schema do usuário
        await client.query(`
            CREATE TABLE IF NOT EXISTS medicamentos (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                nome VARCHAR(255) NOT NULL,
                dosagem VARCHAR(100),
                principio_ativo VARCHAR(255),
                fabricante VARCHAR(255),
                descricao TEXT,
                data_cadastro TIMESTAMP DEFAULT NOW(),
                ativo BOOLEAN DEFAULT TRUE
            );
        `);

        // 2. Tabela de Medicamentos x Condições
        await client.query(`
            CREATE TABLE IF NOT EXISTS medicamentos_condicoes (
                medicamento_id UUID NOT NULL,
                condicao_id INT NOT NULL,
                descricao TEXT,
                PRIMARY KEY (medicamento_id, condicao_id)
            );
        `);

        // 3. Tabela de Configuração de Unidades (Branding)
        // Usamos TEXT para unidade_id para aceitar tanto UUID quanto Inteiro (Serial)
        await client.query(`DROP TABLE IF EXISTS unidades_config CASCADE;`);
        await client.query(`
            CREATE TABLE IF NOT EXISTS unidades_config (
                id SERIAL PRIMARY KEY,
                unidade_id TEXT NOT NULL UNIQUE,
                cabecalho_logo TEXT,
                cabecalho_html TEXT,
                rodape_logo TEXT,
                rodape_html TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 4. Tabela de Assinaturas Médicas
        await client.query(`
            CREATE TABLE IF NOT EXISTS medico_assinaturas (
                id SERIAL PRIMARY KEY,
                medico_id TEXT NOT NULL UNIQUE,
                assinatura_url TEXT,
                carimbo_url TEXT,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Adiciona colunas se não existirem
        await client.query(`ALTER TABLE medico_assinaturas ADD COLUMN IF NOT EXISTS assinatura_tipo VARCHAR(20);`);
        await client.query(`ALTER TABLE medico_assinaturas ADD COLUMN IF NOT EXISTS assinatura_config JSONB;`);

        // 5. Seed de Medicamentos (Exemplos comuns com dosagem)
        const commonMeds = [
            ['Amoxicilina', '500mg'],
            ['Dipirona', '500mg'],
            ['Paracetamol', '750mg'],
            ['Ibuprofeno', '600mg'],
            ['Nimesulida', '100mg'],
            ['Metformina', '500mg'],
            ['Losartana', '50mg'],
            ['Omeprazol', '20mg'],
            ['Pantoprazol', '40mg'],
            ['Loratadina', '10mg'],
            ['Prednisona', '20mg']
        ];

        for (const [nome, dosagem] of commonMeds) {
            const check = await client.query("SELECT id FROM medicamentos WHERE nome = $1 AND dosagem = $2", [nome, dosagem]);
            if (check.rows.length === 0) {
                await client.query(
                    `INSERT INTO medicamentos (nome, dosagem, ativo) VALUES ($1, $2, true)`,
                    [nome, dosagem]
                );
            }
        }

        // 6. Seed opcional para teste de Unidade e Assinatura (se estiverem vazios)
        const unitExist = await client.query("SELECT count(*) FROM unidades_config");
        if (parseInt(unitExist.rows[0].count) === 0) {
            const units = await client.query("SELECT id FROM unidades LIMIT 1");
            if (units.rows.length > 0) {
                await client.query(
                    `INSERT INTO unidades_config (unidade_id, cabecalho_html, rodape_html) 
                     VALUES ($1, $2, $3)`,
                    [units.rows[0].id, '<strong>UNIDADE DE SAÚDE</strong><br/>Telemedicina Integrada', 'Emitido via Anamnex v2.0']
                );
            }
        }

        const sigExist = await client.query("SELECT count(*) FROM medico_assinaturas");
        if (parseInt(sigExist.rows[0].count) === 0) {
            // Busca um profissional que seja médico para o seed de exemplo
            const medicos = await client.query("SELECT id FROM usuarios WHERE tipo_usuario = 'medico' LIMIT 1");
            if (medicos.rows.length > 0) {
                await client.query(
                    `INSERT INTO medico_assinaturas (medico_id, assinatura_url) VALUES ($1, $2)`,
                    [medicos.rows[0].id, 'https://raw.githubusercontent.com/Anamnex/assets/main/assinatura-mock.png']
                );
            }
        }

        client.release();
        return NextResponse.json({
            success: true,
            message: "Tabelas sincronizadas com o schema do usuário!"
        });
    } catch (error: any) {
        console.error("Setup error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
