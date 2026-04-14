// app/api/whatsapp/route.ts
import { NextRequest, NextResponse } from "next/server";

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const CHAT_API_TOKEN = process.env.WHATSAPP_API_TOKEN;

export async function POST(req: NextRequest) {
  try {
    const { to, type, bodyVar1, bodyVar2, bodyVar3, bodyVar4, latitude, longitude, locationName, address } = await req.json();

    let templatePayload: any;

    switch (type) {
      case "whatsapp": // template de texto (pré-triagem, etc.)
        templatePayload = {
          name: "clivtri", // nome do template cadastrado
          language: { code: "pt_PT" }, // ou pt_BR
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: bodyVar1 },
                { type: "text", text: bodyVar2 },
                { type: "text", text: bodyVar3 },
                { type: "text", text: bodyVar4 },
              ],
            },
          ],
        };
        break;

      case "localizacao": // template com cabeçalho de localização
        templatePayload = {
          name: "clivloc", // nome do template cadastrado
          language: { code: "pt_PT" }, // ou pt_BR
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "location",
                  location: {
                    latitude,
                    longitude,
                    name: locationName,
                    address,
                  },
                },
              ],
            },
            {
              type: "body",
              parameters: [], // só se houver {{1}}, {{2}} no corpo
            },
          ],
        };
        break;

      default:
        return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }

    const response = await fetch(`https://graph.facebook.com/v13.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CHAT_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: templatePayload,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
