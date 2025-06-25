import React, { useState, useEffect } from 'react';
import { Card, Text, Flex, Loader } from '@aws-amplify/ui-react';

interface EducationArticle {
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

const EducationTab: React.FC = () => {
  const [articles, setArticles] = useState<EducationArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parseEducationData = (xmlDoc: Document): EducationArticle[] => {
    // This is an RSS feed, so we look for <item> elements
    let items = xmlDoc.getElementsByTagName('item');
    console.log(`Education: getElementsByTagName found: ${items.length} items`);
    
    if (items.length === 0) {
      const itemsNodeList = xmlDoc.querySelectorAll('item');
      console.log(`Education: querySelectorAll found: ${itemsNodeList.length} items`);
      items = itemsNodeList as unknown as HTMLCollectionOf<Element>;
    }
    
    const parsedArticles: EducationArticle[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.getElementsByTagName('title')[0]?.textContent || '';
      const description = item.getElementsByTagName('description')[0]?.textContent || '';
      const link = item.getElementsByTagName('link')[0]?.textContent || '';
      const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';
      const guid = item.getElementsByTagName('guid')[0]?.textContent || '';

      // Get author information from dc:creator
      const creatorElement = item.getElementsByTagName('dc:creator')[0];
      const author = creatorElement?.textContent || 'The Michigan Daily';

      // Get categories
      const categoryElements = item.getElementsByTagName('category');
      const categories: string[] = [];
      for (let j = 0; j < categoryElements.length; j++) {
        const category = categoryElements[j].textContent;
        if (category) {
          categories.push(category);
        }
      }

      // Parse the HTML content within CDATA to extract image and text
      const htmlParser = new DOMParser();
      const htmlDoc = htmlParser.parseFromString(description, 'text/html');
      
      // Extract image URL from the first img tag
      const imgElement = htmlDoc.querySelector('img');
      const imageUrl = imgElement?.getAttribute('src') || '';

      // Extract text content, removing HTML tags
      let cleanContent = htmlDoc.body?.textContent || description;
      
      // Clean up the content
      cleanContent = cleanContent
        .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
        .replace(/&nbsp;/g, ' ') // Replace &nbsp; with regular space
        .replace(/The post .* appeared first on The Michigan Daily\./g, '') // Remove footer text
        .trim();

      // If content is too short, use title as fallback
      if (cleanContent.length < 50) {
        cleanContent = 'Click to read the full article on The Michigan Daily.';
      }

      const article: EducationArticle = {
        id: guid || `${i}-${Date.now()}`,
        title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), // Decode HTML entities
        url: link,
        content: cleanContent,
        published: pubDate,
        author,
        imageUrl,
        categories: categories.slice(0, 5), // Limit to first 5 categories
        source: 'The Michigan Daily'
      };

      parsedArticles.push(article);
    }

    console.log(`Parsed ${parsedArticles.length} education articles`);
    return parsedArticles;
  };

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://rss-feeds.jpc.io/api/michigandaily?_t=${Date.now()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const xmlText = await response.text();
        
        console.log('Education XML response length:', xmlText.length);
        console.log('Number of <item> tags in response:', (xmlText.match(/<item>/g) || []).length);

        // Clean the XML to fix malformed entities
        const cleanedXml = xmlText
          .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;')
          .replace(/&amp;amp;/g, '&amp;');

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanedXml, 'application/xml');
        
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
          console.error('Education XML parsing error:', parserError.textContent);
          throw new Error('Failed to parse education XML response');
        }

        const newArticles = parseEducationData(xmlDoc);
        setArticles(newArticles);
        
      } catch (err) {
        setError('Failed to fetch education articles');
        console.error('Education fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
    // Refresh every 30 minutes
    const interval = setInterval(fetchArticles, 30 * 60 * 1000);
    
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
    // Color code categories based on educational themes
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('news') || lowerCategory.includes('campus')) {
      return { bg: '#dbeafe', color: '#1d4ed8' }; // Blue for news/campus
    } else if (lowerCategory.includes('sports') || lowerCategory.includes('athletics')) {
      return { bg: '#fef3c7', color: '#d97706' }; // Yellow for sports
    } else if (lowerCategory.includes('opinion') || lowerCategory.includes('editorial')) {
      return { bg: '#fee2e2', color: '#dc2626' }; // Red for opinion
    } else if (lowerCategory.includes('arts') || lowerCategory.includes('culture')) {
      return { bg: '#f0fdf4', color: '#16a34a' }; // Green for arts
    } else if (lowerCategory.includes('cartoons') || lowerCategory.includes('humor')) {
      return { bg: '#fdf4ff', color: '#a21caf' }; // Purple for cartoons
    } else {
      return { bg: '#f3f4f6', color: '#6b7280' }; // Gray for other
    }
  };

  if (loading) {
    return (
      <Card padding="2rem">
        <Flex direction="column" alignItems="center" gap="1rem">
          <Loader size="large" />
          <Text>Loading education articles...</Text>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="2rem">
        <Text color="red.80">⚠️ {error}</Text>
        <Text fontSize="0.875rem" color="gray.70" marginTop="1rem">
          You can access the latest articles directly at{' '}
          <a 
            href="https://www.michigandaily.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', textDecoration: 'underline' }}
          >
            The Michigan Daily
          </a>
        </Text>
      </Card>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <Text fontSize="1.5rem" fontWeight="bold" marginBottom="1rem">
        🎓 University of Michigan Education & Campus News
      </Text>
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        {articles.map((article) => (
          <Card
            key={article.id}
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
                  🎓
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
                    {article.title}
                  </Text>
                  
                  {/* Article metadata */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '0.75rem',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <Text fontSize="0.75rem" color="blue.80" fontWeight="medium">
                      📅 {formatTimeAgo(article.published)}
                    </Text>
                    <Text fontSize="0.75rem" color="gray.70">
                      ✍️ {article.author}
                    </Text>
                    <Text fontSize="0.75rem" color="purple.70" fontWeight="medium">
                      📰 {article.source}
                    </Text>
                  </div>
                </div>
              </div>

              {/* Article Image */}
              {article.imageUrl && (
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <img
                    src={article.imageUrl}
                    alt={article.title}
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
              
              {/* Article Content */}
              <div style={{ 
                backgroundColor: '#f8fafc', 
                padding: '0.75rem', 
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <Text fontSize="0.875rem" color="gray.80">
                  {article.content.length > 300 
                    ? `${article.content.substring(0, 300)}...` 
                    : article.content
                  }
                </Text>
              </div>
              
              {/* Categories/Tags */}
              {article.categories.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}>
                  {article.categories.slice(0, 4).map((category, index) => {
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
                  {article.categories.length > 4 && (
                    <span style={{
                      fontSize: '0.7rem',
                      color: '#6b7280',
                      padding: '0.2rem 0.4rem'
                    }}>
                      +{article.categories.length - 4} more
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
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontWeight: 'medium'
                  }}>
                    🎓 Education
                  </span>
                </div>
                
                <a 
                  href={article.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.75rem',
                    color: '#6366f1',
                    textDecoration: 'none',
                    fontWeight: 'medium'
                  }}
                >
                  Read Full Article →
                </a>
              </div>
            </div>
          </Card>
        ))}
        
        {articles.length === 0 && !loading && (
          <Card padding="2rem" style={{ backgroundColor: '#f9fafb' }}>
            <Text textAlign="center" color="gray.60">
              🎓 No education articles available at the moment.
            </Text>
            <Text textAlign="center" color="gray.60" fontSize="0.875rem" marginTop="0.5rem">
              Visit{' '}
              <a 
                href="https://www.michigandaily.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'underline' }}
              >
                The Michigan Daily
              </a>
              {' '}for the latest University of Michigan news and articles.
            </Text>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EducationTab;
