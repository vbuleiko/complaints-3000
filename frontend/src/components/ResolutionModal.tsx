import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Form, 
  Select, 
  Input, 
  Button, 
  Space, 
  Typography, 
  Divider,
  Card,
  Tag,
  message
} from 'antd';
import { SaveOutlined, CloseOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons';
import { Complaint, ResolutionTemplate } from '../types';
import { complaintsApi } from '../services/api';
import TemplateManager from './TemplateManager';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

interface ResolutionModalProps {
  visible: boolean;
  complaint: Complaint | null;
  templates: ResolutionTemplate[];
  onSave: (updatedComplaint: Complaint) => void;
  onTemplatesUpdated: () => void;
  onCancel: () => void;
}

const ResolutionModal: React.FC<ResolutionModalProps> = ({
  visible,
  complaint,
  templates,
  onSave,
  onTemplatesUpdated,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [customComment, setCustomComment] = useState('');
  const [templateManagerVisible, setTemplateManagerVisible] = useState(false);
  const [currentTemplates, setCurrentTemplates] = useState<ResolutionTemplate[]>(templates);

  useEffect(() => {
    setCurrentTemplates(templates);
  }, [templates]);

  useEffect(() => {
    if (complaint && visible) {
      form.setFieldsValue({
        resolution_text: complaint.resolution_text || '',
        add_comment: complaint.add_comment || '',
        resolution_final: complaint.resolution_final || '',
      });
      
      // Парсим существующие комментарии для восстановления выбранных шаблонов
      if (complaint.add_comment) {
        const existingComment = complaint.add_comment;
        const matchedTemplates: string[] = [];
        let remainingComment = existingComment;

        currentTemplates.forEach(template => {
          if (existingComment.includes(template.value)) {
            matchedTemplates.push(template.value);
            remainingComment = remainingComment.replace(template.value, '').trim();
          }
        });

        setSelectedTemplates(matchedTemplates);
        const cleanedComment = remainingComment.replace(/^,\s*/, '').replace(/,\s*$/, '');
        setCustomComment(cleanedComment);
        updateFinalComment(matchedTemplates, cleanedComment);
      } else {
        setSelectedTemplates([]);
        setCustomComment('');
        updateFinalComment([], '');
      }
    }
  }, [complaint, visible, form, currentTemplates]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      if (!complaint) return;

      // Формируем итоговый комментарий
      const finalComment = [...selectedTemplates, customComment]
        .filter(Boolean)
        .join(', ');

      if (!finalComment.trim()) {
        message.error('Пожалуйста, выберите шаблон резолюции или введите комментарий');
        return;
      }

      const updateData = {
        id: complaint.id,
        resolution_text: values.resolution_text || null,
        add_comment: finalComment,
        resolution_final: finalComment,
        seen: complaint.seen, // Сохраняем текущий статус просмотра
        type: complaint.record_type, // Передаем тип записи
      };

      await complaintsApi.updateResolution(updateData);

      // Создаем обновленную жалобу для передачи родительскому компоненту
      const updatedComplaint: Complaint = {
        ...complaint,
        resolution_text: values.resolution_text || null,
        add_comment: finalComment,
        resolution_final: finalComment,
        seen: complaint.seen, // Сохраняем текущий статус просмотра
      };
      
      onSave(updatedComplaint);
      handleReset();
    } catch (error) {
      message.error('Ошибка сохранения резолюции');
      console.error('Error saving resolution:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
    setSelectedTemplates([]);
    setCustomComment('');
  };

  const handleCancel = () => {
    handleReset();
    onCancel();
  };

  const handleTemplateChange = (values: string[]) => {
    setSelectedTemplates(values);
    updateFinalComment(values, customComment);
  };

  const handleCustomCommentChange = (value: string) => {
    setCustomComment(value);
    updateFinalComment(selectedTemplates, value);
  };

  const updateFinalComment = (templates: string[], custom: string) => {
    const finalComment = [...templates, custom].filter(Boolean).join(', ');
    form.setFieldsValue({ 
      add_comment: finalComment,
      resolution_final: finalComment
    });
  };

  const handleTemplatesUpdated = (updatedTemplates: ResolutionTemplate[]) => {
    setCurrentTemplates(updatedTemplates);
    onTemplatesUpdated(); // Обновляем шаблоны в родительском компоненте
  };

  if (!complaint) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <span>Управление резолюцией</span>
          <Tag color="blue">Задача #{complaint.bitrix_num}</Tag>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={[
        <Button key="cancel" icon={<CloseOutlined />} onClick={handleCancel}>
          Отмена
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSave}
        >
          Сохранить резолюцию
        </Button>,
      ]}
    >
      {/* Информация о жалобе */}
      <Card size="small" style={{ marginBottom: 16, backgroundColor: '#fafafa' }}>
        <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
          Информация о жалобе
        </Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Тип записи: </Text>
            <Tag color={complaint.record_type === 'Жалоба' ? 'red' : 'blue'}>
              {complaint.record_type || 'Жалоба'}
            </Tag>
          </div>
          <div>
            <Text strong>вх. №: </Text>
            <Text>{complaint.vkh_num}</Text>
          </div>
          <div>
            <Text strong>Дата: </Text>
            <Text>
              {complaint.event_date 
                ? new Date(complaint.event_date).toLocaleDateString('ru-RU')
                : 'Не указана'
              }
            </Text>
          </div>
          <div>
            <Text strong>Категория: </Text>
            <Text>{complaint.category || 'Не указана'}</Text>
          </div>
          <div>
            <Text strong>Текст жалобы: </Text>
            <Text 
              style={{ 
                display: 'block', 
                marginTop: 4, 
                padding: 8, 
                backgroundColor: 'white', 
                borderRadius: 4,
                border: '1px solid #d9d9d9'
              }}
            >
              {complaint.message_text}
            </Text>
          </div>
        </Space>
      </Card>

      <Divider orientation="left">Резолюция</Divider>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
      >
        {/* Шаблоны резолюций */}
        <Form.Item 
          label={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Выберите шаблоны резолюций</span>
              <Button 
                type="link" 
                size="small" 
                icon={<SettingOutlined />}
                onClick={() => setTemplateManagerVisible(true)}
              >
                Управление шаблонами
              </Button>
            </div>
          }
          help="Можно выбрать несколько шаблонов"
        >
          <Select
            mode="multiple"
            placeholder="Выберите подходящие шаблоны..."
            value={selectedTemplates}
            onChange={handleTemplateChange}
            style={{ width: '100%' }}
          >
            {currentTemplates.map(template => (
              <Option key={template.id} value={template.value}>
                {template.value}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Дополнительный комментарий */}
        <Form.Item 
          label="Дополнительный комментарий"
          help="Введите дополнительные детали резолюции"
        >
          <TextArea
            placeholder="Введите дополнительный комментарий..."
            value={customComment}
            onChange={(e) => handleCustomCommentChange(e.target.value)}
            rows={3}
          />
        </Form.Item>

        {/* Итоговый комментарий (скрытое поле для формы) */}
        <Form.Item name="add_comment" style={{ display: 'none' }}>
          <Input />
        </Form.Item>

        {/* Предварительный просмотр */}
        {(selectedTemplates.length > 0 || customComment) && (
          <Form.Item label="Предварительный просмотр резолюции">
            <div 
              style={{ 
                padding: 12, 
                backgroundColor: '#f6ffed', 
                border: '1px solid #b7eb8f',
                borderRadius: 6,
                minHeight: 60
              }}
            >
              <Text style={{ color: '#52c41a', fontWeight: 500 }}>
                {[...selectedTemplates, customComment].filter(Boolean).join(', ') || 'Резолюция не задана'}
              </Text>
            </div>
          </Form.Item>
        )}

        {/* Скрытое поле для финальной резолюции */}
        <Form.Item name="resolution_final" style={{ display: 'none' }}>
          <Input />
        </Form.Item>
      </Form>

      {/* Модальное окно управления шаблонами */}
      <TemplateManager
        visible={templateManagerVisible}
        onClose={() => setTemplateManagerVisible(false)}
        onTemplatesUpdated={handleTemplatesUpdated}
      />
    </Modal>
  );
};

export default ResolutionModal;