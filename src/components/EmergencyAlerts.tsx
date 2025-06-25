import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Loader } from '@aws-amplify/ui-react';

interface EmergencyAlert {
  title: string;
  hasAlert: boolean;
}

const EmergencyAlerts: React.FC = () => {
  const [alertData, setAlertData] = useState<EmergencyAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://rss-feeds.jpc.io/api/emergency-alerts?location=48103');
        const xmlText = await response.text();
        
        // Parse the RSS XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Get the first item's title
        const items = xmlDoc.getElementsByTagName('item');
        if (items.length > 0) {
          const title = items[0].getElementsByTagName('title')[0]?.textContent || '';
          
          // Check if it's a "no alerts" message or an actual alert
          const hasAlert = !title.includes('No Active Emergency Alerts');
          
          setAlertData({
            title,
            hasAlert
          });
        } else {
          // No items means no alerts
          setAlertData({
            title: '✅ No Active Emergency Alerts',
            hasAlert: false
          });
        }
      } catch (err) {
        setError('Failed to fetch emergency alerts');
        console.error('Emergency alerts fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    // Refresh every 5 minutes (emergency alerts should be checked more frequently)
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card padding="1rem" style={{ width: '100%', backgroundColor: '#f3f4f6' }}>
        <Flex direction="row" alignItems="center" justifyContent="center">
          <Loader size="small" />
          <Text marginLeft="0.5rem" color="gray.70">Checking emergency alerts...</Text>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="1rem" style={{ width: '100%', backgroundColor: '#fee2e2' }}>
        <Text color="red.80">⚠️ {error}</Text>
      </Card>
    );
  }

  if (!alertData) {
    return null;
  }

  // Determine background color based on alert status
  const backgroundColor = alertData.hasAlert 
    ? '#fee2e2' // Red background for alerts
    : '#d1fae5'; // Green background for no alerts

  const textColor = alertData.hasAlert 
    ? '#dc2626' // Red text for alerts
    : '#059669'; // Green text for no alerts

  return (
    <Card padding="1rem" style={{ width: '100%', backgroundColor }}>
      <Flex direction="row" alignItems="center" justifyContent="center">
        <Text 
          fontSize="0.875rem" 
          fontWeight="medium" 
          color={textColor}
          textAlign="center"
        >
          {alertData.title}
        </Text>
      </Flex>
    </Card>
  );
};

export default EmergencyAlerts;
