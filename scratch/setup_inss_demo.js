const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:De%7Ds98%7Dp.Ji9GuVbr97C%40@localhost:5432/anamnex'
});

async function setup() {
  const client = await pool.connect();
  try {
    console.log("🚀 Iniciando configuração do banco para Demo INSS...");

    // 1. Criar Tabelas
    await client.query(`
      CREATE TABLE IF NOT EXISTS paciente_doencas (
        id SERIAL PRIMARY KEY,
        paciente_nome VARCHAR(255),
        cpf VARCHAR(14),
        doenca VARCHAR(100), -- 'Diabetes', 'Hipertensão', 'Asma'
        status VARCHAR(50), -- 'Monitorado', 'Crítico'
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS paciente_score (
        id SERIAL PRIMARY KEY,
        cpf VARCHAR(14),
        score_incapacidade INT, -- 0 a 100
        risco VARCHAR(50), -- 'Baixo', 'Moderado', 'Alto'
        custo_estimado DECIMAL(12, 2),
        data_analise TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Tabelas criadas com sucesso.");

    // 2. Limpar dados antigos para a demo
    await client.query("DELETE FROM paciente_doencas");
    await client.query("DELETE FROM paciente_score");

    // 3. Gerar Dados Mock (Focados em Araguaína, TO)
    const centro = { lat: -7.2185, lng: -48.2144 };
    const doencas = ["Diabetes", "Hipertensão", "Asma", "DPOC"];
    const nomes = ["Augusto Silva", "Maria Oliveira", "João Santos", "Clara Mendes", "Ricardo Lima", "Sonia Ferreira", "Paulo Souza", "Elena Rocha"];

    for (let i = 0; i < 50; i++) {
      const lat = centro.lat + (Math.random() - 0.5) * 0.05;
      const lng = centro.lng + (Math.random() - 0.5) * 0.05;
      const d = doencas[Math.floor(Math.random() * doencas.length)];
      const n = nomes[Math.floor(Math.random() * nomes.length)] + " " + i;
      const cpf = `123.456.789-${(10 + i).toString().slice(-2)}`;
      const score = Math.floor(Math.random() * 100);
      const risco = score > 70 ? 'Alto' : score > 40 ? 'Moderado' : 'Baixo';
      const custo = score * 5000;

      await client.query(
        "INSERT INTO paciente_doencas (paciente_nome, cpf, doenca, status, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6)",
        [n, cpf, d, score > 80 ? 'Crítico' : 'Monitorado', lat, lng]
      );

      await client.query(
        "INSERT INTO paciente_score (cpf, score_incapacidade, risco, custo_estimado) VALUES ($1, $2, $3, $4)",
        [cpf, score, risco, custo]
      );
    }

    console.log("✅ Dados de demonstração (50 pacientes) gerados em Araguaína.");
    
    // 4. Garantir que existam unidades de teste com status
    // Opcional: Adiciona campo status_operacional se não existir
    await client.query(`
       DO $$ 
       BEGIN 
         IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='unidades_teste' AND column_name='status_operacional') THEN
           ALTER TABLE unidades_teste ADD COLUMN status_operacional VARCHAR(50) DEFAULT 'Normal';
         END IF;
       END $$;
    `);

    console.log("🏁 Configuração concluída!");
  } catch (err) {
    console.error("❌ Erro no setup:", err);
  } finally {
    client.release();
    process.exit();
  }
}

setup();
