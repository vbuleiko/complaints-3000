# Инструкция по настройке автоматического перезапуска приложения

## Описание
Приложение будет автоматически перезапускаться каждый день в 19:30 для загрузки новых данных из БД (данные добавляются в 19:00).

## Созданные файлы

### 1. `stop-app.bat` - Остановка приложения
- Останавливает процессы на портах 3000 (frontend) и 3002 (backend)
- Убивает все процессы Node.js, связанные с приложением
- Записывает логи в `logs\restart.log`

### 2. `start-app.bat` - Запуск приложения
- Запускает backend сервер (порт 3002)
- Ждет 10 секунд для инициализации backend
- Запускает frontend сервер (порт 3000)
- Записывает логи работы в `logs\backend.log` и `logs\frontend.log`

### 3. `logs\` - Папка для логов
- `restart.log` - логи перезапуска
- `backend.log` - логи backend
- `frontend.log` - логи frontend

---

## Настройка планировщика задач Windows (Task Scheduler)

### Способ 1: Через графический интерфейс

#### Задача 1: Остановка приложения (19:30)

1. **Открыть планировщик задач:**
   - Нажмите `Win + R`
   - Введите `taskschd.msc`
   - Нажмите Enter

2. **Создать новую задачу:**
   - В правой панели выберите "Создать задачу..." (Create Task...)

3. **Вкладка "Общие" (General):**
   - Имя: `Complaints App - Stop`
   - Описание: `Остановка приложения в 19:30 для обновления данных`
   - Выберите: "Выполнять для всех пользователей" (Run whether user is logged on or not)
   - ✅ Поставьте галочку: "Выполнить с наивысшими правами" (Run with highest privileges)

4. **Вкладка "Триггеры" (Triggers):**
   - Нажмите "Создать..." (New...)
   - Параметры:
     - Начать задачу: **По расписанию** (On a schedule)
     - Параметры: **Ежедневно** (Daily)
     - Начать: **Выберите сегодняшнюю дату**
     - Время: **19:30:00**
     - Повторять каждые: **1** день
     - ✅ Включено (Enabled)
   - Нажмите OK

5. **Вкладка "Действия" (Actions):**
   - Нажмите "Создать..." (New...)
   - Параметры:
     - Действие: **Запустить программу** (Start a program)
     - Программа или сценарий: `C:\Scripts\complaints-app\stop-app.bat`
     - Рабочая папка: `C:\Scripts\complaints-app`
   - Нажмите OK

6. **Вкладка "Условия" (Conditions):**
   - ❌ Снимите галочки с "Запускать только при питании от сети" (если это ноутбук)
   - ❌ Снимите галочку "Останавливать при переходе на батарею"

7. **Вкладка "Параметры" (Settings):**
   - ✅ Разрешить запуск задачи по требованию (Allow task to be run on demand)
   - ✅ Если задача не выполнена, перезапустить через: **1 минута** (попыток: **3**)
   - ❌ Останавливать задачу, если она выполняется более: **снять галочку**

8. **Сохранить задачу:**
   - Нажмите OK
   - Введите пароль Windows, если потребуется

---

#### Задача 2: Запуск приложения (19:31)

**Повторите шаги 1-8, но с изменениями:**

3. **Вкладка "Общие":**
   - Имя: `Complaints App - Start`
   - Описание: `Запуск приложения в 19:31 после обновления данных`

4. **Вкладка "Триггеры":**
   - Время: **19:31:00** (на 1 минуту позже остановки)

5. **Вкладка "Действия":**
   - Программа или сценарий: `C:\Scripts\complaints-app\start-app.bat`

---

### Способ 2: Через PowerShell (быстрая настройка)

Скопируйте и выполните эти команды в PowerShell **от имени администратора**:

```powershell
# Задача 1: Остановка в 19:30
$action1 = New-ScheduledTaskAction -Execute "C:\Scripts\complaints-app\stop-app.bat" -WorkingDirectory "C:\Scripts\complaints-app"
$trigger1 = New-ScheduledTaskTrigger -Daily -At "19:30"
$principal1 = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
$settings1 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "Complaints App - Stop" -Action $action1 -Trigger $trigger1 -Principal $principal1 -Settings $settings1 -Description "Остановка приложения в 19:30 для обновления данных"

# Задача 2: Запуск в 19:31
$action2 = New-ScheduledTaskAction -Execute "C:\Scripts\complaints-app\start-app.bat" -WorkingDirectory "C:\Scripts\complaints-app"
$trigger2 = New-ScheduledTaskTrigger -Daily -At "19:31"
$principal2 = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
$settings2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "Complaints App - Start" -Action $action2 -Trigger $trigger2 -Principal $principal2 -Settings $settings2 -Description "Запуск приложения в 19:31 после обновления данных"
```

---

## Проверка работы

### 1. Тестирование bat-файлов вручную:
```cmd
# Остановка
C:\Scripts\complaints-app\stop-app.bat

# Запуск
C:\Scripts\complaints-app\start-app.bat
```

### 2. Тестирование задач в планировщике:
1. Откройте планировщик задач (`taskschd.msc`)
2. Найдите задачу "Complaints App - Stop"
3. Щелкните правой кнопкой → "Выполнить" (Run)
4. Проверьте логи в `C:\Scripts\complaints-app\logs\restart.log`
5. Повторите для задачи "Complaints App - Start"

### 3. Проверка логов:
```cmd
# Посмотреть лог перезапуска
type "C:\Scripts\complaints-app\logs\restart.log"

# Посмотреть логи backend
type "C:\Scripts\complaints-app\logs\backend.log"

# Посмотреть логи frontend
type "C:\Scripts\complaints-app\logs\frontend.log"
```

---

## Важные замечания

1. **Права администратора:** Убедитесь, что задачи выполняются с правами администратора
2. **Пароль:** При создании задачи может потребоваться ввести пароль Windows
3. **Первый запуск:** Рекомендуется протестировать перезапуск вручную перед автоматическим выполнением
4. **Логи:** Регулярно проверяйте логи для отслеживания проблем
5. **Время запуска:** Если данные добавляются в 19:00, а перезапуск в 19:30 - это оптимальное время

---

## Удаление задач (если нужно)

### Через графический интерфейс:
1. Откройте планировщик задач
2. Найдите задачу
3. Щелкните правой кнопкой → "Удалить"

### Через PowerShell:
```powershell
Unregister-ScheduledTask -TaskName "Complaints App - Stop" -Confirm:$false
Unregister-ScheduledTask -TaskName "Complaints App - Start" -Confirm:$false
```

---

## Поддержка

При возникновении проблем:
1. Проверьте логи в папке `logs\`
2. Убедитесь, что пути к файлам корректны
3. Проверьте права доступа к файлам
4. Убедитесь, что Node.js установлен и доступен в PATH
