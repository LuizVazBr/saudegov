// src/lib/AuthOptions.ts
import CredentialsProvider from "next-auth/providers/credentials";
import { pool } from "@/lib/pgClient";
import bcrypt from "bcrypt";
import { redis } from "@/lib/redis";
import type { AuthOptions, SessionStrategy } from "next-auth";
import type { JWT } from "next-auth/jwt";

// TTL
const REDIS_TTL = 3600; // 1 hora para configs no Redis

// Tipagem adicional
declare module "next-auth" {
  interface User {
    id: string;
    documento: string;
    tipo_usuario?: string;
    telefone?: string;
    telefone_whatsapp?: boolean;
    sexo?: string;
    email?: string;
    numero_sus?: string;
    data_nascimento?: string;
    is_monitored?: boolean;
    config?: Record<string, any>;
  }

  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    documento: string;
    tipo_usuario?: string;
    telefone?: string;
    telefone_whatsapp?: boolean;
    sexo?: string;
    email?: string;
    numero_sus?: string;
    data_nascimento?: string;
    is_monitored?: boolean;
    config?: Record<string, any>;
  }
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        cpf: { label: "CPF", type: "text", placeholder: "000.000.000-00" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.cpf || !credentials?.password) {
          throw new Error("CPF ou senha não informados");
        }

        const cpfLimpo = credentials.cpf.replace(/\D/g, "");
        const client = await pool.connect();

        try {
          // Buscar usuário
          const res = await client.query(
            `SELECT u.*, CASE WHEN pm.usuario_id IS NOT NULL THEN TRUE ELSE FALSE END as is_monitored 
             FROM usuarios u 
             LEFT JOIN pacientes_monitorados pm ON u.id = pm.usuario_id 
             WHERE u.documento = $1`,
            [cpfLimpo]
          );
          if (res.rowCount === 0) throw new Error("CPF ou senha inválidos");

          const user = res.rows[0];

          // Validar senha
          const isValid = await bcrypt.compare(credentials.password, user.senha_hash);
          if (!isValid) throw new Error("CPF ou senha inválidos");

          // Pegar configuração do Redis ou banco
          const redisKey = `user_config:${user.id}`;
          let configStr = await redis.get(redisKey);
          let config;
          if (configStr) {
            config = JSON.parse(configStr);
          } else {
            const resConfig = await client.query(
              `SELECT config FROM user_config WHERE user_id = $1`,
              [user.id]
            );
            config = resConfig?.rowCount ? resConfig.rows[0].config : {};
            await redis.set(redisKey, JSON.stringify(config), "EX", REDIS_TTL);
          }

          // Retornar usuário completo
          return {
            id: user.id,
            name: user.nome,
            documento: user.documento,
            tipo_usuario: user.tipo_usuario?.toLowerCase().trim(),
            telefone: user.telefone,
            telefone_whatsapp: user.telefone_whatsapp,
            sexo: user.sexo,
            email: user.email,
            numero_sus: user.numero_sus,
            data_nascimento: user.data_nascimento,
            is_monitored: user.is_monitored,
            config,
          };
        } finally {
          client.release();
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        return { ...token, ...user };
      }

      // Ensure tipo_usuario is present
      if (!token?.tipo_usuario && token?.id) {
        try {
          const client = await pool.connect();
          const res = await client.query(`SELECT tipo_usuario FROM usuarios WHERE id = $1`, [token.id]);
          client.release();
          if (res.rowCount) {
            token.tipo_usuario = res.rows[0].tipo_usuario?.toLowerCase().trim();
          }
        } catch (e) {
          console.error("Erro fetching missing role", e);
        }
      }

      // [FIX] Sempre tentar atualizar a config do Redis para garantir dados frescos
      if (token?.id) {
        try {
          const redisKey = `user_config:${token.id}`;
          const cachedConfig = await redis.get(redisKey);
          if (cachedConfig) {
            token.config = JSON.parse(cachedConfig);
          }
        } catch (e) {
          // Silenciosamente ignora erro no Redis para não bloquear, usa o que tem
        }
      }

      // Se for uma atualização disparada pelo cliente (update())
      if (trigger === "update" && token?.id) {
        // Re-fetch user data completely from DB to ensure fresh token
        try {
          const client = await pool.connect();
          const res = await client.query(`SELECT * FROM usuarios WHERE id = $1`, [token.id]);
          client.release();

          if (res.rows.length > 0) {
            const freshUser = res.rows[0];
            // Merge fresh data
            token.name = freshUser.nome;
            token.tipo_usuario = freshUser.tipo_usuario?.toLowerCase().trim();
            token.telefone = freshUser.telefone;
            token.numero_sus = freshUser.numero_sus;
            token.email = freshUser.email;
            token.sexo = freshUser.sexo;
            token.data_nascimento = freshUser.data_nascimento;
          }
        } catch (e) {
          console.error("Erro refreshing user data", e);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token?.id) {
        session.user = {
          id: token.id,
          name: token.name,
          documento: token.documento,
          tipo_usuario: token.tipo_usuario,
          telefone: token.telefone,
          telefone_whatsapp: token.telefone_whatsapp,
          sexo: token.sexo,
          email: token.email,
          numero_sus: token.numero_sus,
          data_nascimento: token.data_nascimento,
          is_monitored: token.is_monitored,
          config: token.config,
        };
      }
      return session;
    },
  },

  session: {
    strategy: "jwt" as SessionStrategy,
    maxAge: 24 * 60 * 60, // 1 dia
  },

  pages: {
    signIn: "/login",
    signOut: "/login",
  },

  useSecureCookies: process.env.NODE_ENV === "production",

  // 🔹 Use custom cookie names to circumvent Next.js protocol guessing behind proxies
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  debug: process.env.NODE_ENV === "development",
};
