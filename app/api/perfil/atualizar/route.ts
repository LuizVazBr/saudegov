import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/AuthOptions";
import { pool } from "@/lib/pgClient";
import { redis } from "@/lib/redis";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const {
    nome,
    numero_sus,
    telefone,
    email,
    sexo,
    data_nascimento,
    confirmar_apenas,
  } = body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Atualizar dados do usuário
    if (!confirmar_apenas) {
      console.log("Atualizando usuário:", session.user.id, body);

      // 🔹 Sanitização da data
      let dataNasc: string | null = data_nascimento;

      if (!dataNasc || dataNasc === "") {
        dataNasc = null;
      } else if (typeof dataNasc === "string" && dataNasc.includes("T")) {
        dataNasc = dataNasc.split("T")[0];
      }

      await client.query(
        `
        UPDATE usuarios
        SET nome = $1,
            numero_sus = $2,
            telefone = $3,
            email = $4,
            sexo = $5,
            data_nascimento = $6
        WHERE id = $7
        `,
        [
          nome,
          numero_sus,
          telefone,
          email,
          sexo,
          dataNasc,
          session.user.id,
        ]
      );

      // 1.1 Atualizar endereço
      const { cep, endereco, numero, complemento } = body;
      const resEnd = await client.query(`SELECT id FROM usuarios_enderecos WHERE usuario_id = $1::uuid`, [session.user.id]);

      if (resEnd.rows.length > 0) {
        await client.query(
          `UPDATE usuarios_enderecos SET cep = $1, endereco = $2, numero = $3, complemento = $4 WHERE usuario_id = $5::uuid`,
          [cep, endereco, numero, complemento, session.user.id]
        );
      } else {
        await client.query(
          `INSERT INTO usuarios_enderecos (usuario_id, cep, endereco, numero, complemento) VALUES ($1::uuid, $2, $3, $4, $5)`,
          [session.user.id, cep, endereco, numero, complemento]
        );
      }
    }

    // 2. Buscar config atual
    const resConfig = await client.query(
      `
      SELECT config
      FROM user_config
      WHERE user_id = $1
      `,
      [session.user.id]
    );

    let currentConfig: Record<string, any> = {};

    // ✅ CORREÇÃO CRÍTICA: usar rows.length (NUNCA rowCount)
    if (resConfig.rows.length > 0) {
      currentConfig = resConfig.rows[0]?.config || {};
    }

    const newConfig = {
      ...currentConfig,
      dados_confirmados: true,
    };

    // 3. Update ou Insert (upsert manual)
    if (resConfig.rows.length > 0) {
      await client.query(
        `
        UPDATE user_config
        SET config = $1
        WHERE user_id = $2
        `,
        [JSON.stringify(newConfig), session.user.id]
      );
    } else {
      await client.query(
        `
        INSERT INTO user_config (user_id, config)
        VALUES ($1, $2)
        `,
        [session.user.id, JSON.stringify(newConfig)]
      );
    }

    await client.query("COMMIT");

    // 4. Atualiza cache no Redis
    const redisKey = `user_config:${session.user.id}`;
    await redis.set(redisKey, JSON.stringify(newConfig), "EX", 3600);

    return NextResponse.json({ success: true });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erro ao atualizar perfil:", error);

    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
