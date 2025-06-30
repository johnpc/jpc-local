import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Flex, Text, Button } from '@aws-amplify/ui-react';
import EventsTab from './EventsTab';
import HousingTab from './HousingTab';
import NewsTab from './NewsTab';
import PoliticsTab from './PoliticsTab';
import SocialTab from './SocialTab';
import EducationTab from './EducationTab';
import ForSaleTab from './ForSaleTab';

const MainTabs: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get current tab from URL path
  const currentPath = location.pathname.substring(1); // Remove leading slash
  const activeTab = currentPath || 'events';

  const tabConfig = [
    { key: 'events', icon: '🎉', label: 'Events', component: <EventsTab /> },
    { key: 'housing', icon: '🏠', label: 'Housing', component: <HousingTab /> },
    { key: 'forsale', icon: '🛍️', label: 'For Sale', component: <ForSaleTab /> },
    { key: 'news', icon: '📰', label: 'News', component: <NewsTab /> },
    { key: 'politics', icon: '🏛️', label: 'Politics', component: <PoliticsTab /> },
    { key: 'social', icon: '👥', label: 'Social', component: <SocialTab /> },
    { key: 'education', icon: '🎓', label: 'Education', component: <EducationTab /> },
  ];

  const handleTabClick = (tabKey: string) => {
    navigate(`/${tabKey}`);
  };

  const renderTabContent = () => {
    const activeTabConfig = tabConfig.find(tab => tab.key === activeTab);
    return activeTabConfig ? activeTabConfig.component : <EventsTab />;
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Custom Tab Headers with Horizontal Scroll */}
      <div style={{
        borderBottom: '2px solid #e5e7eb',
        backgroundColor: '#f9fafb',
        padding: '0.5rem 0',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0,0,0,0.2) transparent'
      }}>
        <Flex 
          direction="row" 
          style={{ 
            minWidth: 'max-content',
            gap: '0.5rem',
            paddingLeft: '0.5rem',
            paddingRight: '0.5rem'
          }}
        >
          {tabConfig.map((tab) => (
            <Button
              key={tab.key}
              variation={activeTab === tab.key ? 'primary' : 'link'}
              onClick={() => handleTabClick(tab.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.75rem 1rem',
                minWidth: '90px',
                flexShrink: 0,
                backgroundColor: activeTab === tab.key ? '#3b82f6' : 'transparent',
                color: activeTab === tab.key ? 'white' : '#6b7280',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Text fontSize="1.25rem">{tab.icon}</Text>
              <Text fontSize="0.75rem" fontWeight="medium">
                {tab.label}
              </Text>
            </Button>
          ))}
        </Flex>
      </div>
      
      {/* Tab Content */}
      <div style={{ 
        marginTop: '1rem',
        padding: '0 1rem',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default MainTabs;
