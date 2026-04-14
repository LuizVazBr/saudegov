import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { pool } from "@/lib/pgClient";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const res = await pool.query(
      "SELECT * FROM usuarios_perfil_saude WHERE usuario_id = $1::uuid",
      [session.user.id]
    );

    return NextResponse.json(res.rows[0] || {});
  } catch (error) {
    console.error("Erro ao buscar perfil de saúde:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const {
    raca_cor,
    fumante,
    consumo_alcool,
    necessidades_especiais,
    historia_familia_diabetes,
    grau_familia_diabetes,
    historia_familia_cancer,
    grau_familia_cancer,
    tipo_cancer,
    atividades_fisicas,
    alergias,
    medicamentos_continuos,
    tipo_sanguineo,
    peso,
    altura,
    sono,
    agua
  } = body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if profile exists
    const checkRes = await client.query(
      "SELECT id FROM usuarios_perfil_saude WHERE usuario_id = $1::uuid",
      [session.user.id]
    );

    if (checkRes.rows.length > 0) {
      // Update
      await client.query(
        `UPDATE usuarios_perfil_saude SET
          raca_cor = $1, fumante = $2, consumo_alcool = $3, necessidades_especiais = $4,
          historia_familia_diabetes = $5, grau_familia_diabetes = $6,
          historia_familia_cancer = $7, grau_familia_cancer = $8, tipo_cancer = $9,
          atividades_fisicas = $10, alergias = $11, medicamentos_continuos = $12,
          tipo_sanguineo = $13, peso = $14, altura = $15, sono = $16, agua = $17,
          atualizado_em = CURRENT_TIMESTAMP
        WHERE usuario_id = $18::uuid`,
        [
          raca_cor, fumante, consumo_alcool, necessidades_especiais,
          historia_familia_diabetes, grau_familia_diabetes,
          historia_familia_cancer, grau_familia_cancer, tipo_cancer,
          atividades_fisicas, alergias, medicamentos_continuos,
          tipo_sanguineo, peso, altura, sono, agua,
          session.user.id
        ]
      );
    } else {
      // Insert
      await client.query(
        `INSERT INTO usuarios_perfil_saude (
          usuario_id, raca_cor, fumante, consumo_alcool, necessidades_especiais,
          historia_familia_diabetes, grau_familia_diabetes,
          historia_familia_cancer, grau_familia_cancer, tipo_cancer,
          atividades_fisicas, alergias, medicamentos_continuos,
          tipo_sanguineo, peso, altura, sono, agua
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          session.user.id, raca_cor, fumante, consumo_alcool, necessidades_especiais,
          historia_familia_diabetes, grau_familia_diabetes,
          historia_familia_cancer, grau_familia_cancer, tipo_cancer,
          atividades_fisicas, alergias, medicamentos_continuos,
          tipo_sanguineo, peso, altura, sono, agua
        ]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao atualizar perfil de saúde:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  } finally {
    client.release();
  }
}
