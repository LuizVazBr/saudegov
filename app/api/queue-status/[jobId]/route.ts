import { NextResponse } from "next/server";
import { getJobStatus } from "@/lib/queue/notificationQueue";

export async function GET(req: Request, context: any) {
  try {
    // 🔹 Proteção extra caso params não exista
    const jobId = context?.params?.jobId;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { error: "jobId é obrigatório" },
        { status: 400 }
      );
    }

    const status = await getJobStatus(jobId);

    // 🔹 Caso o job não exista
    if (!status) {
      return NextResponse.json(
        { error: "Job não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(status);

  } catch (error) {
    console.error("Erro ao consultar status do job:", error);
    return NextResponse.json(
      { error: "Erro ao consultar status" },
      { status: 500 }
    );
  }
}
