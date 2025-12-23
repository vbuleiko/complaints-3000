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

async function inspectBranch() {
  try {
    console.log('=== СТРУКТУРА ТАБЛИЦЫ branch ===');
    const columns = await queryMany(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'branch' 
      ORDER BY ordinal_position
    `);
    console.log('Столбцы:', columns);

    console.log('\n=== СОДЕРЖИМОЕ ТАБЛИЦЫ branch ===');
    const data = await queryMany('SELECT * FROM branch ORDER BY column_no LIMIT 20');
    console.log('Данные:', data);

  } catch (error) {
    console.error('Ошибка:', error.message);
    
    // Если нет доступа к branch, попробуем получить данные из основных таблиц
    console.log('\n=== ПРОБУЕМ ПОЛУЧИТЬ ДАННЫЕ О КОЛОННАХ ИЗ ОСНОВНЫХ ТАБЛИЦ ===');
    try {
      const columnData = await queryMany(`
        SELECT DISTINCT column_no 
        FROM ob 
        WHERE column_no IS NOT NULL 
        ORDER BY column_no 
        LIMIT 20
      `);
      console.log('Колонны из ob:', columnData);
      
      const columnData30 = await queryMany(`
        SELECT DISTINCT column_no 
        FROM data_01_30 
        WHERE column_no IS NOT NULL 
        ORDER BY column_no 
        LIMIT 20
      `);
      console.log('Колонны из data_01_30:', columnData30);
    } catch (err) {
      console.error('Ошибка получения данных о колоннах:', err.message);
    }
  }
  
  await pool.end();
  process.exit(0);
}

inspectBranch();