import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";

async function getIsGestor() {
  const session = await getServerSession(authOptions);
  return session?.user?.tipo_usuario?.toLowerCase() === "gestor";
}

export async function GET(req: NextRequest) {
  if (!(await getIsGestor())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const usuario_id = searchParams.get("usuario_id");

  try {
    const client = await pool.connect();
    
    if (usuario_id) {
      const res = await client.query(
        "SELECT * FROM pacientes_monitorados WHERE usuario_id = $1",
        [usuario_id]
      );
      client.release();
      return NextResponse.json({ isMonitored: res.rows.length > 0, data: res.rows[0] || null });
    }

    const res = await client.query(`
      SELECT pm.*, u.nome, u.documento 
      FROM pacientes_monitorados pm
      JOIN usuarios u ON pm.usuario_id = u.id
      ORDER BY pm.data_registro DESC
    `);
    client.release();
    return NextResponse.json(res.rows);
  } catch (err: any) {
    console.error("Erro GET /api/admin/pacientes-monitorados:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await getIsGestor())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { usuario_id, motivo } = body;

    if (!usuario_id) {
      return NextResponse.json({ error: "usuario_id é obrigatório" }, { status: 400 });
    }

    const client = await pool.connect();
    // Upsert logic
    const check = await client.query("SELECT id FROM pacientes_monitorados WHERE usuario_id = $1", [usuario_id]);
    
    if (check.rows.length > 0) {
      await client.query(
        "UPDATE pacientes_monitorados SET motivo = $1 WHERE usuario_id = $2",
        [motivo, usuario_id]
      );
    } else {
      await client.query(
        "INSERT INTO pacientes_monitorados (usuario_id, motivo) VALUES ($1, $2)",
        [usuario_id, motivo]
      );
    }
    
    client.release();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro POST /api/admin/pacientes-monitorados:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await getIsGestor())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const usuario_id = searchParams.get("usuario_id");

  if (!usuario_id) {
    return NextResponse.json({ error: "usuario_id não fornecido" }, { status: 400 });
  }

  try {
    const client = await pool.connect();
    await client.query("DELETE FROM pacientes_monitorados WHERE usuario_id = $1", [usuario_id]);
    client.release();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro DELETE /api/admin/pacientes-monitorados:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
