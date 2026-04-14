import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { identity, room } = await req.json();

    if (!identity || !room) {
      return NextResponse.json(
        { error: 'Identity and room are required' },
        { status: 400 }
      );
    }

    // Configuração dos servidores ICE (STUN/TURN)
    const isProduction = process.env.NODE_ENV === 'production';
    const turnHost = process.env.TURN_SERVER_HOST || (isProduction ? '177.153.51.216' : 'localhost');

    const iceServers = [
      // Servidores TURN públicos gratuitos (PRIMEIRO para garantir conexão)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      // STUN servers do Google
      {
        urls: 'stun:stun.l.google.com:19302'
      },
      {
        urls: 'stun:stun1.l.google.com:19302'
      },
      // Seu servidor TURN auto-hospedado (se configurado)
      {
        urls: `stun:${turnHost}:3478`
      },
      {
        urls: `turn:${turnHost}:3478`,
        username: process.env.TURN_USERNAME || 'teleconsulta',
        credential: process.env.TURN_PASSWORD || 'SenhaSegura123'
      }
    ];

    // URL do servidor de sinalização WebSocket
    // Em produção, usa o domínio WSS. Em desenvolvimento, usa localhost.
    const signalingServerUrl = process.env.SIGNALING_SERVER_URL ||
      (isProduction ? 'wss://ws.triagem.cliv.app' : 'ws://localhost:3001');

    return NextResponse.json({
      iceServers,
      signalingServerUrl,
      identity,
      room
    });
  } catch (error: any) {
    console.error('Error generating ICE configuration:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
