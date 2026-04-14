import { pool } from './pgClient';

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Função de sugestões padrão caso lat/lon não estejam disponíveis ou erro
function getDefaultSuggestions() {
  return {
    maisBuscados: {
      type: "maisBuscados",
      photo: null,
      description: null,
      description_ini: "Sugestões populares para você",
      userRating: "",
    },
    promocoes: {
      type: "promocoes",
      photo: null,
      description: null,
      description_ini: "Promoções disponíveis em vários locais",
      userRating: "",
    },
    entregaRapida: {
      type: "entregaRapida",
      photo: null,
      description: null,
      description_ini: "Entregas rápidas em estabelecimentos selecionados",
      userRating: "",
    },
    menuProximo: {
      type: "menuProximo",
      photo: null,
      description: null,
      description_ini: "Descubra novos menus perto de você",
      userRating: "",
    },
  };
}

export async function getSuggestionsFromDB(lat?: string | null, lon?: string | null) {
  try {
    if (!lat || !lon) return getDefaultSuggestions();

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const radius = 50000;

    const pointGeography = `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;

    const maisBuscadoQuery = `
      SELECT jsonb_array_elements_text(keywords) AS keyword, COUNT(*) AS total
      FROM search_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY keyword
      ORDER BY total DESC
      LIMIT 1
    `;

    const promocoesQuery = `
      SELECT COUNT(*) AS total
      FROM promotions p
      JOIN restaurants r ON p.restaurant_id = r.id
      WHERE p.start_date <= NOW()
        AND p.end_date >= NOW()
        AND r.coordinates IS NOT NULL
        AND ST_DWithin(r.coordinates, ${pointGeography}, $1)
    `;

    const entregaRapidaQuery = `
      SELECT r.name AS nome_estabelecimento, AVG(o.delivery_time_minutes) AS media_tempo
      FROM restaurants r
      JOIN orders o ON o.restaurant_id = r.id
      WHERE o.created_at >= NOW() - INTERVAL '24 hours'
        AND r.coordinates IS NOT NULL
        AND ST_DWithin(r.coordinates, ${pointGeography}, $1)
        AND o.status = 'delivered'
      GROUP BY r.id, r.name
      ORDER BY media_tempo ASC
      LIMIT 1
    `;

    const menuProximoQuery = `
      SELECT m.photo, m.description, m.description_ini
      FROM menus m
      JOIN restaurants r ON m.restaurant_id = r.id
      WHERE r.coordinates IS NOT NULL
        AND ST_DWithin(r.coordinates, ${pointGeography}, $1)
      ORDER BY ST_Distance(r.coordinates, ${pointGeography})
      LIMIT 1
    `;

    const [maisBuscadoResult, promocoesResult, entregaRapidaResult, menuProximoResult] =
      await Promise.all([
        pool.query(maisBuscadoQuery),
        pool.query(promocoesQuery, [radius]),
        pool.query(entregaRapidaQuery, [radius]),
        pool.query(menuProximoQuery, [radius]),
      ]);

    const rowMaisBuscado = maisBuscadoResult.rows[0];
    const rowPromocoes = promocoesResult.rows[0];
    const rowEntrega = entregaRapidaResult.rows[0];
    const rowMenu = menuProximoResult.rows[0];

    return {
      maisBuscados: {
        type: "maisBuscados",
        photo: null,
        description: null,
        description_ini: rowMaisBuscado?.keyword
          ? randomItem([
              `${capitalize(rowMaisBuscado.keyword)} está entre os termos mais buscados hoje.`,
              `Hoje muita gente buscou por ${rowMaisBuscado.keyword}.`,
              `"${capitalize(rowMaisBuscado.keyword)}" foi um dos itens mais procurados nas últimas horas.`,
              `Muita gente com vontade de ${rowMaisBuscado.keyword} por aqui hoje.`,
            ])
          : null,
        userRating: "",
      },
      promocoes: {
        type: "promocoes",
        photo: null,
        description: null,
        description_ini:
          parseInt(rowPromocoes?.total || "0", 10) > 0
            ? randomItem([
                `${rowPromocoes.total} ${rowPromocoes.total === "1" ? "local" : "locais"} está oferecendo promoções agora.`,
                `Aproveite: ${rowPromocoes.total} ${rowPromocoes.total === "1" ? "local" : "locais"} com promoções especiais hoje.`,
                `Promoções rolando em ${rowPromocoes.total} ${rowPromocoes.total === "1" ? "local" : "locais"} perto de você.`,
                `Não perca: ${rowPromocoes.total} ${rowPromocoes.total === "1" ? "local" : "locais"} com descontos neste momento.`,
              ])
            : null,
        userRating: "",
      },
      entregaRapida: {
        type: "entregaRapida",
        photo: null,
        description: null,
        description_ini:
          rowEntrega?.nome_estabelecimento && rowEntrega?.media_tempo
            ? randomItem([
                `${rowEntrega.nome_estabelecimento} tem uma das entregas mais rápidas: média de ${parseFloat(rowEntrega.media_tempo).toFixed(1)} minutos.`,
                `Entrega veloz? ${rowEntrega.nome_estabelecimento} está no topo hoje.`,
                `${rowEntrega.nome_estabelecimento} lidera com entregas em média de ${parseFloat(rowEntrega.media_tempo).toFixed(1)} minutos.`,
                `Tá com pressa? ${rowEntrega.nome_estabelecimento} entrega em cerca de ${parseFloat(rowEntrega.media_tempo).toFixed(1)} minutos.`,
              ])
            : null,
        userRating: "",
      },
      menuProximo: {
        type: "menuProximo",
        photo: rowMenu?.photo || null,
        description: rowMenu?.description || null,
        description_ini: rowMenu?.description_ini || null,
        userRating: "",
      },
    };
  } catch (error: any) {
    console.error("Erro no banco de dados:", error.message, error.stack);
    return getDefaultSuggestions();
  }
}
