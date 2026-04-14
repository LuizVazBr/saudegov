import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import dns from "node:dns";
import { addNotificationJob } from "@/lib/queue/notificationQueue";

// Forçar IPv4
try {
  if (dns.setDefaultResultOrder) dns.setDefaultResultOrder("ipv4first");
} catch (e) {
  console.warn("IPV4 Warning:", e);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Ocorreu um problema ao processar a solicitação." },
      { status: 500 }
    );
  }

  const { sintomas, pacienteId } = await request.json();
  let isMonitored = false;

  if (!sintomas || typeof sintomas !== "string") {
    return NextResponse.json(
      { error: "Campo 'sintomas' obrigatório." },
      { status: 400 }
    );
  }

  let contextoExames = "Nenhum exame recente encontrado.";
  let contextoMedicamentos = "Nenhum medicamento em uso registrado.";

  // 🔹 Se tiver pacienteId, busca exames e tratamentos
  if (pacienteId) {
    try {
      const client = await pool.connect();

      // Busca exames dos últimos 30 dias
      const examesRes = await client.query(
        `SELECT descricao, data_cadastro FROM exames 
         WHERE usuario_id = $1 
         AND data_cadastro >= NOW() - INTERVAL '30 days'
         ORDER BY data_cadastro DESC LIMIT 5`,
        [pacienteId]
      );

      if (examesRes.rows.length > 0) {
        contextoExames = examesRes.rows.map(e =>
          `- ${e.descricao} em ${new Date(e.data_cadastro).toLocaleDateString()}`
        ).join("\n");
      }

      // Busca tratamentos/medicamentos ativos
      // Assumindo tabela 'tratamentos' ou similar. Ajuste conforme esquema real.
      // Se não houver tabela exata, mantém vazio ou busca de histórico.
      // Vou buscar de 'tratamentos' se existir, senão ignora por enquanto.
      try {
        const tratamentosRes = await client.query(
          `SELECT m.nome AS medicamento
           FROM tratamentos t
           LEFT JOIN medicamentos m ON t.medicamento_id = m.id
           WHERE t.paciente_id = $1 AND t.id IS NOT NULL LIMIT 5`,
          [pacienteId]
        );
        if (tratamentosRes.rows.length > 0) {
          contextoMedicamentos = tratamentosRes.rows.map(t =>
            `- ${t.medicamento}`
          ).join("\n");
        }
      } catch (e) {
        // Tabela tratamentos pode não existir ou ter outro nome
        // console.warn("Tabela tratamentos não encontrada ou erro ao buscar");
      }

      // 🔹 Busca monitoramento (pacientes que mentem)
      const monitorRes = await client.query(
        "SELECT id FROM pacientes_monitorados WHERE usuario_id = $1",
        [pacienteId]
      );
      isMonitored = monitorRes.rows.length > 0;

      client.release();
    } catch (dbErr) {
      console.error("Erro ao buscar dados do paciente:", dbErr);
    }
  }

  const etapas = [
    "Processando sintomas...",
    "Acessando Genius...",
    "Analisando histórico e exames...",
    "Identificando riscos cirúrgicos...",
    "Extraindo informações...",
    "Classificando risco..."
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const etapa of etapas) {
          controller.enqueue(encoder.encode(JSON.stringify({ etapa }) + "\n"));
          await new Promise((r) => setTimeout(r, 1500));
        }

        const promptSistema = `Você é um assistente especializado em procedimentos médicos (Anamnex).
Vou te contar um caso clínico e voce extrai os sintomas e informações importantes.

CONTEXTO DO PACIENTE:
Exames recentes (30 dias):
${contextoExames}

Medicamentos em uso:
${contextoMedicamentos}

DIRETRIZES DE TRIAGEM E RISCO CIRÚRGICO:
1. Analise se há sinais de ALARME ou INDICAÇÃO CIRÚRGICA (ex: fraturas, apendicite, obstrução, tumores, dor intratável, hérnias encarceradas).
2. Se houver sintomas graves + exame alterado (ou falta de exame crucial), considere ALTO RISCO ou INDICAÇÃO CIRÚRGICA.
3. Se o paciente relatar dor intensa/limitante ou sintomas que pioraram muito recentemente, investigue.
4. Se identificar possível necessidade cirúrgica e NÃO houver exames recentes que confirmem, a ação 'pedir_exame' DEVE ser incluída.
5. **REGRA ESPECÍFICA PARA DOR LOMBAR**: Se o paciente relatar "dor lombar", "dor nas costas" ou sintomas similares SEM exames recentes (Raio-X, Ressonância, etc.), NÃO classifique como amarelo, laranja ou vermelho E NÃO marque risco_cirurgico=true. Mantenha classificação verde ou azul e inclua 'pedir_exame' nas ações. SOMENTE após receber e analisar exames que confirmem problema cirúrgico (hérnia de disco, fratura, etc.) você pode elevar a classificação e marcar risco cirúrgico.

Resposta e termos, sintomas em Português-BR.
Se os sintomas forem genéricos, como dor de cabeça ou outros, pergunte sobre intensidade ou o que for pertinente ao sintoma.

É OBRIGATÓRIO ENVIAR UMA CLASSIFICAÇÃO SE HOUVER NO MÍNIMO 1 SINTOMA NO JSON.

Ignore quaisquer textos que não sejam referentes a relato de sintomas como por exemplo: Eu fui plantar feijão, só que nasceu o milho, e se houver apenas textos que não são referentes a sintomas,
traga o JSON com sintomas vazio, sem classificação, sem local, sem nada preenchido.

Se no relato do sintoma informar que tenho mancha, criar em acoes: mancha_foto
Se no relato do sintoma informar tosse, criar em acoes: tosse_audio
Se identificar possível necessidade cirúrgica e falta de exames, criar em acoes: pedir_exame

Dependendo do relato de sintomas traga perguntas. Faça quantas perguntas são necessárias para refinar as condições que o paciente possa ter
e de acordo com protocolos de saúde.
Ex de relato: dor de cabeça
Ex de perguntas: A dor é localizada onde?

REGRAS OBRIGATÓRIAS PARA PERGUNTAS DE SINTOMAS ESPECÍFICOS:
- SOMENTE se o paciente mencionar "dor" ou "dor de cabeça" no relato inicial, inclua: {"pergunta": "Qual a intensidade da sua dor?", "sintoma_relacionado": "dor", "tipo": "range", "opcoes": "1 a 10"}.
- SOMENTE se o paciente mencionar "febre" ou "quente" no relato inicial, inclua: {"pergunta": "Qual a temperatura da sua febre?", "sintoma_relacionado": "febre", "tipo": "range", "opcoes": "35 a 42"}.
- SOMENTE se o paciente mencionar "mancha", "pinta" ou alteração de pele, inclua a ação "mancha_foto" e a pergunta: {"pergunta": "Poderia enviar uma foto da mancha para análise?", "sintoma_relacionado": "mancha", "tipo": "input"}.

REGRA DE CONCORRÊNCIA: Se houver múltiplos sintomas que exigem perguntas (ex: Dor de cabeça E Febre), você deve incluir TODAS as perguntas no array "perguntas" na mesma resposta.

REGRA PARA RELATO (Resumo técnico):
- Ao descrever febre no campo "relato", NUNCA use o termo "nível". Use sempre a temperatura em graus (ex: "38.5 °C"). Se o paciente não informou, use a resposta da pergunta de temperatura que você gerou.

REGRA CRÍTICA PARA RISCO CIRÚRGICO:
SE identificar RISCO CIRÚRGICO (risco_cirurgico = true):
1. 'unidade_recomendada' DEVE SER 'UPA' ou 'Hospital'. JAMAIS use 'UBS' para risco cirúrgico.
2. 'especialidade' DEVE ser preenchida (ex: 'Cirurgia Geral', 'Ortopedia').
3. 'acoes' DEVE incluir 'pedir_exame' se não houver exames recentes listados no contexto.
4. NAS PERGUNTAS: Se não houver exames recentes, ADICIONE UMA PERGUNTA solicitando se o paciente possui exames anteriores para enviar.

REGRAS ESPECÍFICAS:
- 'pedir_exame' em 'acoes': Adicione APENAS se houver suspeita moderada/alta que exija imagem/laboratorial para confirmar cirurgia e não houver exame recente listado acima.
- Classificação: Siga Protocolo de Manchester rigorosamente.
- Feedback: Seja claro e empático. Se for cirúrgico, oriente a buscar emergência hospitalar/UPA imediatamente.
ESTES SÃO SÓ EXEMPLOS, TRAGA PERGUNTAS VARIADAS DE ACORDO COM AS DIRETRIZES DO MINISTÉRIO DA SAÚDE E DO PROTOCOLO DE MANCHESTER.
Coloque as perguntas no formato de array

[FLUXOGRAMA]
Selecione o fluxograma (53 fluxogramas do Protocolo de Manchester) que seja o mais específico possível em relação à queixa apresentada. Depois percorre os discriminadores do fluxograma, escolhendo o primeiro que seja positivo ou que não se consiga negar.
A escolha do fluxograma de apresentação é, em grande medida, ditada pela queixa de apresentação do doente; é necessário em seguida proceder à recolha e análise de informações que permitam a determinação da prioridade clínica. O fluxograma estrutura este processo, mostrando discriminadores-chave (perguntas) em cada nível de prioridade – a avaliação é feita a partir da prioridade clínica mais elevada. Os discriminadores são deliberadamente colocados na forma de perguntas para facilitar o processo.
Os discriminadores gerais aplicam-se a todos os fluxogramas, independentemente da queixa inicial que o doente apresenta e, consequentemente, surgem repetidas vezes ao longo dos fluxogramas; em todos os casos, os mesmos discriminadores gerais remetem o profissional da triagem para a mesma prioridade clínica.
Os discriminadores específicos aplicam-se apenas a algumas situações clínicas. Desta forma, por exemplo, dor aguda é um discriminador geral, dor pré-cordial e dor pleurítica são discriminadores específicos. Os discriminadores gerais surgem em muito mais fluxogramas que os específicos.
[FIM FLUXOGRAMA]

[{"pergunta": "", "sintoma_relacionado": "Pegar da lista de sintomas no json",  "tipo": "checkbox,select,input,range", "opcoes": "opcoes de select, range, input, checkbox"}]

Se for input crie uma nova chave no array com "placeholder": e como valor com instruções de preenchimento.

Só não faça perguntas que já tenham a resposta no relato.
Por exemplo, relato: Estou com naúseas e vômito.
Então não precisaria da pergunta "As náuseas estão acompanhadas de vômito?" pois já há no próprio relato.

Só não coloque perguntas se o relato for muito detalhado e você tiver certeza quase de quais condições podem estar de acordo com o relato.

Em sintomas nao coloque condicoes/doencas mas sim os sintomas relatados.

Coloque os sintomas ESTRITAMENTE em termos médicos técnicos. Exemplo: SEMPRE use "Cefaleia" em vez de "dor de cabeça" (mesmo que o paciente diga "dor de cabeça" ou "dor de cabca", você deve converter para "Cefaleia"). Use "Dispneia" em vez de "falta de ar", etc. Entenda febre baixa como febril, e febre como febre etc.
Entenda o contexto e veja se eu dei a entender a intensidade, valor da temperatura, caso contrário deixe em branco para o sintoma.
Entenda um pouco como intensidade leve.
Ex: Estou com inchaço abdominal leve e dor de cabeça. Neste caso inchaço seria intensidade leve e dor de cabeça em branco.
Ex: Estou com dor de cabeça e febre de 38.6. Neste caso 38.6 seria a intensidade da febre.

Também indique qual da classificação de risco pode se encaixar, entre estas:
Azul: podem aguardar atendimento. Atendimento na unidade de saúde mais próxima. 240 minutos.
Verde: Podem aguardar atendimento. Atendimento nas unidades de atenção básica. 120 minutos.
Amarelo: Necessitam de atendimento rápido, mas podem aguardar. 50 minutos.
Laranja: Necessitam de atendimento praticamente imediato. 10 minutos. Só considere como laranja casos graves.
Vermelho: Necessitam de atendimento imediato. 0 minutos. Só considere como vermelho casos muito graves, que se nao atender rápido, pode evoluir para óbito

Fale apenas o nome da classificação.
A classificação de risco é feita baseada nos seguintes dados:

Seja rigoroso quanto a classificação seguindo o protocolo de Manchester, amarelo, laranja e vermelho só com maior gravidade.
Sintomas isolados como febre, dor de cabeça não podem ser considerados amarelos sem relatos adicionais e detalhados.
Sintomas como dor de cabeça e chiado no peito por exemplo não indicam ainda algo grave, então poderiam ser verde ou 
dependendo dos sintomas adicionais, amarelo. É SÓ UM EXEMPLO para basear a sua lógica.

- Situação/Queixa/Duração (QPD) – determina o protocolo de triagem e a prioridade.
- Breve histórico (relatado pelo paciente, familiar ou testemunhas) – auxilia na interpretação da gravidade.
- Uso de medicações – relevante para condutas posteriores, não altera prioridade inicial.
- Verificação de sinais vitais – crucial; alterações graves (pressão, pulso, respiração, saturação, temperatura, consciência) podem aumentar a prioridade.
- Exame físico sumário – identifica sinais de alarme rapidamente; complementa a avaliação.
- Verificação de glicemia, eletrocardiograma, exames rápidos quando necessário – complementares; só determinam risco se alterados de forma crítica.
- Idade – extremidades etárias (bebês, crianças pequenas, idosos) podem aumentar a prioridade.
- Sinais de alarme específicos – como dificuldade respiratória grave, dor torácica intensa, confusão mental, convulsões, hemorragia ativa, choque ou síncope.
- Capacidade de comunicação / estado mental – confusão, desorientação ou incapacidade de se comunicar indicam risco maior.
- Velocidade de evolução dos sintomas – alterações rápidas ou progressivas aumentam a prioridade.
- Histórico de comorbidades graves – doenças cardíacas, respiratórias, imunossupressão ou condições crônicas graves podem elevar a prioridade.

Se a classificação de risco for azul ou verde, então local é ubs, se for amarelo, laranja ou vermelho, local é upa/hospital.

Responda exclusivamente em JSON válido, sem comentários ou texto adicional. O formato esperado é:

{
  "sintomas": [{"nome": "Dor de cabeça", "intensidade": "leve"}],
  "classificacao": "verde",
  "risco_cirurgico": true/false,
  "especialidade": "string (ex: Cirurgia Geral, Ortopedia) ou null",
  "unidade_recomendada": "Hospital | UPA | UBS",
  "local": "ubs/upa",
  "descricao": "Podem aguardar atendimento/Explicação curta.",
  "relato": "O meu relato sem modificar o que falei apenas corrigindo gramática (Resumo técnico).",
  "expira": "Expira em 24 horas caso não realize o check-in com o QR Code.",
  "perguntas": [],
  "acoes": ["tosse_audio", "mancha_foto", "pedir_exame"],
  "sugerir_telemedicina": boolean
}

REGRA PARA REAVALIAÇÃO E NOVAS EVIDÊNCIAS:
- Se o usuário enviar mensagens do tipo "[SISTEMA]: Paciente enviou uma foto..." ou similar, entenda que há uma evidência visual disponível no histórico para o médico. Reavalie a classificação de risco considerando que o paciente se preocupou em registrar o sintoma visualmente.
- Dê preferência a uma classificação mais cautelosa (ex: Amarelo em vez de Verde) se o paciente estiver proativo em fornecer dados adicionais como fotos de manchas ou níveis de dor elevados.

REGRA PARA TELEMEDICINA:
- Se a classificacao for "verde" ou "azul" E os sintomas forem leves/moderados (ex: gripe, resfriado, alergia, dores leves) E NÃO houver risco cirúrgico nem necessidade de exame físico imediato (como palpação abdominal aguda), defina "sugerir_telemedicina": true.
- Caso contrário (amarelo/laranja/vermelho ou necessidade de procedimento local), defina "sugerir_telemedicina": false.
`;

        const contextoString = `CONTEXTO DO PACIENTE:
Exames recentes (30 dias):
${contextoExames}

Medicamentos em uso:
${contextoMedicamentos}`;

        const messages = [
          { role: "system", content: promptSistema },
          { role: "user", content: `CONTEXTO ADICIONAL:\n${contextoString}\n\nSINTOMAS:\n${sintomas}` }
        ];

        console.log("Processando requisição de inteligência artificial...", { messagesLength: messages.length });

        let responseStream: any;

        try {
          console.log("Iniciando conexão segura com servidor de IA...");
          responseStream = await new Promise((resolve, reject) => {
            const https = require('node:https');



            const options = {
              hostname: 'api.openai.com',
              port: 443,
              path: '/v1/chat/completions',
              method: 'POST',
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Connection": "close" // Desativa Keep-Alive (imita comportamento padrão do curl simples)
              },
              family: 4, // FORÇA IPv4 no nível do socket
              timeout: 60000 // 60s timeout
            };

            const req = https.request(options, (res: any) => {
              if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Erro de Processamento: ${res.statusCode} ${res.statusMessage}`));
              }
              resolve(res);
            });

            req.on('error', (e: any) => {
              console.error("Erro no socket HTTPS:", e);
              reject(new Error(`Falha de conexão (Socket): ${e.message}`));
            });

            req.on('timeout', () => {
              req.destroy();
              reject(new Error("Timeout na conexão com o servidor de IA"));
            });

            req.write(JSON.stringify({
              model: "gpt-4o-mini",
              messages,
              max_tokens: 1500,
              temperature: 0,
              response_format: { type: "json_object" },
            }));

            req.end();
          });
        } catch (fetchErr: any) {
          console.error("FALHA CRÍTICA HTTPS:", fetchErr);
          throw new Error(`Falha de conexão: ${fetchErr.message}`);
        }

        // Processamento da resposta (stream manual)
        let dataBuffer = "";
        responseStream.on('data', (chunk: any) => {
          dataBuffer += chunk.toString();
        });

        await new Promise((resolve, reject) => {
          responseStream.on('end', resolve);
          responseStream.on('error', reject);
        });

        // Parse do JSON completo
        const content = JSON.parse(dataBuffer).choices?.[0]?.message?.content;

        if (!content) throw new Error("Sem conteúdo na resposta");

        let resultadoTriagem;
        try {
          resultadoTriagem = JSON.parse(content);
        } catch (e) {
          resultadoTriagem = JSON.parse(content.replace(/```json|```/g, "").trim());
        }

        // 🔹 Detecção de Inconsistência
        const cls = resultadoTriagem.classificacao?.toLowerCase();
        let is_inconsistent = false;
        
        if (cls === "verde" || cls === "azul") {
          const hasHighIntensity = (resultadoTriagem.sintomas || []).some((s: any) => {
            const intensity = parseInt(s.intensidade?.replace(/\D/g, "") || "0", 10);
            return intensity >= 8;
          });
          
          if (hasHighIntensity || resultadoTriagem.risco_cirurgico === true) {
            is_inconsistent = true;
          }
        }

        controller.enqueue(
          encoder.encode(JSON.stringify({ resultadoTriagem, isMonitored, is_inconsistent }) + "\n")
        );

        // 🔔 Enviar Notificação Push se tiver pacienteId
        if (pacienteId) {
          addNotificationJob({
            usuarioId: pacienteId,
            titulo: "✅ Triagem Concluída",
            mensagem: `Seu resultado está disponível: ${resultadoTriagem.classificacao.toUpperCase()}`,
            url: "/historico"
          }).catch(err => console.error("Erro ao enviar push triagem:", err));
        }

        controller.close();

      } catch (error: any) {
        console.error("Erro triagem:", error);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              error: `Erro: ${error.message || "Erro desconhecido na triagem"}`,
            }) + "\n"
          )
        );
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}
