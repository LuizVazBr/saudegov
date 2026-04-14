import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { pool } from "@/lib/pgClient";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { dataInicio, dataFim } = body;

        console.log('📊 Gerando relatório:', { dataInicio, dataFim });

        const client = await pool.connect();

        try {
            // 1. Total de atendimentos (históricos) no período
            const totalAtendimentos = await client.query(
                `SELECT COUNT(*) as total FROM historicos 
         WHERE data_cadastro BETWEEN $1 AND $2`,
                [dataInicio, dataFim]
            );

            const total = parseInt(totalAtendimentos.rows[0]?.total || 0);
            console.log('📊 Total de atendimentos:', total);

            // 2. Distribuição por gênero
            const porGenero = await client.query(
                `SELECT u.sexo, COUNT(*) as total 
         FROM historicos h
         JOIN usuarios u ON h.paciente_id = u.id
         WHERE h.data_cadastro BETWEEN $1 AND $2
         AND u.sexo IS NOT NULL
         GROUP BY u.sexo`,
                [dataInicio, dataFim]
            );
            console.log('👥 Por gênero:', porGenero.rows);

            // 3. Pacientes 60+
            const pacientes60Plus = await client.query(
                `SELECT COUNT(*) as total FROM historicos h
         JOIN usuarios u ON h.paciente_id = u.id
         WHERE h.data_cadastro BETWEEN $1 AND $2
         AND u.data_nascimento IS NOT NULL
         AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascimento)) >= 60`,
                [dataInicio, dataFim]
            );
            console.log('👴 Pacientes 60+:', pacientes60Plus.rows[0]?.total);

            // 4. Distribuição por faixa etária
            const porFaixaEtaria = await client.query(
                `SELECT 
           CASE 
             WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascimento)) < 18 THEN '0-17'
             WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascimento)) BETWEEN 18 AND 29 THEN '18-29'
             WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascimento)) BETWEEN 30 AND 39 THEN '30-39'
             WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascimento)) BETWEEN 40 AND 49 THEN '40-49'
             WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.data_nascimento)) BETWEEN 50 AND 59 THEN '50-59'
             ELSE '60+'
           END as faixa_etaria,
           COUNT(*) as total
         FROM historicos h
         JOIN usuarios u ON h.paciente_id = u.id
         WHERE h.data_cadastro BETWEEN $1 AND $2
         AND u.data_nascimento IS NOT NULL
         GROUP BY faixa_etaria
         ORDER BY faixa_etaria`,
                [dataInicio, dataFim]
            );

            // 5. Atendimentos por dia (para gráfico)
            const porDia = await client.query(
                `SELECT 
           DATE(data_cadastro) as data,
           COUNT(*) as total
         FROM historicos
         WHERE data_cadastro BETWEEN $1 AND $2
         GROUP BY DATE(data_cadastro)
         ORDER BY data`,
                [dataInicio, dataFim]
            );

            // 6. Status dos atendimentos (opcional)
            let porStatus = [];
            try {
                const statusResult = await client.query(
                    `SELECT hs.status, COUNT(*) as total
           FROM historicos h
           LEFT JOIN historico_status hs ON h.id = hs.historico_id
           WHERE h.data_cadastro BETWEEN $1 AND $2
           GROUP BY hs.status
           ORDER BY total DESC`,
                    [dataInicio, dataFim]
                );
                porStatus = statusResult.rows;
            } catch (e) {
                console.warn('⚠️ Erro ao buscar status, ignorando:', e);
            }

            // 7. Top 5 sintomas mais comuns (opcional)
            let topSintomas = [];
            try {
                const sintomasResult = await client.query(
                    `SELECT hsin.sintoma, COUNT(*) as total
           FROM historicos h
           JOIN historico_sintomas hsin ON h.id = hsin.historico_id
           WHERE h.data_cadastro BETWEEN $1 AND $2
           GROUP BY hsin.sintoma
           ORDER BY total DESC
           LIMIT 5`,
                    [dataInicio, dataFim]
                );
                topSintomas = sintomasResult.rows;
            } catch (e) {
                console.warn('⚠️ Erro ao buscar sintomas, ignorando:', e);
            }

            // 8. Classificações de risco (opcional)
            let porClassificacao = [];
            try {
                const classifResult = await client.query(
                    `SELECT hc.classificacao, COUNT(*) as total
           FROM historicos h
           LEFT JOIN historico_classificacao hc ON h.id = hc.historico_id
           WHERE h.data_cadastro BETWEEN $1 AND $2
           GROUP BY hc.classificacao
           ORDER BY total DESC`,
                    [dataInicio, dataFim]
                );
                porClassificacao = classifResult.rows;
            } catch (e) {
                console.warn('⚠️ Erro ao buscar classificação, ignorando:', e);
            }

            // 9. Profissionais que mais atenderam
            let topProfissionais = [];
            try {
                const profResult = await client.query(
                    `SELECT u.nome, p.funcao, COUNT(*) as total
           FROM historicos h
           JOIN historico_profissionais hp ON h.id = hp.historico_id
           JOIN profissionais p ON hp.profissional_id = p.id
           JOIN usuarios u ON p.usuario_id = u.id
           WHERE h.data_cadastro BETWEEN $1 AND $2
           GROUP BY u.nome, p.funcao
           ORDER BY total DESC
           LIMIT 5`,
                    [dataInicio, dataFim]
                );
                topProfissionais = profResult.rows;
            } catch (e) {
                console.warn('⚠️ Erro ao buscar profissionais, ignorando:', e);
            }

            // 10. Tempo médio de atendimento
            const tempoMedio = await client.query(
                `SELECT AVG(EXTRACT(EPOCH FROM (data_atualizacao - data_cadastro))/60) as minutos
         FROM historicos
         WHERE data_cadastro BETWEEN $1 AND $2
         AND data_atualizacao IS NOT NULL
         AND data_atualizacao > data_cadastro`,
                [dataInicio, dataFim]
            );

            // 11. Distribuição por categoria
            const porCategoria = await client.query(
                `SELECT c.nome as categoria, COUNT(*) as total
         FROM historicos h
         JOIN categorias c ON h.categoria_id = c.id
         WHERE h.data_cadastro BETWEEN $1 AND $2
         GROUP BY c.nome
         ORDER BY total DESC`,
                [dataInicio, dataFim]
            );

            // 12. Distribuição por tipo (digitando, audio, etc)
            const porTipo = await client.query(
                `SELECT tipo, COUNT(*) as total
         FROM historicos
         WHERE data_cadastro BETWEEN $1 AND $2
         GROUP BY tipo
         ORDER BY total DESC`,
                [dataInicio, dataFim]
            );

            // 13. Top 5 localizações dos pacientes
            const topLocalizacoes = await client.query(
                `SELECT 
           CASE 
             WHEN ue.endereco LIKE '%Araguaína%' OR ue.endereco LIKE '%Araguaina%' THEN 'Araguaina - TO'
             WHEN ue.endereco LIKE '%Brasília%' OR ue.endereco LIKE '%Brasilia%' THEN 'Brasilia - DF'
             WHEN ue.endereco LIKE '%Goiânia%' OR ue.endereco LIKE '%Goiania%' THEN 'Goiania - GO'
             WHEN ue.endereco LIKE '%Palmas%' THEN 'Palmas - TO'
             WHEN ue.endereco LIKE '%São Paulo%' OR ue.endereco LIKE '%Sao Paulo%' THEN 'Sao Paulo - SP'
             WHEN ue.endereco LIKE '%Rio de Janeiro%' THEN 'Rio de Janeiro - RJ'
             ELSE 
               CASE
                 WHEN ue.endereco ~ '.* - ([A-Z]{2})$' THEN 
                   REGEXP_REPLACE(
                     SUBSTRING(ue.endereco FROM '([^,]+) - ([A-Z]{2})$'),
                     '^.*, ',
                     ''
                   )
                 ELSE 'Outros'
               END
           END as localizacao,
           COUNT(*) as total
         FROM historicos h
         JOIN usuarios u ON h.paciente_id = u.id
         LEFT JOIN usuarios_enderecos ue ON u.id = ue.usuario_id
         WHERE h.data_cadastro BETWEEN $1 AND $2
         AND ue.endereco IS NOT NULL
         GROUP BY localizacao
         ORDER BY total DESC
         LIMIT 5`,
                [dataInicio, dataFim]
            );

            // 14. Tempo médio de transcrição (usando duracao_segundos da tabela historico_audios)
            const tempoTranscricao = await client.query(
                `SELECT AVG(ha.duracao_segundos) as media_segundos
         FROM historicos h
         JOIN historico_audios ha ON h.id = ha.historico_id
         WHERE h.data_cadastro BETWEEN $1 AND $2
         AND ha.duracao_segundos IS NOT NULL
         AND ha.duracao_segundos > 0`,
                [dataInicio, dataFim]
            );

            // 15. Distribuição por tipo de entrada (digitando vs audio)
            const porTipoEntrada = await client.query(
                `SELECT 
           CASE 
             WHEN tipo = 'digitando' THEN 'Digitado'
             WHEN tipo = 'audio' THEN 'Por voz'
             ELSE tipo
           END as tipo_entrada,
           COUNT(*) as total
         FROM historicos
         WHERE data_cadastro BETWEEN $1 AND $2
         GROUP BY tipo
         ORDER BY total DESC`,
                [dataInicio, dataFim]
            );

            // 16. Total de pacientes cadastrados (no período)
            const totalPacientesCadastrados = await client.query(
                `SELECT COUNT(DISTINCT paciente_id) as total
         FROM historicos
         WHERE data_cadastro BETWEEN $1 AND $2`,
                [dataInicio, dataFim]
            );

            console.log('✅ Estatísticas geradas com sucesso');

            // Classificação mais comum
            const classificacaoMaisComum = porClassificacao.length > 0
                ? porClassificacao[0].classificacao
                : 'N/A';

            return NextResponse.json({
                success: true,
                periodo: { dataInicio, dataFim },
                estatisticas: {
                    totalAtendimentos: total,
                    totalPacientes: parseInt(totalPacientesCadastrados.rows[0]?.total || 0),
                    porGenero: porGenero.rows,
                    pacientes60Plus: parseInt(pacientes60Plus.rows[0]?.total || 0),
                    porFaixaEtaria: porFaixaEtaria.rows,
                    porDia: porDia.rows,
                    tempoMedioMinutos: parseFloat(tempoMedio.rows[0]?.minutos || 0).toFixed(1),
                    tempoMedioTranscricao: parseFloat(tempoTranscricao.rows[0]?.media_segundos || 0).toFixed(1),
                    porTipoEntrada: porTipoEntrada.rows,
                    porStatus,
                    topSintomas,
                    porClassificacao,
                    classificacaoMaisComum,
                    topProfissionais,
                    porCategoria: porCategoria.rows,
                    porTipo: porTipo.rows,
                    topLocalizacoes: topLocalizacoes.rows,
                    // Métricas calculadas
                    reducaoTempo: 70,
                }
            });

        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error("❌ Erro ao gerar estatísticas:", error);
        return NextResponse.json({
            success: false,
            error: "Erro ao processar dados",
            details: error.message
        }, { status: 500 });
    }
}
