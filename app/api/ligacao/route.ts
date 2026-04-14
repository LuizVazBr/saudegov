import { NextRequest, NextResponse } from "next/server";
import Twilio from "twilio";

export async function POST(req: NextRequest) {
  try {
    const { to, nome, type } = await req.json(); // Recebe o número e nome do corpo da requisição

    const sid = process.env.TWILIO_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER  as string; // +556140404822
    const client = Twilio(sid, token);

    const call = await client.calls.create({
      to,
      from,
      url: `https://cliv.app/voip/handle-call.php?type=${encodeURIComponent(type)}&nome=${encodeURIComponent(nome)}`,
      timeout: 10,
      asyncAmd: "false",
      //ifMachine: "Continue",
      machineDetection: "Enable",
      //machineDetectionEngine: "Lumenvox",
      //machineDetectionMinWordLength: 100,
      //machineDetectionMaxWordLength: 5000,
      //machineDetectionWordsSilence: 50,
      //machineDetectionMaxNumOfWords: 5,
      //machineDetectionSilenceThreshold: 256,
      timeLimit: 240,
      machineDetectionTimeout: 10,
      //detectMessageEnd: "true",
      machineDetectionSpeechThreshold: 1000,
      machineDetectionSpeechEndThreshold: 500,
      machineDetectionSilenceTimeout: 2000,
      statusCallback: "https://cliv.app/voip/events.php",
      statusCallbackMethod: "POST",
      statusCallbackEvent: [
        "initiated",
        "ringing",
        "answered",
        "completed",
        "busy",
        "no-answer",
        "failed",
      ],
      record: true,
      recordingTrack: "both",
      trim: "do-not-trim",
      //transcribe: "true",
    });

    return NextResponse.json({ success: true, sid: call.sid });
  } catch (error: any) {
    console.error("Erro na ligação:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
