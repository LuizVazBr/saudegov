
import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const dynamic = 'force-dynamic';

async function saveFile(file: File, folder: string): Promise<string> {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Garantir que a pasta existe
    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name);
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    return `/uploads/${folder}/${fileName}`;
}

// POST para criar ou atualizar unidade
export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const isTeste = searchParams.get("teste") === "true";
        const tableName = isTeste ? "unidades_teste" : "unidades";

        const formData = await request.formData();

        const id = formData.get("id") as string;
        const nome = formData.get("nome") as string;
        const endereco = formData.get("endereco") as string;
        const tipo = formData.get("tipo") as string;
        const lat = formData.get("lat") as string;
        const lng = formData.get("lng") as string;
        const telefone = formData.get("telefone") as string;
        const whatsapp = formData.get("whatsapp") as string;
        const youtubeLink = formData.get("youtubeLink") as string;

        const fotoFile = formData.get("foto") as File | null;
        const videoFile = formData.get("videoFile") as File | null;
        const audioFile = formData.get("audio") as File | null;

        let imgUrl = null;
        let videoUrl = null;
        let audioUrl = null;

        // Processar uploads
        if (fotoFile && fotoFile.size > 0) {
            imgUrl = await saveFile(fotoFile, "fotos");
        }

        // Lógica vídeo: Prioridade para arquivo direto, senão link youtube
        if (videoFile && videoFile.size > 0) {
            videoUrl = await saveFile(videoFile, "videos");
        } else if (youtubeLink) {
            videoUrl = youtubeLink;
        }

        if (audioFile && audioFile.size > 0) {
            audioUrl = await saveFile(audioFile, "audios");
        }

        const client = await pool.connect();

        try {
            if (id && id !== "null" && id !== "undefined" && id !== "") {
                // UPDATE seletivo
                const currentRes = await client.query(`SELECT img_url, video_url, audio_url FROM ${tableName} WHERE id = $1`, [id]);
                const current = currentRes.rows[0];

                const finalImgUrl = imgUrl || current?.img_url;
                let targetVideoUrl = current?.video_url;
                if (videoFile && videoFile.size > 0) targetVideoUrl = videoUrl;
                else if (youtubeLink) targetVideoUrl = youtubeLink;

                await client.query(`
          UPDATE ${tableName} SET
            nome = $1,
            endereco = $2,
            tipo = $3,
            telefone = $4,
            whatsapp = $5,
            img_url = $6,
            video_url = $7,
            audio_url = $8,
            coordenadas = ST_SetSRID(ST_MakePoint($10, $9), 4326)
          WHERE id = $11
        `, [
                    nome,
                    endereco,
                    tipo,
                    telefone,
                    whatsapp,
                    finalImgUrl,
                    targetVideoUrl,
                    audioUrl || current?.audio_url,
                    parseFloat(lat), 
                    parseFloat(lng),
                    id
                ]);

                return NextResponse.json({ success: true, message: "Unidade atualizada" });

            } else {
                // INSERT
                const result = await client.query(`
          INSERT INTO ${tableName} (
            id, nome, endereco, tipo, telefone, whatsapp, 
            img_url, video_url, audio_url, cliente, status, 
            coordenadas, data_cadastro
          ) VALUES (
            uuid_generate_v4(), $1, $2, $3, $4, $5, 
            $6, $7, $8, $11, 1, 
            ST_SetSRID(ST_MakePoint($10, $9), 4326), NOW()
          ) RETURNING id
        `, [
                    nome,
                    endereco,
                    tipo,
                    telefone,
                    whatsapp,
                    imgUrl,
                    videoUrl,
                    audioUrl,
                    parseFloat(lat),
                    parseFloat(lng),
                    isTeste ? "Isac_TESTE" : "Isac_TO"
                ]);

                return NextResponse.json({ success: true, id: result.rows[0].id });
            }
        } finally {
            client.release();
        }

    } catch (error: any) {
        console.error("Erro API Unidades:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET para listar
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const isTeste = searchParams.get("teste") === "true";
        const searchTerm = searchParams.get("search") || "";
        const tableName = isTeste ? "unidades_teste" : "unidades";

        const client = await pool.connect();
        let query = `
          SELECT 
            id, nome, tipo, endereco, telefone, whatsapp, 
            img_url, video_url, audio_url, cliente,
            ST_Y(coordenadas::geometry) AS lat,
            ST_X(coordenadas::geometry) AS lng
          FROM ${tableName}
          WHERE status = 1 
        `;
        const params = [];

        if (searchTerm) {
          query += ` AND (nome ILIKE $1 OR endereco ILIKE $1 OR tipo ILIKE $1)`;
          params.push(`%${searchTerm}%`);
        }

        query += ` ORDER BY nome ASC`;

        const result = await client.query(query, params);
        client.release();
        return NextResponse.json(result.rows);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE para desativar (soft delete)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const isTeste = searchParams.get("teste") === "true";
    const tableName = isTeste ? "unidades_teste" : "unidades";

    if (!id) {
      return NextResponse.json({ error: "ID não fornecido" }, { status: 400 });
    }

    const client = await pool.connect();
    await client.query(`UPDATE ${tableName} SET status = 0 WHERE id = $1`, [id]);
    client.release();

    return NextResponse.json({ success: true, message: "Unidade removida" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
