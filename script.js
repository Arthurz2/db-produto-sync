const express = require('express');
const cron = require('node-cron');
const mysql = require('mysql2/promise');
const app = express();
const PORT = 3000;

// Configurações dos bancos de dados
const sourceDbConfig = {
  host: 'hd5080kec11.sn.mynetname.net',
  user: 'adminlinear',
  password: '@2013linear',
  database: 'sglinx'
};

const targetDbConfig = {
  host: '177.153.51.83',
  user: 'adminlinear',
  password: '@2013linear',
  database: 'sglinx',
  port: 33066
};

// Função auxiliar para valores nulos
const safe = val => (val === undefined ? null : val);

// Função principal de sincronização
async function syncProductsOptimized() {
  let connectionSource, connectionTarget;
  try {
    console.log('Iniciando sincronização otimizada...');
    const startTime = Date.now();

    connectionSource = await mysql.createConnection(sourceDbConfig);
    connectionTarget = await mysql.createConnection(targetDbConfig);

    const [sourceProducts] = await connectionSource.execute(`
      SELECT
        es1.es1_cod,
        es1.es1_empresa,
        es1.es1_qembc,
        es1.es1_prvarejo,
        es1.es1_prpromocao,
        es1a.es1_codbarra,
        es1a.es1_umvenda,
        es1a.es1_descembalagem
      FROM es1
      JOIN es1a ON es1.es1_cod = es1a.es1_cod
      WHERE es1.es1_empresa = 1 AND es1.es1_ativo = 1
    `);

    const sourceMap = new Map(
      sourceProducts.map(p => [`${p.es1_cod}_${p.es1_empresa}`, p])
    );

    const [targetProducts] = await connectionTarget.execute(`
      SELECT
        es1_cod,
        es1_empresa,
        es1_qembc,
        es1_prvarejo,
        es1_prpromocao,
        es1_codbarra,
        es1_umvenda,
        es1_descembalagem
      FROM produtos
      WHERE es1_empresa = 1
    `);

    const updates = [];
    const inserts = [];
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let unchangedCount = 0;

    targetProducts.forEach(targetProduct => {
      const key = `${targetProduct.es1_cod}_${targetProduct.es1_empresa}`;
      const sourceProduct = sourceMap.get(key);

      if (sourceProduct) {
        const hasChanges = (
          targetProduct.es1_qembc !== sourceProduct.es1_qembc ||
          targetProduct.es1_prvarejo !== sourceProduct.es1_prvarejo ||
          targetProduct.es1_prpromocao !== sourceProduct.es1_prpromocao ||
          targetProduct.es1_codbarra !== sourceProduct.es1_codbarra ||
          targetProduct.es1_umvenda !== sourceProduct.es1_umvenda ||
          targetProduct.es1_descembalagem !== sourceProduct.es1_descembalagem
        );

        if (hasChanges) {
          updates.push([
            sourceProduct.es1_cod,
            sourceProduct.es1_empresa,
            sourceProduct.es1_qembc,
            sourceProduct.es1_prvarejo,
            sourceProduct.es1_prpromocao,
            safe(sourceProduct.es1_codbarra),
            safe(sourceProduct.es1_umvenda),
            safe(sourceProduct.es1_descembalagem),
            now,
            1
          ]);
        } else {
          unchangedCount++;
        }

        sourceMap.delete(key);
      }
    });

    // Novos registros
    sourceMap.forEach(sourceProduct => {
      inserts.push([
        sourceProduct.es1_cod,
        sourceProduct.es1_empresa,
        sourceProduct.es1_qembc,
        sourceProduct.es1_prvarejo,
        sourceProduct.es1_prpromocao,
        safe(sourceProduct.es1_codbarra),
        safe(sourceProduct.es1_umvenda),
        safe(sourceProduct.es1_descembalagem),
        now,
        1
      ]);
    });

    // Executar UPSERT (update ou insert) em lote
    const totalRows = [...updates, ...inserts];
    if (totalRows.length > 0) {
      await connectionTarget.query(`
        INSERT INTO produtos (
          es1_cod, es1_empresa, es1_qembc, es1_prvarejo, es1_prpromocao,
          es1_codbarra, es1_umvenda, es1_descembalagem, data_importacao, ativo
        ) VALUES ?
        ON DUPLICATE KEY UPDATE
          es1_qembc = VALUES(es1_qembc),
          es1_prvarejo = VALUES(es1_prvarejo),
          es1_prpromocao = VALUES(es1_prpromocao),
          es1_codbarra = VALUES(es1_codbarra),
          es1_umvenda = VALUES(es1_umvenda),
          es1_descembalagem = VALUES(es1_descembalagem),
          data_importacao = VALUES(data_importacao),
          ativo = VALUES(ativo)
      `, [totalRows]);
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`Sincronização concluída em ${duration.toFixed(2)} segundos:
  - ${updates.length} produtos atualizados
  - ${inserts.length} novos produtos inseridos
  - ${unchangedCount} produtos sem alterações`);

  } catch (error) {
    console.error('Erro na sincronização:', error.message);
    console.error(error.stack);
  } finally {
    if (connectionSource) await connectionSource.end();
    if (connectionTarget) await connectionTarget.end();
  }
}

// Executa ao iniciar
syncProductsOptimized();

// Executa a cada hora
cron.schedule('0 * * * *', syncProductsOptimized);

// Inicia a API
app.listen(PORT, () => {
  console.log(`API de sincronização rodando na porta ${PORT}`);
});
