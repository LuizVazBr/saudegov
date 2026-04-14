import { withAuth } from "next-auth/middleware";

// Usa o middleware oficial do NextAuth para proteger rotas.
// Isso elimina os problemas de leitura manual de cookies via getToken()
// atrás de proxies do Nginx que causavam o ERR_TOO_MANY_REDIRECTS.

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Protege tudo, EXCETO:
  // - API routes (/api/*)
  // - Arquivos estáticos e internos do Next (/_next/static/*, /_next/image/*)
  // - Arquivos com extensão (.png, .json, .js, .svg, .jpeg etc) garantindo manifest e PWA
  // - Rotas públicas (/login, /cadastro)
  matcher: [
    "/((?!api|_next/static|_next/image|login|cadastro|.*\\.[\\w]+$).*)",
  ],
};
