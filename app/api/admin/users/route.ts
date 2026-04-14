import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import bcrypt from "bcrypt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { redis } from "@/lib/redis";

/**
 * API para Gestão de Usuários (Médicos, Enfermeiros, Gestores, Pacientes)
 * Restrita apenas para usuários logados com tipo 'gestor'
 */

async function getIsGestor() {
  const session = await getServerSession(authOptions);
  return session?.user?.tipo_usuario?.toLowerCase() === "gestor";
}

async function invalidateUserCache() {
  try {
    const keys = await redis.keys("cliv:admin:users:*");
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`🧹 Cache de usuários invalidado: ${keys.length} chaves removidas.`);
    }
  } catch (err) {
    console.warn("Erro ao invalidar cache do Redis:", err);
  }
}

export async function GET(req: NextRequest) {
  if (!(await getIsGestor())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo")?.toLowerCase();
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;
  const v = searchParams.get("v") || "";

  // Tentar buscar do Cache Redis primeiro (incluindo v no cacheKey para permitir bypass se necessário)
  const cacheKey = `cliv:admin:users:${tipo}:${search}:${page}:${limit}${v ? `:${v}` : ""}`;
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    console.log("🚀 Usuários carregados do Redis");
    return NextResponse.json(JSON.parse(cachedData));
  }

  let query = `
    SELECT 
      u.id, u.nome, u.email, u.documento, u.tipo_usuario, u.telefone, u.data_cadastro,
      u.nome_mae, u.telefone_whatsapp, u.sexo, u.data_nascimento, u.numero_sus,
      p.crm, p.especialidade, p.estado_atuacao,
      CASE WHEN pm.usuario_id IS NOT NULL THEN true ELSE false END as is_monitored,
      CASE WHEN ma.medico_id IS NOT NULL THEN true ELSE false END as has_signature
    FROM usuarios u
    LEFT JOIN profissionais p ON u.id = p.usuario_id
    LEFT JOIN pacientes_monitorados pm ON u.id = pm.usuario_id
    LEFT JOIN medico_assinaturas ma ON u.id::text = ma.medico_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (tipo) {
    const typesMap: Record<string, string> = {
        'paciente': 'paciente', 'pacientes': 'paciente',
        'medico': 'medico', 'medicos': 'medico',
        'enfermeiro': 'enfermeiro', 'enfermeiros': 'enfermeiro',
        'gestor': 'gestor', 'gestores': 'gestor'
    };
    const mappedType = typesMap[tipo] || tipo;
    params.push(mappedType);
    query += ` AND u.tipo_usuario ILIKE $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (u.nome ILIKE $${params.length} OR u.documento ILIKE $${params.length})`;
  }

  query += ` ORDER BY u.nome ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  try {
    const client = await pool.connect();
    const res = await client.query(query, params);
    client.release();

    // Salvar no Cache Redis (TTL de 10 minutos para admin)
    await redis.setex(cacheKey, 600, JSON.stringify(res.rows));

    return NextResponse.json(res.rows);
  } catch (err: any) {
    console.error("Erro GET /api/admin/users:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getIsGestor())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const body = await req.json();
    const {
      nome, email, senha, tipo_usuario, documento, telefone,
      sexo, data_nascimento, numero_sus, nome_mae, telefone_whatsapp,
      crm, especialidade, estado_atuacao
    } = body;

    if (!nome || !documento || !tipo_usuario || !senha) {
      return NextResponse.json({ error: "Dados obrigatórios faltando" }, { status: 400 });
    }

    const senha_hash = await bcrypt.hash(senha, 10);
    const tipo = tipo_usuario.toLowerCase().trim();

    const userRes = await client.query(
      `INSERT INTO usuarios 
      (nome, email, senha_hash, tipo_usuario, documento, telefone, sexo, data_nascimento, numero_sus, nome_mae, telefone_whatsapp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
      RETURNING id`,
      [nome, email, senha_hash, tipo, documento.replace(/\D/g, ""), telefone, sexo, data_nascimento, numero_sus, nome_mae, telefone_whatsapp]
    );

    const userId = userRes.rows[0].id;

    if (tipo === "medico" || tipo === "enfermeiro" || tipo === "profissional") {
      await client.query(
        `INSERT INTO profissionais (usuario_id, funcao, crm, especialidade, estado_atuacao, ativo)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [userId, tipo, crm, especialidade, estado_atuacao]
      );
    }

    // 🚩 Gerenciar Monitoração
    if (body.is_monitored) {
      await client.query(
        `INSERT INTO pacientes_monitorados (usuario_id, motivo) 
         VALUES ($1, $2) ON CONFLICT (usuario_id) DO NOTHING`,
        [userId, "Monitoração ativada na criação do usuário."]
      );
    }

    await client.query("COMMIT");
    await invalidateUserCache();
    return NextResponse.json({ success: true, id: userId });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Erro POST /api/admin/users:", err);
    if (err.code === "23505") {
      return NextResponse.json({ error: "CPF ou Email já cadastrado" }, { status: 409 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest) {
  if (!(await getIsGestor())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const body = await req.json();
    const {
      id, nome, email, senha, tipo_usuario, documento, telefone,
      sexo, data_nascimento, numero_sus, nome_mae, telefone_whatsapp,
      crm, especialidade, estado_atuacao
    } = body;

    if (!id) return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });

    const tipo = tipo_usuario.toLowerCase().trim();
    let query = `UPDATE usuarios SET 
                nome = $1, email = $2, tipo_usuario = $3, documento = $4, 
                telefone = $5, sexo = $6, data_nascimento = $7, numero_sus = $8,
                nome_mae = $9, telefone_whatsapp = $10`;
    const params: any[] = [nome, email, tipo, documento.replace(/\D/g, ""), telefone, sexo, data_nascimento, numero_sus, nome_mae, telefone_whatsapp];

    if (senha) {
      const senha_hash = await bcrypt.hash(senha, 10);
      params.push(senha_hash);
      query += `, senha_hash = $${params.length}`;
    }

    params.push(id);
    query += ` WHERE id = $${params.length}`;

    await client.query(query, params);

    if (tipo === "medico" || tipo === "enfermeiro" || tipo === "profissional") {
      // Upsert into profissionais
      const profCheck = await client.query("SELECT id FROM profissionais WHERE usuario_id = $1", [id]);
      if (profCheck.rows.length > 0) {
        await client.query(
          `UPDATE profissionais SET funcao = $2, crm = $3, especialidade = $4, estado_atuacao = $5 WHERE usuario_id = $1`,
          [id, tipo, crm, especialidade, estado_atuacao]
        );
      } else {
        await client.query(
          `INSERT INTO profissionais (usuario_id, funcao, crm, especialidade, estado_atuacao, ativo)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [id, tipo, crm, especialidade, estado_atuacao]
        );
      }
    }

    // 🚩 Gerenciar Monitoração
    if (body.is_monitored !== undefined) {
      if (body.is_monitored) {
        await client.query(
          `INSERT INTO pacientes_monitorados (usuario_id, motivo) 
           VALUES ($1, $2) ON CONFLICT (usuario_id) DO NOTHING`,
          [id, "Monitoração ativada na edição do usuário."]
        );
      } else {
        await client.query(
          `DELETE FROM pacientes_monitorados WHERE usuario_id = $1`,
          [id]
        );
      }
    }

    await client.query("COMMIT");
    await invalidateUserCache();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Erro PUT /api/admin/users:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await getIsGestor())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });

  try {
    const client = await pool.connect();
    await client.query("DELETE FROM usuarios WHERE id = $1", [id]);
    client.release();
    await invalidateUserCache();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
