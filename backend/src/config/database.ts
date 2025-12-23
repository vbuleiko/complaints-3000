import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Конфигурация подключения к базе данных
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'complaints_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'admin',
  
  // Настройки пула соединений
  max: 20, // максимальное количество соединений в пуле
  min: 2,  // минимальное количество соединений
  idleTimeoutMillis: 30000, // время жизни простоя соединения
  connectionTimeoutMillis: 10000, // таймаут подключения
  
  // Настройки SSL (отключены для локальной разработки)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Создаем пул соединений
export const pool = new Pool(dbConfig);

// Конфигурация подключения к ANALYTICS_DB
const analyticsDbConfig = {
  host: 'supper-01',
  port: 5434,
  database: 'analyticsdb',
  user: 'analytics_inner_viewer',
  password: 'inner_analytics1',
  
  // Настройки пула соединений
  max: 10, // меньший пул для аналитики
  min: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  
  ssl: false,
};

// Создаем пул соединений для ANALYTICS_DB
export const analyticsPool = new Pool(analyticsDbConfig);

// Обработчики событий пула
pool.on('connect', (client) => {
  console.log('🔗 Новое соединение с базой данных установлено');
});

pool.on('error', (err, client) => {
  console.error('💥 Ошибка соединения с базой данных:', err);
});

pool.on('acquire', (client) => {
  console.log('🎯 Соединение получено из пула');
});

pool.on('release', (client) => {
  console.log('🔄 Соединение возвращено в пул');
});

// Функция для проверки подключения к базе данных
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    console.log('✅ Подключение к базе данных успешно:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error);
    return false;
  }
};

// Функция для выполнения запросов с обработкой ошибок
export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    console.log('📊 Выполнен запрос:', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    console.error('💥 Ошибка выполнения запроса:', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    });
    
    throw error;
  }
};

// Функция для получения одной записи
export const queryOne = async (text: string, params?: any[]): Promise<any | null> => {
  const result = await query(text, params);
  return result.rows.length > 0 ? result.rows[0] : null;
};

// Функция для получения множества записей
export const queryMany = async (text: string, params?: any[]): Promise<any[]> => {
  const result = await query(text, params);
  return result.rows;
};

// Функции для работы с ANALYTICS_DB
export const analyticsQuery = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  
  try {
    const result = await analyticsPool.query(text, params);
    const duration = Date.now() - start;
    
    console.log('📊 Выполнен запрос к ANALYTICS_DB:', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    console.error('💥 Ошибка выполнения запроса к ANALYTICS_DB:', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка',
    });
    
    throw error;
  }
};

export const analyticsQueryMany = async (text: string, params?: any[]): Promise<any[]> => {
  const result = await analyticsQuery(text, params);
  return result.rows;
};

// Функция для транзакций
export const transaction = async (callback: (client: any) => Promise<any>): Promise<any> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Функция для проверки подключения к ANALYTICS_DB
export const testAnalyticsDatabaseConnection = async (): Promise<boolean> => {
  try {
    const client = await analyticsPool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    console.log('✅ Подключение к ANALYTICS_DB успешно:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к ANALYTICS_DB:', error);
    return false;
  }
};

// Проверяем подключения при загрузке модуля
testDatabaseConnection();
testAnalyticsDatabaseConnection();