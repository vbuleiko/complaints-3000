const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { Pool } = require('pg');
const JSZip = require('jszip');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Конфигурация
const DB_CONFIG = {
  connectionString: 'postgresql://admin:admin@localhost:5432/complaints_db'
};

const BITRIX_CONFIG = {
  webhookUrl: 'https://3park.bitrix24.ru/rest/57/9qv8jpcjo8lkmf97/',
  baseUrl: 'https://3park.bitrix24.ru'
};

const DOWNLOAD_DIR = 'C:\\Scripts\\Complains\\answers';
const REQUEST_DELAY = 200; // мс между запросами к Bitrix

// Создаем папку для загрузок
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

class AnswersProcessor {
  constructor() {
    this.pool = new Pool(DB_CONFIG);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateOutNum(bitrixNum) {
    const date = new Date();
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    const yyyy = date.getFullYear();
    return `1-2-${bitrixNum}-${mm}${yy} от ${dd}.${mm}.${yyyy}`;
  }

  async initializeAnswersTable() {
    console.log('Инициализация таблицы answers...');
    
    // Получаем данные из inbox
    const inboxResult = await this.pool.query(`
      SELECT DISTINCT vkh_num, bitrix_num 
      FROM inbox 
      WHERE bitrix_num IS NOT NULL
    `);

    // Добавляем новые записи в answers
    for (const row of inboxResult.rows) {
      await this.pool.query(`
        INSERT INTO answers (vkh_num, bitrix_num, task_status, answer_status) 
        VALUES ($1, $2::text, FALSE, FALSE) 
        ON CONFLICT (bitrix_num) DO NOTHING
      `, [row.vkh_num, row.bitrix_num]);
    }

    console.log(`Проверено ${inboxResult.rows.length} записей из inbox`);
  }

  async updateTaskStatuses() {
    console.log('Обновление статусов задач...');
    
    const result = await this.pool.query('SELECT id, bitrix_num FROM answers WHERE task_status = FALSE');
    
    for (const row of result.rows) {
      await this.sleep(REQUEST_DELAY);
      
      try {
        const response = await axios.get(`${BITRIX_CONFIG.webhookUrl}tasks.task.get.json`, {
          params: { taskId: row.bitrix_num }
        });

        const taskData = response.data?.result?.task;
        const status = taskData?.status;
        const isClosed = parseInt(status) === 5;
        
        await this.pool.query(
          'UPDATE answers SET task_status = $1 WHERE id = $2',
          [isClosed, row.id]
        );

        console.log(`Задача ${row.bitrix_num}: ${isClosed ? 'закрыта' : 'открыта'}`);
      } catch (error) {
        console.error(`Ошибка проверки задачи ${row.bitrix_num}:`, error.message);
      }
    }
  }

  async fetchCommentFiles(taskId) {
    try {
      const response = await axios.get(`${BITRIX_CONFIG.webhookUrl}task.commentitem.getlist`, {
        params: { TASKID: taskId }
      });

      const comments = response.data?.result || [];
      const matchedFiles = [];

      for (const comment of comments) {
        const message = (comment.POST_MESSAGE || comment.MESSAGE || '').toLowerCase();
        
        if (!message.includes('#готово')) {
          continue;
        }

        const attachedObjects = comment.ATTACHED_OBJECTS || {};
        const items = Object.values(attachedObjects);

        for (const fileInfo of items) {
          const fileName = fileInfo.NAME || fileInfo.FILE_NAME;
          let downloadUrl = fileInfo.DOWNLOAD_URL || fileInfo.SRC;
          const fileId = fileInfo.ATTACHMENT_ID || fileInfo.ID || fileInfo.FILE_ID;

          // Если нет прямой ссылки на скачивание, получаем через disk.file.get
          if (!downloadUrl && fileId) {
            const fileResponse = await axios.get(`${BITRIX_CONFIG.baseUrl}/rest/57/9qv8jpcjo8lkmf97/disk.file.get`, {
              params: { id: fileId }
            });
            
            const fileData = fileResponse.data?.result || {};
            downloadUrl = fileData.DOWNLOAD_URL;
          }

          // Проверяем что это doc/docx файл
          if (fileName && downloadUrl && fileName.toLowerCase().match(/\.(doc|docx)$/)) {
            const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${BITRIX_CONFIG.baseUrl}${downloadUrl}`;
            matchedFiles.push({ name: fileName, url: fullUrl });
          }
        }
      }

      return matchedFiles;
    } catch (error) {
      console.error(`Ошибка получения комментариев для задачи ${taskId}:`, error.message);
      return [];
    }
  }

  async downloadFile(fileInfo, taskId, dateStr) {
    try {
      console.log(`Скачиваю '${fileInfo.name}' для задачи ${taskId}...`);

      const response = await axios.get(fileInfo.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.data.byteLength === 0) {
        console.error(`Файл ${fileInfo.name} пустой`);
        return null;
      }

      const newFileName = `${dateStr} - ${taskId} - ${fileInfo.name}`;
      const filePath = path.join(DOWNLOAD_DIR, newFileName);

      fs.writeFileSync(filePath, response.data);

      console.log(`Файл сохранен: ${newFileName} (${response.data.byteLength} bytes)`);
      return filePath;
    } catch (error) {
      console.error(`Ошибка скачивания файла ${fileInfo.name}:`, error.message);
      return null;
    }
  }

  async fillPlaceholdersInDoc(filePath, outNum, vkhNum) {
    try {
      console.log(`Заполнение плейсхолдеров в файле ${path.basename(filePath)}...`);

      const content = fs.readFileSync(filePath, 'binary');
      const zip = new PizZip(content);

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render({
        out_num: outNum,
        vkh_num: vkhNum
      });

      const buf = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE'
      });

      // Если файл .doc, сохраняем как .docx
      let outputPath = filePath;
      if (filePath.toLowerCase().endsWith('.doc')) {
        outputPath = filePath.replace(/\.doc$/i, '.docx');
        console.log(`Конвертация .doc -> .docx: ${path.basename(outputPath)}`);
      }

      fs.writeFileSync(outputPath, buf);
      console.log(`Плейсхолдеры заполнены: out_num=${outNum}, vkh_num=${vkhNum}`);

      return outputPath;
    } catch (error) {
      console.error(`Ошибка заполнения плейсхолдеров:`, error.message);
      return null;
    }
  }


  async processAnswers() {
    console.log('Обработка ответов на задачи...');

    const result = await this.pool.query(`
      SELECT id, vkh_num, bitrix_num
      FROM answers
      WHERE task_status = TRUE AND answer_status = FALSE
    `);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const processedFiles = [];

    for (const row of result.rows) {
      await this.sleep(REQUEST_DELAY);

      console.log(`Обработка задачи ${row.bitrix_num}...`);

      const files = await this.fetchCommentFiles(row.bitrix_num);

      if (files.length > 0) {
        const outNum = this.generateOutNum(row.bitrix_num);

        for (const fileInfo of files) {
          const filePath = await this.downloadFile(fileInfo, row.bitrix_num, dateStr);
          if (filePath) {
            // Заполняем плейсхолдеры (возвращает путь к .docx)
            const docxPath = await this.fillPlaceholdersInDoc(filePath, outNum, row.vkh_num);

            if (docxPath) {
              processedFiles.push(docxPath);
            }
          }
        }

        await this.pool.query(
          'UPDATE answers SET answer_status = TRUE, out_num = $1 WHERE id = $2',
          [outNum, row.id]
        );

        console.log(`Задача ${row.bitrix_num} обработана, out_num: ${outNum}`);
      } else {
        console.log(`Для задачи ${row.bitrix_num} не найдено файлов с #готово`);

        await this.pool.query(
          'UPDATE answers SET answer_status = FALSE WHERE id = $1',
          [row.id]
        );
      }
    }

    if (processedFiles.length > 0) {
      console.log(`Обработано DOCX файлов: ${processedFiles.length}`);
    } else {
      console.log('Нет новых файлов для обработки');
    }
  }

  async createZipArchive(files, dateStr) {
    let counter = 0;
    let zipName;
    let zipPath;

    do {
      const suffix = counter === 0 ? '' : ` - ${counter}`;
      zipName = `${dateStr} - Ответы на жалобы${suffix}.zip`;
      zipPath = path.join(DOWNLOAD_DIR, zipName);
      counter++;
    } while (fs.existsSync(zipPath));

    const zip = new JSZip();

    // Добавляем файлы в архив с сохранением оригинальных имен
    for (const filePath of files) {
      const fileName = path.basename(filePath);
      const fileData = fs.readFileSync(filePath);
      zip.file(fileName, fileData);
    }

    // Генерируем архив
    const content = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    // Сохраняем архив
    fs.writeFileSync(zipPath, content);
    
    console.log(`Создан архив: ${zipName} (${content.length} bytes)`);
    return zipPath;
  }

  async run() {
    try {
      console.log('Запуск обработчика ответов...');
      
      await this.initializeAnswersTable();
      await this.updateTaskStatuses();
      await this.processAnswers();
      
      console.log('Обработка завершена');
    } catch (error) {
      console.error('Ошибка в процессе обработки:', error);
    } finally {
      await this.pool.end();
    }
  }
}

// Запуск скрипта
if (require.main === module) {
  const processor = new AnswersProcessor();
  processor.run();
}

module.exports = AnswersProcessor;