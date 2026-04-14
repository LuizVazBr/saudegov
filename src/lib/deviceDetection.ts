// src/lib/deviceDetection.ts

export interface DeviceInfo {
  tipo_dispositivo: string;
  modelo: string;
  sistema_operacional: string;
  navegador: string;
  versao_navegador: string;
}

export function getDeviceInfo(userAgent?: string): DeviceInfo {
  const ua = userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  
  if (!ua && (typeof window === "undefined" || typeof navigator === "undefined")) {
    return {
      tipo_dispositivo: "Servidor",
      modelo: "N/A",
      sistema_operacional: "N/A",
      navegador: "N/A",
      versao_navegador: "N/A",
    };
  }
  let tipo = "Desktop";
  let modelo = "Desconhecido";
  let so = "Desconhecido";
  let navegador = "Desconhecido";
  let versao = "Desconhecido";

  // Detectar Tipo
  if (/mobile/i.test(ua)) tipo = "Celular";
  if (/tablet/i.test(ua) || /ipad/i.test(ua)) tipo = "Tablet";

  // Detectar SO
  if (/Windows/i.test(ua)) so = "Windows";
  else if (/Macintosh|Mac OS X/i.test(ua)) so = "Mac OS";
  else if (/Android/i.test(ua)) so = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) so = "iOS";
  else if (/Linux/i.test(ua)) so = "Linux";

  // Detectar Navegador e Versão
  const browserMatch = ua.match(/(firefox|msie|trident|chrome|safari|edg|opr)\/?\s*(\d+)/i) || [];
  if (browserMatch[1]) {
    navegador = browserMatch[1].toLowerCase();
    versao = browserMatch[2];
  }

  // Refinar modelo básico (muito limitado via JS puro, mas pegamos o principal)
  if (/iPhone/i.test(ua)) modelo = "iPhone";
  else if (/iPad/i.test(ua)) modelo = "iPad";
  else if (/Samsung|SM-/i.test(ua)) modelo = "Samsung";
  else if (/Windows NT 10.0/i.test(ua)) modelo = "PC (Windows 10/11)";
  else if (tipo === "Desktop") modelo = "PC/Mac";

  return {
    tipo_dispositivo: tipo,
    modelo: modelo,
    sistema_operacional: so,
    navegador: navegador,
    versao_navegador: versao,
  };
}
