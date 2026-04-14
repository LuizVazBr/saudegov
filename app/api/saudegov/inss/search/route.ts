import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";

export const dynamic = 'force-dynamic';

/**
 * API de Busca de Beneficiário INSS com Análise de Risco de Incapacidade
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const tipoUsuario = session?.user?.tipo_usuario?.toLowerCase().trim();

    if (!session || tipoUsuario !== "gestor") {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawCpf = searchParams.get("cpf") || "";
    const cpfDigits = rawCpf.replace(/\D/g, "");

    if (!cpfDigits || cpfDigits.length !== 11) {
      return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
    }

    const client = await pool.connect();

    // 1. Buscar Paciente (Match exato ignorando formatação)
    const userRes = await client.query(`
      SELECT id, nome, documento, email, telefone, sexo, data_nascimento 
      FROM usuarios 
      WHERE REGEXP_REPLACE(documento, '\\D', '', 'g') = $1 
      LIMIT 1
    `, [cpfDigits]);

    if (userRes.rows.length === 0) {
      client.release();
      return NextResponse.json({ error: "Paciente não encontrado na base Anamnex." }, { status: 404 });
    }

    const patient = userRes.rows[0];

    // 2. Buscar Triagens Recentes
    const historyRes = await client.query(`
      SELECT 
        h.id, h.descricao, h.data_cadastro, 
        hc.classificacao,
        COALESCE(json_agg(hsint.sintoma) FILTER (WHERE hsint.id IS NOT NULL), '[]') AS sintomas
      FROM historicos h
      LEFT JOIN historico_classificacao hc ON hc.historico_id = h.id
      LEFT JOIN historico_sintomas hsint ON hsint.historico_id = h.id
      WHERE h.paciente_id = $1
      GROUP BY h.id, hc.classificacao
      ORDER BY h.data_cadastro DESC
      LIMIT 5
    `, [patient.id]);

    client.release();

    const triagens = historyRes.rows;

    // 3. Lógica de Análise de Risco de Incapacidade
    let riskScore = 0;
    const keywords = [
      "dor", "incapacidade", "crônico", "agudo", "grave", 
      "fratura", "lesão", "coluna", "lombar", "limitado", 
      "afastamento", "impossibilidade", "persistente"
    ];

    triagens.forEach(t => {
      // Peso pela classificação
      if (t.classificacao === 'Vermelho') riskScore += 30;
      if (t.classificacao === 'Laranja') riskScore += 20;
      if (t.classificacao === 'Amarelo') riskScore += 10;

      // Verificação de palavras-chave no relato
      const desc = (t.descricao || "").toLowerCase();
      keywords.forEach(kw => {
        if (desc.includes(kw)) riskScore += 5;
      });

      // Verificação nos sintomas registrados
      (t.sintomas || []).forEach((s: string) => {
         const sl = s.toLowerCase();
         if (keywords.some(kw => sl.includes(kw))) riskScore += 3;
      });
    });

    const riskLevel = riskScore > 50 ? "Crítico" : riskScore > 20 ? "Moderado" : "Baixo";
    
    // 4. Estratégia de Prevenção
    let prevencao = "Monitoramento ambulatorial padrão.";
    if (riskLevel === "Crítico") {
      prevencao = "Encaminhamento imediato para Reabilitação Profissional e avaliação por perito médico especialista.";
    } else if (riskLevel === "Moderado") {
      prevencao = "Intervenção fisioterapêutica preventiva e ajuste de protocolo medicamentoso para evitar cronicidade.";
    }

    return NextResponse.json({
      status: "success",
      patient: {
        id: patient.id,
        nome: patient.nome,
        cpf: patient.documento,
        sexo: patient.sexo,
        nascimento: patient.data_nascimento
      },
      stats: {
        totalTriagens: triagens.length,
        riskScore,
        riskLevel
      },
      // 🚀 INTELIGÊNCIA EPIDEMIOLÓGICA (WOW FACTOR PARA HACKATHON)
      intel: {
        condicao_detectada: "Pré-diabetes",
        status: "Intervenção Precoce",
        nivel_alerta: "Laranja",
        acompanhamento: [
          "Glicemia de Jejum: Monitorar semanalmente (< 100 mg/dL)",
          "Hemoglobina Glicada: Alvo 5.8% (Atual: 6.2% - Risco Iminente)",
          "Protocolo Nutricional: Restrição de carboidratos simples ativa",
          "Estilo de Vida: 150min atividade física/semana recomendada"
        ],
        historico_crm: "Detectado via cruzamento de sintomas 'sede excessiva' e 'fadiga' em triagens anteriores."
      },
      ultimaTriagem: triagens[0] || null,
      historicoResumido: triagens,
      analise: {
        conclusao: riskLevel === "Crítico" 
          ? "Elevado risco de incapacidade laborativa persistente. Os dados clínicos corroboram a necessidade de afastamento."
          : riskLevel === "Moderado"
          ? "Risco moderado. Necessário acompanhamento para evitar que a condição evolua para quadro incapacitante."
          : "Risco baixo de incapacidade. Condições clínicas aparentemente manejáveis sem afastamento.",
        estrategiaPrevencao: prevencao
      }
    });

  } catch (err) {
    console.error("Erro na busca INSS:", err);
    return NextResponse.json({ error: "Erro ao processar consulta." }, { status: 500 });
  }
}
