import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json({ error: "Endereço não fornecido" }, { status: 400 });
    }

    // Nominatim API call
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "AnamnexApp/1.0 (cliv-telemedicina; admin-geocoding)",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Erro ao consultar serviço de geocodificação" }, { status: 502 });
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return NextResponse.json({ error: "Nenhum local encontrado para este endereço" }, { status: 404 });
    }

    const { lat, lon, display_name } = results[0];

    return NextResponse.json({
      lat: parseFloat(lat),
      lng: parseFloat(lon),
      fullName: display_name
    });

  } catch (error: any) {
    console.error("Erro no geocodificador:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
