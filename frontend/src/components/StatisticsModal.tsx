import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Button,
  message,
  Spin
} from 'antd';
import {
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  ReloadOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer
} from 'recharts';
import dayjs from 'dayjs';
import { StatisticsFilters, StatisticsData, ColumnBranch } from '../types';
import { complaintsApi } from '../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface StatisticsModalProps {
  visible: boolean;
  onClose: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

const StatisticsModal: React.FC<StatisticsModalProps> = ({ visible, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [statisticsData, setStatisticsData] = useState<StatisticsData | null>(null);
  const [columnBranches, setColumnBranches] = useState<ColumnBranch[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<StatisticsFilters>({
    dateFrom: dayjs().subtract(30, 'days').format('YYYY-MM-DD'),
    dateTo: dayjs().format('YYYY-MM-DD'),
    tables: ['ob', 'data_01_30', 'data_01_40', 'data_01_07'], // Всегда все таблицы
    // Остальные фильтры undefined = "Все"
  });

  useEffect(() => {
    if (visible) {
      loadInitialData();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      loadFilterData();
    }
  }, [visible]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [columnBranchesData, branchesData] = await Promise.all([
        complaintsApi.getColumnBranches(),
        complaintsApi.getStatisticsBranches(),
      ]);
      setColumnBranches(columnBranchesData);
      setBranches(branchesData);
      
      // Загружаем статистику с начальными фильтрами
      await loadStatistics();
    } catch (error) {
      message.error('Ошибка загрузки данных статистики');
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFilterData = async () => {
    try {
      const [routesData, categoriesData] = await Promise.all([
        complaintsApi.getRoutesByColumns(filters.columns, filters.tables),
        complaintsApi.getStatisticsCategories(filters.tables, filters.types),
      ]);
      setRoutes(routesData || []);
      setCategories(categoriesData || []);
    } catch (error) {
      message.error('Ошибка загрузки данных фильтров');
      console.error('Error loading filter data:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      setLoading(true);
      const data = await complaintsApi.getAdvancedStatistics(filters);
      setStatisticsData(data);
    } catch (error) {
      message.error('Ошибка загрузки статистики');
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = (key: keyof StatisticsFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // При изменении колонн обновляем список маршрутов
    if (key === 'columns') {
      updateRoutesForColumns(value);
    }
    
    // При изменении типов обновляем данные фильтров
    if (key === 'types') {
      loadFilterData();
    }
  };

  const updateRoutesForColumns = async (selectedColumns?: (number | string)[]) => {
    try {
      const routesData = await complaintsApi.getRoutesByColumns(selectedColumns, filters.tables);
      setRoutes(routesData || []);
      // Сбрасываем выбранные маршруты если они больше не доступны
      if (filters.routes && filters.routes.length > 0) {
        const availableRoutes = filters.routes.filter(route => routesData?.includes(route));
        if (availableRoutes.length !== filters.routes.length) {
          setFilters(prev => ({ ...prev, routes: availableRoutes }));
        }
      }
    } catch (error) {
      console.error('Error updating routes for columns:', error);
    }
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        dateFrom: dates[0].format('YYYY-MM-DD'),
        dateTo: dates[1].format('YYYY-MM-DD'),
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        dateFrom: undefined,
        dateTo: undefined,
      }));
    }
  };

  const getColumnOptions = () => {
    if (!branches?.length || !columnBranches?.length) return [];
    
    // Создаем опции для филиалов и их колонн
    const options: any[] = [];
    
    branches.forEach(branchName => {
      // Добавляем сам филиал как выбираемую опцию
      options.push({
        label: branchName,
        value: branchName
      });
      
      // Добавляем отдельные колонны этого филиала
      const branchColumns = columnBranches
        .filter(cb => cb.branch_name === branchName)
        .map(cb => ({
          label: `  └─ Колонна № ${cb.column_no}`,
          value: cb.column_no
        }));
      
      options.push(...branchColumns);
    });

    return options;
  };

  const formatChartData = (data: Array<{ [key: string]: any }>, nameKey: string, countKey: string = 'count') => {
    if (!data?.length) return [];
    return data.map(item => ({
      name: item[nameKey],
      value: item[countKey],
      count: item[countKey]
    }));
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      const blob = await complaintsApi.exportStatistics(filters);
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Формируем имя файла с текущей датой
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      link.download = `complaints_export_${dateStr}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('Данные успешно экспортированы');
    } catch (error) {
      message.error('Ошибка экспорта данных');
      console.error('Export error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChartOutlined style={{ color: '#1890ff' }} />
          <span>Статистика по событиям</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1400}
      style={{ top: 20 }}
      footer={[
        <Button key="close" onClick={onClose}>
          Закрыть
        </Button>
      ]}
    >
      <Spin spinning={loading}>
        {/* Фильтры */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={5}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Период:</label>
              <RangePicker
                value={filters.dateFrom && filters.dateTo ? [
                  dayjs(filters.dateFrom),
                  dayjs(filters.dateTo)
                ] : null}
                onChange={handleDateRangeChange}
                format="DD.MM.YYYY"
                style={{ width: '100%' }}
              />
            </Col>

            <Col span={3}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Тип:</label>
              <Select
                mode="multiple"
                placeholder="Все"
                style={{ width: '100%' }}
                value={filters.types}
                onChange={(value) => handleFiltersChange('types', value)}
                allowClear
                maxTagCount="responsive"
              >
                <Option key="complaint" value="complaint">Жалобы</Option>
                <Option key="check" value="check">Проверки</Option>
              </Select>
            </Col>

            <Col span={4}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Колонны:</label>
              <Select
                mode="multiple"
                placeholder="Все"
                style={{ width: '100%' }}
                value={filters.columns}
                onChange={(value) => handleFiltersChange('columns', value)}
                options={getColumnOptions()}
                allowClear
              />
            </Col>

            <Col span={3}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Маршруты:</label>
              <Select
                mode="multiple"
                placeholder="Все"
                style={{ width: '100%' }}
                value={filters.routes}
                onChange={(value) => handleFiltersChange('routes', value)}
                allowClear
                showSearch
                maxTagCount="responsive"
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
              >
                {routes.map(route => (
                  <Option key={route} value={route}>{route}</Option>
                ))}
              </Select>
            </Col>

            <Col span={7}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Категории:</label>
              <Select
                mode="multiple"
                placeholder="Все"
                style={{ width: '100%' }}
                value={filters.categories}
                onChange={(value) => handleFiltersChange('categories', value)}
                allowClear
                showSearch
                maxTagCount="responsive"
                maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
              >
                {categories.map(category => (
                  <Option key={category} value={category}>{category}</Option>
                ))}
              </Select>
            </Col>

            <Col span={2} style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ marginTop: 28, display: 'flex', gap: 8 }}>
                <Button 
                  type="primary"
                  icon={<ReloadOutlined />} 
                  onClick={loadStatistics}
                  loading={loading}
                  title="Обновить статистику"
                />
                <Button 
                  type="default"
                  icon={<DownloadOutlined />} 
                  onClick={handleExport}
                  loading={loading}
                  title="Экспорт в Excel"
                />
              </div>
            </Col>
          </Row>
        </Card>

        {statisticsData && (
          <>
            {/* Диаграммы */}
            <Row gutter={[16, 16]}>
              {/* По колоннам */}
              <Col span={12}>
                <Card title={<><BarChartOutlined /> События по колоннам</>} size="small">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={formatChartData(statisticsData.byColumns || [], 'column_no').slice(0, 14)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [value, 'Количество событий']} />
                      <Bar dataKey="value" fill="#1890ff" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* По площадкам */}
              <Col span={12}>
                <Card title={<><PieChartOutlined /> События по площадкам</>} size="small">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={formatChartData(statisticsData.byBranches || [], 'branch_name')}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label
                      >
                        {formatChartData(statisticsData.byBranches || [], 'branch_name').map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* По маршрутам */}
              <Col span={12}>
                <Card title={<><BarChartOutlined /> Топ-10 маршрутов</>} size="small">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={formatChartData((statisticsData.byRoutes || []).slice(0, 10), 'route_num')}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value, name) => [value, 'Количество событий']} />
                      <Bar dataKey="value" fill="#52c41a" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* По категориям */}
              <Col span={12}>
                <Card title={<><PieChartOutlined /> Топ-10 категорий</>} size="small">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={formatChartData((statisticsData.byCategories || []).slice(0, 10), 'category')}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label
                      >
                        {formatChartData((statisticsData.byCategories || []).slice(0, 10), 'category').map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* По датам */}
              {statisticsData.byDates?.length > 1 && (
                <Col span={24}>
                  <Card title={<><LineChartOutlined /> Динамика событий по датам</>} size="small">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={(statisticsData.byDates || []).map(item => ({
                        name: dayjs(item.date).format('DD.MM.YYYY'),
                        value: item.count
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value, name) => [value, 'Количество событий']} />
                        <Line type="monotone" dataKey="value" stroke="#faad14" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              )}
            </Row>
          </>
        )}
      </Spin>
    </Modal>
  );
};

export default StatisticsModal;