export type TelemedStatus = {
  aceito: boolean;
  recusado: boolean;
};

/**
 * Verifica se o paciente já aceitou ou recusou os termos de telemedicina,
 * utilizando cache em sessionStorage para minimizar chamadas ao banco de dados.
 */
export async function verificarStatusTelemedicina(pacienteId: string): Promise<TelemedStatus> {
  if (!pacienteId) return { aceito: false, recusado: false };

  const cacheKeyAceito = `tele_consent_${pacienteId}`;
  const cacheKeyRecusado = `tele_refusal_${pacienteId}`;
  
  // 1. Verifica cache na sessão atual (Evita carga no banco se já soubermos o status)
  if (typeof window !== "undefined") {
    const cachedAceito = sessionStorage.getItem(cacheKeyAceito) === "true";
    const cachedRecusado = sessionStorage.getItem(cacheKeyRecusado) === "true";
    if (cachedAceito || cachedRecusado) {
      return { aceito: cachedAceito, recusado: cachedRecusado };
    }
  }

  // 2. Se não houver cache completo, consulta o banco de dados
  try {
    const res = await fetch(`/api/termos-aceite?pacienteId=${pacienteId}`);
    const data = await res.json();
    
    // Atualiza cache
    if (typeof window !== "undefined") {
      if (data.aceito) sessionStorage.setItem(cacheKeyAceito, "true");
      if (data.recusado) sessionStorage.setItem(cacheKeyRecusado, "true");
    }
    
    return { 
      aceito: !!data.aceito, 
      recusado: !!data.recusado 
    };
  } catch (err) {
    console.error("Erro ao verificar status telemedicina:", err);
    return { aceito: false, recusado: false };
  }
}

/**
 * Registra o aceite ou recusa no banco de dados e no cache.
 */
export async function registrarDecisaoTelemedicina(pacienteId: string, decisao: "aceite" | "recusa") {
  if (!pacienteId) return;

  const tipo = decisao === "aceite" ? "telemedicina" : "telemedicina_recusa";
  const cacheKey = decisao === "aceite" ? `tele_consent_${pacienteId}` : `tele_refusal_${pacienteId}`;

  // 1. Atualiza cache imediatamente
  if (typeof window !== "undefined") {
    sessionStorage.setItem(cacheKey, "true");
    // Se aceitou, remove recusa se houver, e vice-versa
    if (decisao === "aceite") sessionStorage.removeItem(`tele_refusal_${pacienteId}`);
    else sessionStorage.removeItem(`tele_consent_${pacienteId}`);
  }

  // 2. Persiste no banco de dados APENAS SE FOR ACEITE (pedido do cliente)
  if (decisao === "aceite") {
    try {
      await fetch("/api/termos-aceite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacienteId, tipo }),
      });
    } catch (err) {
      console.error(`Erro ao registrar ${decisao} no banco:`, err);
    }
  }
}

/**
 * Legado: Verifica apenas aceite (mantido para compatibilidade)
 */
export async function verificarConsentimentoTelemedicina(pacienteId: string): Promise<boolean> {
  const status = await verificarStatusTelemedicina(pacienteId);
  return status.aceito;
}

/**
 * Legado: Registra apenas aceite (mantido para compatibilidade)
 */
export function registrarAceiteCache(pacienteId: string) {
  registrarDecisaoTelemedicina(pacienteId, "aceite");
}
