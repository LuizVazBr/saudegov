import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { pool } from "@/lib/pgClient";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const client = await pool.connect();

  try {
    const res = await client.query(
      `SELECT config FROM user_config WHERE user_id = $1`,
      [session.user.id]
    );

    let confirmed = false;

    // ✅ CORREÇÃO CRÍTICA — usar rows.length, nunca rowCount
    if (res.rows.length > 0) {
      const config = res.rows[0]?.config || {};
      if (config.dados_confirmados === true) {
        confirmed = true;
      }
    }

    // 2. Buscar endereço
    const resEndereco = await client.query(
      `SELECT cep, endereco, numero, complemento FROM usuarios_enderecos WHERE usuario_id = $1::uuid`,
      [session.user.id]
    );

    const endereco = resEndereco.rows[0] || {};

    // Retorna o status real do banco
    return NextResponse.json({
      dados_confirmados: confirmed,
      endereco: {
        cep: endereco.cep || "",
        endereco: endereco.endereco || "",
        numero: endereco.numero || "",
        complemento: endereco.complemento || ""
      }
    });

  } catch (error) {
    console.error("Erro ao buscar status:", error);
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
