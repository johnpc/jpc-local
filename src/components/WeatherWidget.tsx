import React, { useState, useEffect } from 'react';
import { Card, Flex, Text, Loader } from '@aws-amplify/ui-react';

interface WeatherDay {
  date: string;
  emoji: string;
  high: string;
  low: string;
  condition: string;
}

const WeatherWidget: React.FC = () => {
  const [weatherData, setWeatherData] = useState<WeatherDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://rss-feeds.jpc.io/api/weather');
        const xmlText = await response.text();
        
        // Parse the RSS XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        
        // Extract weather data from the first item's description
        const items = xmlDoc.getElementsByTagName('item');
        if (items.length > 0) {
          const description = items[0].getElementsByTagName('description')[0]?.textContent || '';
          
          // Parse the HTML content within CDATA
          const htmlParser = new DOMParser();
          const htmlDoc = htmlParser.parseFromString(description, 'text/html');
          
          // Extract daily weather data
          const dailyDivs = htmlDoc.querySelectorAll('div[style*="border: 1px solid #ddd"]');
          const weatherDays: WeatherDay[] = [];
          
          dailyDivs.forEach((div) => {
            const h4 = div.querySelector('h4');
            const tempP = div.querySelector('p:nth-of-type(1)');
            
            if (h4 && tempP) {
              const fullText = h4.textContent || '';
              const tempText = tempP.textContent || '';
              
              // Extract emoji and date - use a simpler approach for emoji extraction
              const emojiMatch = fullText.match(/^(\p{Emoji}+)/u);
              const dateMatch = fullText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
              
              // Extract temperature
              const tempMatch = tempText.match(/(\d+)°\/(\d+)°F/);
              
              if (emojiMatch && dateMatch && tempMatch) {
                weatherDays.push({
                  date: dateMatch[1],
                  emoji: emojiMatch[1],
                  high: tempMatch[1],
                  low: tempMatch[2],
                  condition: fullText.split(dateMatch[1])[1]?.trim() || ''
                });
              }
            }
          });
          
          setWeatherData(weatherDays.slice(0, 7)); // Limit to 7 days
        }
      } catch (err) {
        setError('Failed to fetch weather data');
        console.error('Weather fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Refresh every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card padding="1rem" style={{ width: '100%', backgroundColor: '#87ceeb', background: 'linear-gradient(135deg, #87ceeb 0%, #b0e0e6 100%)' }}>
        <Flex direction="row" alignItems="center" justifyContent="center">
          <Loader size="small" />
          <Text marginLeft="0.5rem" color="white" fontWeight="medium">Loading weather...</Text>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="1rem" style={{ width: '100%', backgroundColor: '#fee2e2', background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)' }}>
        <Text color="red.80">⚠️ {error}</Text>
      </Card>
    );
  }

  return (
    <Card padding="1rem" style={{ width: '100%', backgroundColor: '#87ceeb', background: 'linear-gradient(135deg, #87ceeb 0%, #b0e0e6 100%)' }}>
      <div style={{ 
        overflowX: 'auto', 
        overflowY: 'hidden',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.3) transparent'
      }}>
        <Flex 
          direction="row" 
          alignItems="center" 
          style={{ 
            minWidth: 'max-content',
            gap: '0.5rem'
          }}
        >
          {weatherData.map((day, index) => (
            <Flex
              key={index}
              direction="column"
              alignItems="center"
              padding="0.5rem"
              style={{ 
                minWidth: '90px',
                flexShrink: 0
              }}
            >
              <Text fontSize="0.75rem" color="white" marginBottom="0.25rem" fontWeight="medium">
                {new Date(day.date).toLocaleDateString('en-US', { 
                  weekday: 'short',
                  month: 'numeric',
                  day: 'numeric'
                })}
              </Text>
              <Text fontSize="1.5rem" marginBottom="0.25rem">
                {day.emoji}
              </Text>
              <Flex direction="row" alignItems="center">
                <Text fontSize="0.875rem" fontWeight="bold" color="white">
                  {day.high}°
                </Text>
                <Text fontSize="0.75rem" color="rgba(255,255,255,0.8)" marginLeft="0.25rem">
                  /{day.low}°
                </Text>
              </Flex>
            </Flex>
          ))}
        </Flex>
      </div>
    </Card>
  );
};

export default WeatherWidget;
