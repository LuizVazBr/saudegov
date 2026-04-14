import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { expireQueue } from "@/queues/expireQueue";
import { redis, invalidateTriageCache } from "@/lib/redis";

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { paciente_id, categoria_id, descricao, classificacao, sintomas, tipo, tempo_transcricao, latitude, longitude, teste } = body;

    await client.query("BEGIN");

    let unitId = null;
    if (latitude && longitude) {
      const cls = (classificacao || "").toLowerCase();
      const targetType = (cls === "verde" || cls === "azul") ? "UBS" : "UPA";
      const targetTable = teste ? "unidades_teste" : "unidades";
      
      try {
        const nearestUnitRes = await client.query(
          `SELECT id FROM ${targetTable} 
           WHERE tipo = $1 AND status = 1
           ORDER BY coordenadas <-> ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography 
           LIMIT 1`,
          [targetType, longitude, latitude]
        );
        if (nearestUnitRes.rows.length > 0) {
          unitId = nearestUnitRes.rows[0].id;
        }
      } catch (err) {
        console.warn("Erro ao buscar unidade mais próxima:", err);
      }
    }

    // 1️⃣ Cria o registro em historicos com tipo, tempo_transcricao e unidade_id automática
    const historicoRes = await client.query(
      `INSERT INTO historicos 
        (paciente_id, categoria_id, descricao, data_cadastro, data_atualizacao, tipo, tempo_transcricao, unidade_id)
      VALUES ($1, $2, $3, NOW(), NOW(), $4, $5, $6)
      RETURNING id`,
      [
        paciente_id, 
        categoria_id, 
        descricao, 
        tipo || "digitando",     // padrão 'digitando'
        tempo_transcricao || null,
        unitId
      ]
    );

    const historicoId = historicoRes.rows[0].id;

    const { fotoBase64, audioBase64, exameBase64, exameDescricao } = body;

    // 1.5️⃣ Insere geolocalização na tabela separada
    if (latitude && longitude) {
      await client.query(
        `INSERT INTO historico_geolocalizacao (historico_id, latitude, longitude, data_cadastro)
         VALUES ($1, $2, $3, NOW())`,
        [historicoId, latitude, longitude]
      );
    }

    // 2️⃣ Insere status inicial sempre como 'iniciado'
    await client.query(
      `INSERT INTO historico_status (historico_id, status, data_cadastro)
       VALUES ($1, $2, NOW())`,
      [historicoId, "iniciado"]
    );

    // 3️⃣ Insere classificação real em historico_classificacao
    if (classificacao) {
      await client.query(
        `INSERT INTO historico_classificacao (historico_id, classificacao, data_cadastro)
         VALUES ($1, $2, NOW())`,
        [historicoId, classificacao]
      );
    }

    // 4️⃣ Insere sintomas
    if (Array.isArray(sintomas)) {
      for (const s of sintomas) {
        await client.query(
          `INSERT INTO historico_sintomas 
             (historico_id, sintoma, intensidade, informacoes_adicionais, desde_quando, data_cadastro)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            historicoId,
            s.nome,
            s.intensidade || null,
            s.informacoes_adicionais || null,
            s.desde_quando || null,
          ]
        );
      }
    }

    // 5️⃣ Transamento Único: Anexar Fotos/Áudios se enviados no Payload
    if (fotoBase64) {
      await client.query(
        `INSERT INTO historico_info_adicional (historico_id, tipo, arquivo_base64, data_cadastro)
         VALUES ($1, $2, $3, NOW())`,
        [historicoId, "foto", fotoBase64]
      );
    }

    if (audioBase64) {
      await client.query(
        `INSERT INTO historico_info_adicional (historico_id, tipo, arquivo_base64, data_cadastro)
         VALUES ($1, $2, $3, NOW())`,
        [historicoId, "áudio", audioBase64]
      );
    }

    // 6️⃣ Se houver exame pendente (Exames Solicitados Digitais)
    if (exameBase64) {
      await client.query(
        `INSERT INTO exames (usuario_id, descricao, pdf_exame, data_cadastro)
         VALUES ($1, $2, $3, NOW())`,
        [paciente_id, exameDescricao || "Exame clínico enviado durante triagem", exameBase64]
      );
    }

    // Agenda expiração automática baseada na classificação
    let expireDelay = 24 * 60 * 60 * 1000; // Padrão 24h
    if (classificacao === "vermelho") expireDelay = 2 * 60 * 60 * 1000; // 2h
    else if (classificacao === "laranja") expireDelay = 4 * 60 * 60 * 1000; // 4h
    else if (classificacao === "amarelo") expireDelay = 12 * 60 * 60 * 1000; // 12h

    await expireQueue.add(
      "expire",
      { historicoId },
      { jobId: historicoId,
        delay: expireDelay
      }
    );

    await client.query("COMMIT");

    // 📣 Notifica Dashboard em tempo real via Redis Pub/Sub e invalida cache
    try {
      // ✅ Busca o nome do paciente para o Dashboard mostrar corretamente (LGPD/Masking)
      const userRes = await client.query("SELECT nome FROM usuarios WHERE id = $1", [paciente_id]);
      const paciente_nome = userRes.rows[0]?.nome || "PACIENTE ANÔNIMO";

      // ✅ Busca as coordenadas da unidade para o Dashboard desenhar a linha amarela imediatamente
      let unit_lat = null;
      let unit_lng = null;
      if (unitId) {
        const targetTable = teste ? "unidades_teste" : "unidades";
        const unitCoordsRes = await client.query(
          `SELECT ST_Y(coordenadas::geometry) as lat, ST_X(coordenadas::geometry) as lng 
           FROM ${targetTable} WHERE id = $1`, 
          [unitId]
        );
        if (unitCoordsRes.rows.length > 0) {
          unit_lat = unitCoordsRes.rows[0].lat;
          unit_lng = unitCoordsRes.rows[0].lng;
        }
      }

      // Invalida cache de listas para garantir que o dashboard veja o novo dado no próximo fetch
      await invalidateTriageCache();

      const eventData = {
        id: historicoId,
        pacienteId: paciente_id,
        paciente_nome, 
        descricao,
        classificacao,
        sintomas: sintomas || [],
        latitude,
        longitude,
        unit_lat,
        unit_lng,
        dataHora: new Date().toISOString()
      };

      console.log(`[Redis] Publicando triagem ${historicoId} para dashboard...`);
      await redis.publish("triage:realtime", JSON.stringify(eventData));
    } catch (redisErr) {
      console.error("❌ [Relato] Erro Redis:", redisErr);
    }


    return NextResponse.json({ success: true, historicoId });
  } catch (err: any) {
    if (client) await client.query("ROLLBACK");
    console.error("Erro ao salvar histórico:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}
