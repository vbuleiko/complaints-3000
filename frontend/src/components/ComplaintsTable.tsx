import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Button, 
  Tag, 
  Input, 
  Select, 
  Card, 
  DatePicker,
  Switch,
  message
} from 'antd';
import { 
  LinkOutlined, 
  EditOutlined, 
  EyeOutlined, 
  EyeInvisibleOutlined,
  FileTextOutlined,
  SearchOutlined,
  ReloadOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { Complaint, ResolutionTemplate, ComplaintFilters, REPORT_TYPE_LABELS, PRIORITY_LABELS, PRIORITY_EMOJIS, SEEN_LABELS, SEEN_COLORS } from '../types';
import { complaintsApi } from '../services/api';
import ResolutionModal from './ResolutionModal';
import StatisticsModal from './StatisticsModal';
import './ComplaintsTable.css';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const ComplaintsTable: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ResolutionTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [resolutionModalVisible, setResolutionModalVisible] = useState(false);
  const [statisticsVisible, setStatisticsVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Создаем начальные фильтры: последние 30 дней, все статусы принятия, доклад "Не требуется"
  const getDefaultFilters = (): ComplaintFilters => {
    const savedCategories = localStorage.getItem('complaints_categories');
    return {
      date_from: dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
      date_to: dayjs().format('YYYY-MM-DD'),
      seen_status: undefined, // Показываем все статусы
      category: savedCategories ? JSON.parse(savedCategories) : undefined,
      types: ['Жалобы', 'Проверки'], // По умолчанию показываем все типы
      report_type: [0], // По умолчанию выбираем "Не требуется"
    };
  };

  const [filters, setFilters] = useState<ComplaintFilters>(getDefaultFilters());

  useEffect(() => {
    loadInitialData();
  }, []);

  // Загружаем жалобы с текущими фильтрами
  const loadComplaints = useCallback(async (customFilters?: ComplaintFilters) => {
    try {
      setLoading(true);
      const filtersToUse = customFilters || filters;
      const data = await complaintsApi.getComplaints(filtersToUse);
      setComplaints(data);
    } catch (error) {
      message.error('Ошибка загрузки жалоб');
      console.error('Error loading complaints:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [categoriesData, templatesData] = await Promise.all([
        complaintsApi.getCategories(),
        complaintsApi.getResolutionTemplates(),
      ]);
      
      setCategories(categoriesData);
      setTemplates(templatesData);
      
      // Загружаем жалобы с начальными фильтрами
      const initialFilters = getDefaultFilters();
      const data = await complaintsApi.getComplaints(initialFilters);
      setComplaints(data);
    } catch (error) {
      message.error('Ошибка загрузки данных');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeenToggle = async (complaint: Complaint) => {
    try {
      // Циклическое переключение: 0 → 1 → 2 → 0
      const newStatus = (complaint.seen + 1) % 3;

      await complaintsApi.updateSeenStatus(complaint.id, newStatus, complaint.record_type);
      message.success(`Статус изменен на "${SEEN_LABELS[newStatus]}"`);

      // Обновляем локальное состояние, чтобы изменение было видно сразу
      setComplaints(prev => prev.map(c =>
        c.id === complaint.id ? { ...c, seen: newStatus } : c
      ));
    } catch (error) {
      message.error('Ошибка обновления статуса');
    }
  };

  const handleReportTypeChange = async (complaint: Complaint) => {
    try {
      const newType = (complaint.report_type + 1) % 3;
      await complaintsApi.updateReportType(complaint.id, newType, complaint.record_type);

      message.success('Тип доклада изменен');

      // Обновляем локальное состояние, автоматически меняя seen на 1 если был 0
      setComplaints(prev => prev.map(c =>
        c.id === complaint.id ? {
          ...c,
          report_type: newType,
          seen: c.seen === 0 ? 1 : c.seen // Автоматически меняем на "Не принято"
        } : c
      ));
    } catch (error) {
      message.error('Ошибка изменения типа доклада');
    }
  };

  const handlePriorityToggle = async (complaint: Complaint) => {
    try {
      const newPriority = (complaint.priority + 1) % 3;
      await complaintsApi.updatePriority(complaint.id, newPriority, complaint.record_type);

      message.success(`Приоритет изменен на "${PRIORITY_LABELS[newPriority]}"`);

      // Обновляем локальное состояние, автоматически меняя seen на 1 если был 0
      setComplaints(prev => prev.map(c =>
        c.id === complaint.id ? {
          ...c,
          priority: newPriority,
          seen: c.seen === 0 ? 1 : c.seen // Автоматически меняем на "Не принято"
        } : c
      ));
    } catch (error) {
      message.error('Ошибка изменения приоритета');
    }
  };

  const openResolutionModal = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setResolutionModalVisible(true);
  };

  const handleResolutionSave = async (updatedComplaint: Complaint) => {
    setResolutionModalVisible(false);
    setSelectedComplaint(null);

    // Обновляем локальное состояние, автоматически меняя seen на 1 если был 0
    setComplaints(prev => prev.map(c =>
      c.id === updatedComplaint.id ? {
        ...updatedComplaint,
        seen: updatedComplaint.seen === 0 ? 1 : updatedComplaint.seen // Автоматически меняем на "Не принято"
      } : c
    ));

    message.success('Резолюция сохранена');
  };

  const handleTemplatesUpdated = async () => {
    try {
      const templatesData = await complaintsApi.getResolutionTemplates();
      setTemplates(templatesData);
    } catch (error) {
      message.error('Ошибка обновления шаблонов');
      console.error('Error updating templates:', error);
    }
  };

  const getBitrixUrl = (bitrixNum: string) => {
    return `https://3park.bitrix24.ru/company/personal/user/33/tasks/task/view/${bitrixNum}/`;
  };

  const getReportTypeStatus = (type: number) => ({
    color: type === 0 ? 'success' : type === 1 ? 'warning' : 'error',
    text: REPORT_TYPE_LABELS[type]
  });

  const formatFee = (fee?: number): string => {
    if (!fee) return '0.00';
    
    // Округляем до двух знаков после запятой
    const rounded = Math.round(fee * 100) / 100;
    
    // Форматируем с разделителем тысяч
    return rounded.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleFiltersChange = (key: keyof ComplaintFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // Сохраняем категории в localStorage
    if (key === 'category') {
      localStorage.setItem('complaints_categories', JSON.stringify(value || []));
    }
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        date_from: dates[0].format('YYYY-MM-DD'),
        date_to: dates[1].format('YYYY-MM-DD'),
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        date_from: undefined,
        date_to: undefined,
      }));
    }
  };


  const columns: ColumnsType<Complaint> = [
    {
      title: 'Тип',
      dataIndex: 'record_type',
      key: 'record_type',
      width: 80,
      align: 'center',
      render: (type: string) => (
        <span style={{
          fontWeight: 500,
          color: type === 'Жалоба' ? '#ff4d4f' : '#1890ff'
        }}>
          {type}
        </span>
      ),
    },
    {
      title: '№ задачи',
      dataIndex: 'bitrix_num',
      key: 'bitrix_num',
      width: 90,
      align: 'center',
      render: (bitrixNum: string) => (
        <Button
          type="link"
          size="small"
          icon={<LinkOutlined />}
          onClick={() => window.open(getBitrixUrl(bitrixNum), '_blank')}
          className="bitrix-link"
        >
          {bitrixNum}
        </Button>
      ),
    },
    {
      title: 'Разбор',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (status: boolean) => (
        <span
          style={{ fontSize: '20px', cursor: 'default' }}
          title={status ? 'Разбор завершен' : 'Проводится разбор'}
        >
          {status ? '✅' : '⏳'}
        </span>
      ),
    },
    {
      title: 'Дата',
      dataIndex: 'event_date',
      key: 'event_date',
      width: 90,
      align: 'center',
      render: (date: string) => date ? new Date(date).toLocaleDateString('ru-RU') : '-',
    },
    {
      title: 'Текст события',
      dataIndex: 'message_text',
      key: 'message_text',
      width: 1300,
      align: 'center',
      render: (text: string) => (
        <div style={{
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          maxWidth: '1280px',
          lineHeight: '1.4',
          textAlign: 'left'
        }}>
          {text}
        </div>
      ),
    },
    {
      title: 'Ущерб',
      dataIndex: 'fee',
      key: 'fee',
      width: 120,
      align: 'center',
      render: (fee: number) => (
        <span style={{ fontFamily: 'monospace' }}>
          {formatFee(fee)}
        </span>
      ),
    },
    {
      title: 'Приоритет',
      key: 'priority',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <span
          style={{ fontSize: '20px', cursor: 'pointer' }}
          onClick={() => handlePriorityToggle(record)}
          title={PRIORITY_LABELS[record.priority]}
        >
          {PRIORITY_EMOJIS[record.priority]}
        </span>
      ),
    },
    {
      title: 'Резолюция',
      key: 'resolution',
      width: 110,
      align: 'center',
      render: (_, record) => {
        const hasResolution = !!record.resolution_final;
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              type={hasResolution ? "default" : "primary"}
              size="small"
              icon={<EditOutlined />}
              onClick={() => openResolutionModal(record)}
              style={{
                backgroundColor: hasResolution ? '#52c41a' : '#fa8c16',
                borderColor: hasResolution ? '#52c41a' : '#fa8c16',
                color: 'white',
                width: '95px',
                fontSize: '11px'
              }}
            >
              {hasResolution ? 'Изменить' : 'Добавить'}
            </Button>
          </div>
        );
      },
    },
    {
      title: 'Принято',
      key: 'seen',
      width: 110,
      align: 'center',
      render: (_, record) => {
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => handleSeenToggle(record)}
              style={{
                backgroundColor: SEEN_COLORS[record.seen],
                borderColor: SEEN_COLORS[record.seen],
                color: 'white',
                width: '110px',
                fontSize: '11px'
              }}
            >
              {SEEN_LABELS[record.seen]}
            </Button>
          </div>
        );
      },
    },
    {
      title: 'Вид доклада',
      key: 'report_type',
      width: 110,
      align: 'center',
      render: (_, record) => {
        const status = getReportTypeStatus(record.report_type);
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => handleReportTypeChange(record)}
              style={{
                backgroundColor: status.color === 'success' ? '#52c41a' :
                                status.color === 'warning' ? '#fa8c16' : '#ff4d4f',
                borderColor: status.color === 'success' ? '#52c41a' :
                            status.color === 'warning' ? '#fa8c16' : '#ff4d4f',
                color: 'white',
                width: '95px',
                fontSize: '11px'
              }}
            >
              {status.text}
            </Button>
          </div>
        );
      },
    },
    {
      title: 'Текст резолюции',
      dataIndex: 'resolution_final',
      key: 'resolution_final',
      width: 110,
      align: 'center',
      render: (text: string) => text ? (
        <div style={{
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          maxWidth: '95px',
          lineHeight: '1.4',
          overflow: 'visible',
          textAlign: 'left'
        }}>
          {text}
        </div>
      ) : (
        <Tag color="default">Не добавлена</Tag>
      ),
    },
  ];

  return (
    <div className="complaints-container">
      {/* Фильтры */}
      <Card className="filters-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          {/* Первая строка фильтров */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'end', width: '100%' }}>
            <RangePicker
              value={filters.date_from && filters.date_to ? [
                dayjs(filters.date_from),
                dayjs(filters.date_to)
              ] : null}
              onChange={handleDateRangeChange}
              format="DD.MM.YYYY"
              style={{ width: 240 }}
              placeholder={['Начало периода', 'Окончание периода']}
            />

            <Select
              mode="multiple"
              placeholder="Статус принятия"
              style={{ flex: '1 1 0', minWidth: 180 }}
              value={filters.seen_status}
              onChange={(value) => handleFiltersChange('seen_status', value)}
              allowClear
              maxTagCount="responsive"
            >
              <Option value={0}>⚪ Не требуется</Option>
              <Option value={1}>🔴 Не принято</Option>
              <Option value={2}>✅ Принято</Option>
            </Select>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '12px' }}>Только с ущербом:</label>
              <Switch
                checked={filters.damage_only}
                onChange={(checked) => handleFiltersChange('damage_only', checked)}
                checkedChildren="Да"
                unCheckedChildren="Все"
              />
            </div>

            <Select
              mode="multiple"
              placeholder="Записи"
              style={{ flex: '1 1 0', minWidth: 120 }}
              value={filters.types}
              onChange={(value) => handleFiltersChange('types', value)}
              allowClear
              maxTagCount="responsive"
            >
              <Option value="Жалобы">Жалобы</Option>
              <Option value="Проверки">Проверки</Option>
            </Select>

            <Select
              mode="multiple"
              placeholder="Доклад"
              style={{ flex: '1 1 0', minWidth: 120 }}
              value={filters.report_type}
              onChange={(value) => handleFiltersChange('report_type', value)}
              allowClear
              maxTagCount="responsive"
            >
              <Option value={0}>Не требуется</Option>
              <Option value={1}>Битрикс</Option>
              <Option value={2}>Устно</Option>
            </Select>

            <Select
              mode="multiple"
              placeholder="Приоритет"
              style={{ flex: '1 1 0', minWidth: 120 }}
              value={filters.priority}
              onChange={(value) => handleFiltersChange('priority', value)}
              allowClear
              maxTagCount="responsive"
            >
              <Option value={0}>🟢 Низкий</Option>
              <Option value={1}>🟡 Средний</Option>
              <Option value={2}>🔴 Высокий</Option>
            </Select>

            <Select
              mode="multiple"
              placeholder="Статус разбора"
              style={{ flex: '1 1 0', minWidth: 120 }}
              value={filters.status}
              onChange={(value) => handleFiltersChange('status', value)}
              allowClear
              maxTagCount="responsive"
            >
              <Option value={true}>✅ Завершен</Option>
              <Option value={false}>⏳ В процессе</Option>
            </Select>
          </div>

          {/* Вторая строка: поиск, категории и кнопки */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'end' }}>
            <Search
              placeholder="Поиск по тексту события..."
              style={{ flex: '1 1 400px', minWidth: 300 }}
              value={filters.search}
              onChange={(e) => handleFiltersChange('search', e.target.value)}
              onPressEnter={() => loadComplaints()}
              onSearch={() => loadComplaints()}
              enterButton={<SearchOutlined />}
              allowClear
            />

            <Select
              mode="multiple"
              placeholder="Категории"
              style={{ flex: '1 1 400px', minWidth: 300 }}
              value={filters.category}
              onChange={(value) => handleFiltersChange('category', value)}
              allowClear
              maxTagCount="responsive"
              maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
            >
              {categories.map(category => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>

            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => loadComplaints()}
              loading={loading}
              title="Обновить"
            />

            <Button
              type="default"
              icon={<BarChartOutlined />}
              onClick={() => setStatisticsVisible(true)}
              title="Открыть статистику"
            />
          </div>
        </div>
      </Card>

      {/* Таблица */}
      <Card className="table-card">
        <Table
          columns={columns}
          dataSource={complaints}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: complaints.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} из ${total} записей`,
            onChange: (page, size) => {
              setCurrentPage(page);
              if (size !== pageSize) {
                setPageSize(size);
                setCurrentPage(1); // Сбрасываем на первую страницу при изменении размера
              }
            },
            onShowSizeChange: (current, size) => {
              setPageSize(size);
              setCurrentPage(1);
            },
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{}}
          size="middle"
        />
      </Card>

      {/* Модальное окно резолюции */}
      <ResolutionModal
        visible={resolutionModalVisible}
        complaint={selectedComplaint}
        templates={templates}
        onSave={handleResolutionSave}
        onTemplatesUpdated={handleTemplatesUpdated}
        onCancel={() => {
          setResolutionModalVisible(false);
          setSelectedComplaint(null);
        }}
      />

      {/* Модальное окно статистики */}
      <StatisticsModal
        visible={statisticsVisible}
        onClose={() => setStatisticsVisible(false)}
      />
    </div>
  );
};

export default ComplaintsTable;