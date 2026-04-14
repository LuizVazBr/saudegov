import { NextResponse } from "next/server";
import { pool } from "@/lib/pgClient";

export async function GET() {
  try {
    const client = await pool.connect();
    const tables = ['historicos', 'unidades', 'unidades_teste', 'usuarios', 'historico_status', 'categorias', 'historico_geolocalizacao', 'historico_classificacao', 'historico_sintomas'];
    
    const results: any = {};
    
    for (const table of tables) {
      const res = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1",
        [table]
      );
      results[table] = res.rows;
    }
    
    client.release();
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
