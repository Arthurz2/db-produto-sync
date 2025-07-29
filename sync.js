const { db1, db2 } = require('./db');

// Função auxiliar para valores nulos
const safe = val => (val === undefined ? null : val);

async function syncProductsOptimized() {
  try {
    console.log('Iniciando sincronização otimizada...');
    const startTime = Date.now();

    // 1. Obter produtos ativos do banco origem (db1)
    const [sourceProducts] = await db1.execute(`
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

    // 2. Criar mapa para busca rápida
    const sourceMap = new Map(
      sourceProducts.map(p => [`${p.es1_cod}_${p.es1_empresa}`, p])
    );

    // 3. Obter produtos do banco destino (db2)
    const [targetProducts] = await db2.execute(`
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

    // 4. Verificar atualizações
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

    // 5. Novos produtos a inserir
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

    // 6. Executar UPSERT no banco destino (db2)
    const totalRows = [...updates, ...inserts];
    if (totalRows.length > 0) {
      await db2.query(`
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
  }
}

module.exports = { syncProductsOptimized };
