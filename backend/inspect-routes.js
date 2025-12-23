const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'complaints_db',
  user: 'admin',
  password: 'admin',
});

async function queryMany(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function inspectRouteDistribution() {
  try {
    console.log('=== СТРУКТУРА ТАБЛИЦЫ distribution_set ===');
    const distributionColumns = await queryMany(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'distribution_set' 
      ORDER BY ordinal_position
    `);
    console.log('Столбцы distribution_set:', distributionColumns);

    console.log('\n=== СОДЕРЖИМОЕ ТАБЛИЦЫ distribution_set ===');
    const distributionData = await queryMany(`
      SELECT * FROM distribution_set 
      ORDER BY effective_from DESC 
      LIMIT 10
    `);
    console.log('Данные distribution_set:', distributionData);

    console.log('\n=== СТРУКТУРА ТАБЛИЦЫ route_assignment ===');
    const routeColumns = await queryMany(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'route_assignment' 
      ORDER BY ordinal_position
    `);
    console.log('Столбцы route_assignment:', routeColumns);

    console.log('\n=== СОДЕРЖИМОЕ ТАБЛИЦЫ route_assignment ===');
    const routeData = await queryMany(`
      SELECT * FROM route_assignment 
      LIMIT 20
    `);
    console.log('Данные route_assignment:', routeData);

    // Получаем актуальное распределение
    console.log('\n=== АКТУАЛЬНОЕ РАСПРЕДЕЛЕНИЕ ===');
    const latestDistribution = await queryMany(`
      SELECT * FROM distribution_set 
      ORDER BY effective_from DESC 
      LIMIT 1
    `);
    console.log('Последнее распределение:', latestDistribution);

    if (latestDistribution.length > 0) {
      const latestId = latestDistribution[0].id;
      console.log('\n=== МАРШРУТЫ ПО АКТУАЛЬНОМУ РАСПРЕДЕЛЕНИЮ ===');
      const routesByDistribution = await queryMany(`
        SELECT distribution_id, route, column_number 
        FROM route_assignment 
        WHERE distribution_id = $1 
        ORDER BY column_number, route
        LIMIT 20
      `, [latestId]);
      console.log('Маршруты по колоннам:', routesByDistribution);
    }

  } catch (error) {
    console.error('Ошибка:', error.message);
  }
  
  await pool.end();
  process.exit(0);
}

inspectRouteDistribution();