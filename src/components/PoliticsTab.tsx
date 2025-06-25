import React, { useState, useEffect } from 'react';
import { Card, Text, Flex, Loader } from '@aws-amplify/ui-react';

interface PoliticalPost {
  id: string;
  title: string;
  url: string;
  content: string;
  published: string;
  author: string;
  imageUrl: string;
  categories: string[];
  source: string;
}

const PoliticsTab: React.FC = () => {
  const [posts, setPosts] = useState<PoliticalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parsePoliticalData = (xmlDoc: Document): PoliticalPost[] => {
    // This is an RSS feed, so we look for <item> elements
    let items = xmlDoc.getElementsByTagName('item');
    console.log(`Politics: getElementsByTagName found: ${items.length} items`);
    
    if (items.length === 0) {
      const itemsNodeList = xmlDoc.querySelectorAll('item');
      console.log(`Politics: querySelectorAll found: ${itemsNodeList.length} items`);
      items = itemsNodeList as unknown as HTMLCollectionOf<Element>;
    }
    
    const parsedPosts: PoliticalPost[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.getElementsByTagName('title')[0]?.textContent || '';
      const description = item.getElementsByTagName('description')[0]?.textContent || '';
      const link = item.getElementsByTagName('link')[0]?.textContent || '';
      const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';
      const guid = item.getElementsByTagName('guid')[0]?.textContent || '';

      // Get author information
      const authorElement = item.getElementsByTagName('author')[0];
      const author = authorElement?.textContent?.replace('noreply@blogger.com (', '').replace(')', '') || 'Damn Arbor';

      // Get categories (tags)
      const categoryElements = item.getElementsByTagName('category');
      const categories: string[] = [];
      for (let j = 0; j < categoryElements.length; j++) {
        const category = categoryElements[j].textContent;
        if (category) {
          categories.push(category);
        }
      }

      // Get thumbnail/image URL
      const thumbnailElement = item.querySelector('media\\:thumbnail, thumbnail');
      const imageUrl = thumbnailElement?.getAttribute('url') || '';

      // Parse the HTML content within CDATA to extract meaningful text
      const htmlParser = new DOMParser();
      const htmlDoc = htmlParser.parseFromString(description, 'text/html');
      
      // Extract text content, removing HTML tags
      let cleanContent = htmlDoc.body?.textContent || description;
      
      // Clean up the content
      cleanContent = cleanContent
        .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with regular space
        .trim();

      // If content is too short, use title as fallback
      if (cleanContent.length < 50) {
        cleanContent = 'Click to read the full post on Damn Arbor.';
      }

      const post: PoliticalPost = {
        id: guid || `${i}-${Date.now()}`,
        title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), // Decode HTML entities
        url: link,
        content: cleanContent,
        published: pubDate,
        author,
        imageUrl,
        categories: categories.slice(0, 5), // Limit to first 5 categories
        source: 'Damn Arbor'
      };

      parsedPosts.push(post);
    }

    console.log(`Parsed ${parsedPosts.length} political posts`);
    return parsedPosts;
  };

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://rss-feeds.jpc.io/api/damnarbor?_t=${Date.now()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const xmlText = await response.text();
        
        console.log('Politics XML response length:', xmlText.length);
        console.log('Number of <item> tags in response:', (xmlText.match(/<item>/g) || []).length);

        // Clean the XML to fix malformed entities
        const cleanedXml = xmlText
          .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;')
          .replace(/&amp;amp;/g, '&amp;');

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanedXml, 'application/xml');
        
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
          console.error('Politics XML parsing error:', parserError.textContent);
          throw new Error('Failed to parse politics XML response');
        }

        const newPosts = parsePoliticalData(xmlDoc);
        setPosts(newPosts);
        
      } catch (err) {
        setError('Failed to fetch political posts');
        console.error('Politics fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
    // Refresh every 30 minutes
    const interval = setInterval(fetchPosts, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return 'Unknown time';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffDays > 0) {
        return `${diffDays}d ago`;
      } else if (diffHours > 0) {
        return `${diffHours}h ago`;
      } else {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins}m ago`;
      }
    } catch {
      return 'Unknown time';
    }
  };

  const getCategoryColor = (category: string) => {
    // Color code categories based on political/civic themes
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('council') || lowerCategory.includes('a2council')) {
      return { bg: '#dbeafe', color: '#1d4ed8' }; // Blue for city council
    } else if (lowerCategory.includes('election') || lowerCategory.includes('voting')) {
      return { bg: '#fef3c7', color: '#d97706' }; // Yellow for elections
    } else if (lowerCategory.includes('politics') || lowerCategory.includes('government')) {
      return { bg: '#fee2e2', color: '#dc2626' }; // Red for politics
    } else if (lowerCategory.includes('development') || lowerCategory.includes('zoning')) {
      return { bg: '#f0fdf4', color: '#16a34a' }; // Green for development
    } else if (lowerCategory.includes('transportation') || lowerCategory.includes('transit')) {
      return { bg: '#fdf4ff', color: '#a21caf' }; // Purple for transportation
    } else {
      return { bg: '#f3f4f6', color: '#6b7280' }; // Gray for other
    }
  };

  if (loading) {
    return (
      <Card padding="2rem">
        <Flex direction="column" alignItems="center" gap="1rem">
          <Loader size="large" />
          <Text>Loading political posts...</Text>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="2rem">
        <Text color="red.80">⚠️ {error}</Text>
        <Text fontSize="0.875rem" color="gray.70" marginTop="1rem">
          You can access the latest posts directly at{' '}
          <a 
            href="https://www.damnarbor.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', textDecoration: 'underline' }}
          >
            Damn Arbor
          </a>
        </Text>
      </Card>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <Text fontSize="1.5rem" fontWeight="bold" marginBottom="1rem">
        🏛️ Ann Arbor Politics & Government
      </Text>
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        {posts.map((post) => (
          <Card
            key={post.id}
            padding="1rem"
            style={{ 
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              backgroundColor: 'white'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* Header with title and metadata */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <Text fontSize="1.25rem" style={{ flexShrink: 0, marginTop: '0.125rem' }}>
                  🏛️
                </Text>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text 
                    fontSize="1rem" 
                    fontWeight="bold" 
                    style={{ 
                      lineHeight: '1.3',
                      marginBottom: '0.5rem',
                      wordBreak: 'break-word'
                    }}
                  >
                    {post.title}
                  </Text>
                  
                  {/* Post metadata */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '0.75rem',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <Text fontSize="0.75rem" color="blue.80" fontWeight="medium">
                      📅 {formatTimeAgo(post.published)}
                    </Text>
                    <Text fontSize="0.75rem" color="gray.70">
                      ✍️ {post.author}
                    </Text>
                    <Text fontSize="0.75rem" color="purple.70" fontWeight="medium">
                      📰 {post.source}
                    </Text>
                  </div>
                </div>
              </div>

              {/* Post Image */}
              {post.imageUrl && (
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    style={{
                      width: '100%',
                      maxWidth: '400px',
                      height: '200px',
                      objectFit: 'cover',
                      borderRadius: '8px'
                    }}
                    onError={(e) => {
                      // Hide image if it fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              {/* Post Content */}
              <div style={{ 
                backgroundColor: '#f8fafc', 
                padding: '0.75rem', 
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <Text fontSize="0.875rem" color="gray.80">
                  {post.content.length > 300 
                    ? `${post.content.substring(0, 300)}...` 
                    : post.content
                  }
                </Text>
              </div>
              
              {/* Categories/Tags */}
              {post.categories.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}>
                  {post.categories.slice(0, 4).map((category, index) => {
                    const categoryStyle = getCategoryColor(category);
                    return (
                      <span
                        key={index}
                        style={{
                          fontSize: '0.7rem',
                          backgroundColor: categoryStyle.bg,
                          color: categoryStyle.color,
                          padding: '0.2rem 0.4rem',
                          borderRadius: '8px',
                          fontWeight: 'medium'
                        }}
                      >
                        {category}
                      </span>
                    );
                  })}
                  {post.categories.length > 4 && (
                    <span style={{
                      fontSize: '0.7rem',
                      color: '#6b7280',
                      padding: '0.2rem 0.4rem'
                    }}>
                      +{post.categories.length - 4} more
                    </span>
                  )}
                </div>
              )}
              
              {/* Read More Link */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.5rem',
                borderTop: '1px solid #f1f5f9'
              }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    backgroundColor: '#e0e7ff',
                    color: '#4f46e5',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontWeight: 'medium'
                  }}>
                    🏛️ Politics
                  </span>
                </div>
                
                <a 
                  href={post.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.75rem',
                    color: '#6366f1',
                    textDecoration: 'none',
                    fontWeight: 'medium'
                  }}
                >
                  Read Full Post →
                </a>
              </div>
            </div>
          </Card>
        ))}
        
        {posts.length === 0 && !loading && (
          <Card padding="2rem" style={{ backgroundColor: '#f9fafb' }}>
            <Text textAlign="center" color="gray.60">
              🏛️ No political posts available at the moment.
            </Text>
            <Text textAlign="center" color="gray.60" fontSize="0.875rem" marginTop="0.5rem">
              Visit{' '}
              <a 
                href="https://www.damnarbor.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'underline' }}
              >
                Damn Arbor
              </a>
              {' '}for the latest Ann Arbor political coverage.
            </Text>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PoliticsTab;
