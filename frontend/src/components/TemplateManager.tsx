import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Button,
  Input,
  Space,
  message,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { ResolutionTemplate } from '../types';
import { complaintsApi } from '../services/api';

interface TemplateManagerProps {
  visible: boolean;
  onClose: () => void;
  onTemplatesUpdated: (templates: ResolutionTemplate[]) => void;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({
  visible,
  onClose,
  onTemplatesUpdated
}) => {
  const [templates, setTemplates] = useState<ResolutionTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTemplateValue, setNewTemplateValue] = useState('');

  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await complaintsApi.getResolutionTemplates();
      setTemplates(data);
    } catch (error) {
      message.error('Ошибка загрузки шаблонов');
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTemplate = async () => {
    if (!newTemplateValue.trim()) {
      message.warning('Введите текст шаблона');
      return;
    }

    try {
      setLoading(true);
      const newTemplate = await complaintsApi.addResolutionTemplate(newTemplateValue.trim());
      const updatedTemplates = [...templates, newTemplate];
      setTemplates(updatedTemplates);
      setNewTemplateValue('');
      onTemplatesUpdated(updatedTemplates);
      message.success('Шаблон добавлен');
    } catch (error) {
      message.error('Ошибка добавления шаблона');
      console.error('Error adding template:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id: number) => {
    try {
      setLoading(true);
      await complaintsApi.deleteResolutionTemplate(id);
      const updatedTemplates = templates.filter(t => t.id !== id);
      setTemplates(updatedTemplates);
      onTemplatesUpdated(updatedTemplates);
      message.success('Шаблон удален');
    } catch (error) {
      message.error('Ошибка удаления шаблона');
      console.error('Error deleting template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewTemplateValue('');
    onClose();
  };

  const columns: ColumnsType<ResolutionTemplate> = [
    {
      title: 'Текст шаблона',
      dataIndex: 'value',
      key: 'value',
      render: (value: string) => (
        <div style={{ 
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          lineHeight: '1.4'
        }}>
          {value}
        </div>
      ),
    },
    {
      title: 'Действие',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_, record) => (
        <Popconfirm
          title="Удалить шаблон?"
          description="Это действие нельзя отменить"
          onConfirm={() => deleteTemplate(record.id)}
          okText="Да"
          cancelText="Нет"
        >
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            disabled={loading}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title="Управление шаблонами резолюций"
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="close" onClick={handleClose}>
          Закрыть
        </Button>,
      ]}
    >
      {/* Форма добавления нового шаблона */}
      <div style={{ marginBottom: 16 }}>
        <Space.Compact style={{ display: 'flex', width: '100%' }}>
          <Input
            placeholder="Введите текст нового шаблона..."
            value={newTemplateValue}
            onChange={(e) => setNewTemplateValue(e.target.value)}
            onPressEnter={addTemplate}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={addTemplate}
            loading={loading}
            disabled={!newTemplateValue.trim()}
          >
            Добавить
          </Button>
        </Space.Compact>
      </div>

      {/* Таблица шаблонов */}
      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} из ${total} шаблонов`,
        }}
        scroll={{ y: 400 }}
        size="middle"
      />
    </Modal>
  );
};

export default TemplateManager;