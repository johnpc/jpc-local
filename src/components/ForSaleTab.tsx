import React, { useState, useEffect } from 'react';
import { Card, Text, Flex, Loader, Badge } from '@aws-amplify/ui-react';

interface ForSaleItem {
  id: string;
  title: string;
  price: string;
  location: string;
  category: string;
  description: string;
  link: string;
  pubDate: string;
  emoji: string;
  isFree: boolean;
}

const ForSaleTab: React.FC = () => {
  const [items, setItems] = useState<ForSaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data for demonstration (uncomment to test the UI)
  /*
  const mockForSaleItems: ForSaleItem[] = [
    {
      id: 'mock-1',
      title: 'Vintage Wooden Dining Table',
      price: '$150',
      location: 'Ann Arbor',
      category: 'furniture',
      description: 'Beautiful solid wood dining table, seats 6 people. Some minor scratches but very sturdy. Perfect for a family home.',
      link: 'https://annarbor.craigslist.org/example1',
      pubDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      emoji: '🪑',
      isFree: false
    },
    {
      id: 'mock-2',
      title: 'Free Moving Boxes',
      price: 'Free',
      location: 'Ypsilanti',
      category: 'general',
      description: 'About 20 moving boxes in good condition. Various sizes. Must pick up this weekend.',
      link: 'https://annarbor.craigslist.org/example2',
      pubDate: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
      emoji: '📦',
      isFree: true
    },
    {
      id: 'mock-3',
      title: 'iPhone 13 Pro Max',
      price: '$650',
      location: 'Ann Arbor',
      category: 'electronics',
      description: 'Excellent condition iPhone 13 Pro Max, 256GB, unlocked. Includes original box and charger.',
      link: 'https://annarbor.craigslist.org/example3',
      pubDate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      emoji: '📱',
      isFree: false
    }
  ];
  */

  const parseForSaleData = (xmlDoc: Document): ForSaleItem[] => {
    const items = xmlDoc.getElementsByTagName('item');
    console.log(`For Sale: Found ${items.length} items`);

    const parsedItems: ForSaleItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.getElementsByTagName('title')[0]?.textContent || '';
      const description = item.getElementsByTagName('description')[0]?.textContent || '';
      const link = item.getElementsByTagName('link')[0]?.textContent || '';
      const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';

      // Parse the HTML content within CDATA
      const htmlParser = new DOMParser();
      const htmlDoc = htmlParser.parseFromString(description, 'text/html');

      // Extract emoji from title (first character)
      const emojiMatch = title.match(/^([\u{1F300}-\u{1F9FF}]+)/u);
      const emoji = emojiMatch ? emojiMatch[1] : '🛍️';

      // Extract price from title - handle both regular prices and "Free"
      let price = '';
      let isFree = false;
      
      if (title.toLowerCase().includes('free')) {
        price = 'Free';
        isFree = true;
      } else {
        const priceMatch = title.match(/\$([0-9,]+)/);
        price = priceMatch ? `$${priceMatch[1]}` : 'Price not listed';
      }

      // Extract location from title (between parentheses with 📍)
      const locationMatch = title.match(/📍\s*([^)]+)\)/);
      const location = locationMatch ? locationMatch[1].trim() : '';

      // Extract item name from title (remove emoji, price, and location)
      let itemName = title
        .replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '') // Remove emoji
        .replace(/\s*-\s*\$[0-9,]+/, '') // Remove price
        .replace(/\s*\(📍[^)]+\)/, '') // Remove location
        .trim();

      // Extract category from the categories in the XML
      const categories = item.getElementsByTagName('category');
      let category = '';
      for (let j = 0; j < categories.length; j++) {
        const cat = categories[j].textContent || '';
        if (cat !== 'Craigslist' && !cat.includes('Ann Arbor') && !cat.includes('Livonia') && !cat.includes('Detroit')) {
          category = cat;
          break;
        }
      }

      // Extract description from HTML
      let itemDescription = '';
      const descriptionSection = htmlDoc.querySelector('div[style*="line-height"] p');
      if (descriptionSection) {
        itemDescription = descriptionSection.textContent || '';
        // Truncate long descriptions
        if (itemDescription.length > 150) {
          itemDescription = itemDescription.substring(0, 150) + '...';
        }
      }

      const forSaleItem: ForSaleItem = {
        id: `forsale-${i}-${Date.now()}`,
        title: itemName,
        price,
        location,
        category: category || 'general',
        description: itemDescription,
        link,
        pubDate,
        emoji,
        isFree
      };

      parsedItems.push(forSaleItem);
    }

    console.log(`Parsed ${parsedItems.length} for sale items`);
    return parsedItems;
  };

  useEffect(() => {
    const fetchForSaleItems = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://rss-feeds.jpc.io/api/craigslist?_t=${Date.now()}`);
        
        // Check if the response is successful and contains XML
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        
        // Check if response is actually XML (not HTML error page)
        if (!xmlText.includes('<?xml') || xmlText.includes('<!DOCTYPE html>')) {
          throw new Error('API endpoint not available yet');
        }

        console.log('For Sale XML response length:', xmlText.length);

        // Clean the XML to fix malformed entities
        const cleanedXml = xmlText
          .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;')
          .replace(/&amp;amp;/g, '&amp;');

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanedXml, 'application/xml');

        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
          console.error('For Sale XML parsing error:', parserError.textContent);
          throw new Error('Failed to parse for sale XML response');
        }

        const newItems = parseForSaleData(xmlDoc);
        setItems(newItems);

      } catch (err) {
        console.error('For sale fetch error:', err);
        setError('Failed to fetch for sale listings');
      } finally {
        setLoading(false);
      }
    };

    fetchForSaleItems();

    // Auto-refresh every 30 minutes
    const interval = setInterval(fetchForSaleItems, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) {
        return 'Just posted';
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
      }
    } catch {
      return 'Recently';
    }
  };

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'electronics': '#3498db',
      'furniture': '#9b59b6',
      'automotive': '#e74c3c',
      'clothing': '#f39c12',
      'books': '#27ae60',
      'tools': '#34495e',
      'sports': '#e67e22',
      'general': '#95a5a6'
    };
    return colors[category.toLowerCase()] || colors['general'];
  };

  if (loading) {
    return (
      <Flex direction="column" alignItems="center" padding="2rem">
        <Loader size="large" />
        <Text marginTop="1rem">Loading for sale items...</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex direction="column" alignItems="center" padding="2rem">
        <Text color="red" fontSize="1.1rem">⚠️ {error}</Text>
        <Text marginTop="0.5rem" color="gray">
          Please check your internet connection and try again
        </Text>
      </Flex>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%' }}>
      <Flex direction="column" gap="1rem">
        {/* Header */}
        <Flex direction="row" alignItems="center" justifyContent="space-between" wrap="wrap">
          <Text fontSize="1.5rem" fontWeight="bold" color="#2c3e50">
            🛍️ For Sale in Ann Arbor
          </Text>
          <Text fontSize="0.9rem" color="gray">
            {items.length} items • Updated {formatDate(new Date().toISOString())}
          </Text>
        </Flex>

        {/* Items Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
          width: '100%'
        }}>
          {items.map((item) => (
            <Card
              key={item.id}
              padding="1rem"
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                height: 'fit-content'
              }}
              onClick={() => window.open(item.link, '_blank')}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              <Flex direction="column" gap="0.75rem">
                {/* Header with emoji and title */}
                <Flex direction="row" alignItems="flex-start" gap="0.5rem">
                  <Text fontSize="1.5rem" style={{ flexShrink: 0 }}>
                    {item.emoji}
                  </Text>
                  <Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
                    <Text 
                      fontSize="1.1rem" 
                      fontWeight="bold" 
                      color="#2c3e50"
                      style={{ 
                        lineHeight: '1.3',
                        wordBreak: 'break-word',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {item.title}
                    </Text>
                  </Flex>
                </Flex>

                {/* Price and badges */}
                <Flex direction="row" alignItems="center" gap="0.5rem" wrap="wrap">
                  <Badge
                    variation={item.isFree ? 'success' : 'info'}
                    style={{
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      padding: '0.4rem 0.8rem',
                      backgroundColor: item.isFree ? '#27ae60' : '#3498db',
                      color: 'white'
                    }}
                  >
                    💵 {item.price}
                  </Badge>
                  
                  {item.location && (
                    <Badge
                      style={{
                        fontSize: '0.85rem',
                        backgroundColor: '#95a5a6',
                        color: 'white',
                        padding: '0.3rem 0.6rem'
                      }}
                    >
                      📍 {item.location}
                    </Badge>
                  )}
                  
                  <Badge
                    style={{
                      fontSize: '0.85rem',
                      backgroundColor: getCategoryColor(item.category),
                      color: 'white',
                      padding: '0.3rem 0.6rem'
                    }}
                  >
                    {item.category}
                  </Badge>
                </Flex>

                {/* Description */}
                {item.description && (
                  <Text 
                    fontSize="0.9rem" 
                    color="#666"
                    style={{ 
                      lineHeight: '1.4',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {item.description}
                  </Text>
                )}

                {/* Footer with time and link */}
                <Flex direction="row" alignItems="center" justifyContent="space-between">
                  <Text fontSize="0.8rem" color="#999">
                    📅 {formatDate(item.pubDate)}
                  </Text>
                  <Text 
                    fontSize="0.8rem" 
                    color="#3498db"
                    style={{ fontWeight: 'bold' }}
                  >
                    View on Craigslist →
                  </Text>
                </Flex>
              </Flex>
            </Card>
          ))}
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <Flex direction="column" alignItems="center" padding="3rem">
            <Text fontSize="3rem">🛍️</Text>
            <Text fontSize="1.2rem" fontWeight="bold" marginTop="1rem">
              No items found
            </Text>
            <Text color="gray" marginTop="0.5rem">
              Check back later for new listings
            </Text>
          </Flex>
        )}
      </Flex>
    </div>
  );
};

export default ForSaleTab;
