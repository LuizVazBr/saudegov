import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import bcrypt from "bcrypt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nome,
      email,
      senha,
      tipo_usuario = "paciente",
      documento,
      telefone,
      telefone_whatsapp = false,
      data_nascimento,
      numero_sus,
      nome_mae,
      sexo,
      cep,
      endereco,
      numero,
      complemento,
    } = body;

    const client = await pool.connect();

    try {
      // Hash da senha
      const senha_hash = await bcrypt.hash(senha, 10);

      // ── Verificar CPF duplicado ────────────────────────────────────
      if (documento) {
        const existing = await client.query(
          `SELECT id FROM usuarios WHERE documento = $1 LIMIT 1`,
          [documento]
        );
        if (existing.rows.length > 0) {
          return NextResponse.json(
            { success: false, error: "CPF já cadastrado no sistema." },
            { status: 409 }
          );
        }
      }
      // ────────────────────────────────────────────────────────────────

      // Inserir usuário
      const resUsuario = await client.query(
        `INSERT INTO usuarios 
          (nome, email, senha_hash, tipo_usuario, documento, telefone, telefone_whatsapp, data_nascimento, numero_sus, nome_mae, sexo)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) 
          RETURNING id`,
        [
          nome,
          email,
          senha_hash,
          tipo_usuario,
          documento,
          telefone,
          telefone_whatsapp,
          data_nascimento,
          numero_sus,
          nome_mae,
          sexo,
        ]
      );

      const usuario_id = resUsuario.rows[0].id;

      // Inserir endereço
      await client.query(
        `INSERT INTO usuarios_enderecos 
          (usuario_id, cep, endereco, numero, complemento) 
          VALUES ($1,$2,$3,$4,$5)`,
        [usuario_id, cep, endereco, numero, complemento]
      );

      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
