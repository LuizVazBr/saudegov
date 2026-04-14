const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Configuração do Socket.IO com CORS
const io = new Server(server, {
    cors: {
        origin: "*", // Permitir qualquer origem (desenvolvimento)
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Armazenar informações das salas
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] Cliente conectado: ${socket.id}`);

    // Entrar em uma sala
    socket.on('join-room', ({ roomName, identity }) => {
        console.log(`[${new Date().toISOString()}] ${identity} (${socket.id}) entrando na sala: ${roomName}`);

        socket.join(roomName);
        socket.roomName = roomName;
        socket.identity = identity;

        // Adicionar à lista de participantes da sala
        if (!rooms.has(roomName)) {
            rooms.set(roomName, new Map());
        }
        rooms.get(roomName).set(socket.id, { identity, socketId: socket.id });

        // Notificar outros participantes
        const participants = Array.from(rooms.get(roomName).values());
        socket.to(roomName).emit('user-joined', {
            socketId: socket.id,
            identity,
            participants
        });

        // Enviar lista de participantes existentes para o novo usuário
        const existingParticipants = participants.filter(p => p.socketId !== socket.id);
        socket.emit('existing-participants', existingParticipants);

        console.log(`[${new Date().toISOString()}] Sala ${roomName} agora tem ${participants.length} participante(s)`);
    });

    // Encaminhar oferta WebRTC
    socket.on('offer', ({ to, offer }) => {
        console.log(`[${new Date().toISOString()}] Encaminhando oferta de ${socket.id} para ${to}`);
        io.to(to).emit('offer', {
            from: socket.id,
            offer,
            identity: socket.identity
        });
    });

    // Encaminhar resposta WebRTC
    socket.on('answer', ({ to, answer }) => {
        console.log(`[${new Date().toISOString()}] Encaminhando resposta de ${socket.id} para ${to}`);
        io.to(to).emit('answer', {
            from: socket.id,
            answer
        });
    });

    // Encaminhar ICE candidate
    socket.on('ice-candidate', ({ to, candidate }) => {
        console.log(`[${new Date().toISOString()}] Encaminhando ICE candidate de ${socket.id} para ${to}`);
        io.to(to).emit('ice-candidate', {
            from: socket.id,
            candidate
        });
    });

    // Sair da sala
    socket.on('leave-room', () => {
        handleDisconnect(socket);
    });

    // Desconexão
    socket.on('disconnect', () => {
        console.log(`[${new Date().toISOString()}] Cliente desconectado: ${socket.id}`);
        handleDisconnect(socket);
    });
});

function handleDisconnect(socket) {
    if (socket.roomName) {
        const room = rooms.get(socket.roomName);
        if (room) {
            const participant = room.get(socket.id);
            room.delete(socket.id);

            // Notificar outros participantes
            socket.to(socket.roomName).emit('user-left', {
                socketId: socket.id,
                identity: socket.identity
            });

            console.log(`[${new Date().toISOString()}] ${socket.identity} saiu da sala ${socket.roomName}`);

            // Remover sala se estiver vazia
            if (room.size === 0) {
                rooms.delete(socket.roomName);
                console.log(`[${new Date().toISOString()}] Sala ${socket.roomName} removida (vazia)`);
            }
        }
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        rooms: rooms.size,
        connections: io.engine.clientsCount,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Servidor de sinalização rodando na porta ${PORT}`);
    console.log(`[${new Date().toISOString()}] Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});
