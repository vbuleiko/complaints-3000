import React from 'react';
import { Layout, Typography } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import ComplaintsTable from './components/ComplaintsTable';
import './App.css';

const { Header, Content } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  return (
    <div className="app-container">
      <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
        <Header style={{ 
          background: 'rgba(255, 255, 255, 0.9)', 
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BugOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
            <Title level={3} style={{ margin: 0, color: '#262626' }}>
              Система управления резолюциями
            </Title>
          </div>
        </Header>
        
        <Content className="content-wrapper">
          <ComplaintsTable />
        </Content>
      </Layout>
    </div>
  );
};

export default App;