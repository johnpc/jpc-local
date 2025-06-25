import React, { useState, useEffect } from 'react';
import { Card, Text, Flex, Loader } from '@aws-amplify/ui-react';

interface NewsArticle {
  id: string;
  title: string;
  url: string;
  content: string;
  published: string;
  updated: string;
  author: string;
  imageUrl: string;
  source: string;
}

const NewsTab: React.FC = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parseNewsData = (xmlDoc: Document): NewsArticle[] => {
    // This is an Atom feed, so we look for <entry> elements instead of <item>
    let entries = xmlDoc.getElementsByTagName('entry');
    console.log(`News: getElementsByTagName found: ${entries.length} entries`);
    
    if (entries.length === 0) {
      const entriesNodeList = xmlDoc.querySelectorAll('entry');
      console.log(`News: querySelectorAll found: ${entriesNodeList.length} entries`);
      entries = entriesNodeList as unknown as HTMLCollectionOf<Element>;
    }
    
    const parsedArticles: NewsArticle[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const title = entry.getElementsByTagName('title')[0]?.textContent || '';
      const id = entry.getElementsByTagName('id')[0]?.textContent || '';
      const published = entry.getElementsByTagName('published')[0]?.textContent || '';
      const updated = entry.getElementsByTagName('updated')[0]?.textContent || '';
      const content = entry.getElementsByTagName('content')[0]?.textContent || '';
      
      // Get the article URL from the link element
      const linkElement = entry.querySelector('link[rel="alternate"]');
      const url = linkElement?.getAttribute('href') || id;
      
      // Get author information
      const authorElement = entry.getElementsByTagName('author')[0];
      const author = authorElement?.getElementsByTagName('n')[0]?.textContent || 'MLive';
      
      // Get image URL from enclosure link
      const enclosureElement = entry.querySelector('link[rel="enclosure"]');
      const imageUrl = enclosureElement?.getAttribute('href') || '';

      // Clean up content - remove HTML tags and extract meaningful text
      let cleanContent = content
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/Could not extract full content, selector may need to be updated\./g, '') // Remove error messages
        .trim();

      // If content is too short or empty, use title as fallback
      if (cleanContent.length < 20) {
        cleanContent = 'Click to read the full article on MLive.com';
      }

      const article: NewsArticle = {
        id: `${i}-${Date.now()}`,
        title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), // Decode HTML entities
        url,
        content: cleanContent,
        published,
        updated,
        author: author.replace('https://www.facebook.com/', '').replace(/[^a-zA-Z0-9.]/g, ''),
        imageUrl,
        source: 'MLive'
      };

      parsedArticles.push(article);
    }

    console.log(`Parsed ${parsedArticles.length} news articles`);
    return parsedArticles;
  };

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        
        // Use the CORS-friendly API endpoint
        const response = await fetch(`https://rss-feeds.jpc.io/api/mlive?_t=${Date.now()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const xmlText = await response.text();
        
        console.log('News XML response length:', xmlText.length);
        console.log('Number of <entry> tags in response:', (xmlText.match(/<entry>/g) || []).length);

        // Clean the XML to fix malformed entities
        const cleanedXml = xmlText
          .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;')
          .replace(/&amp;amp;/g, '&amp;');

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanedXml, 'application/xml');
        
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
          console.error('News XML parsing error:', parserError.textContent);
          throw new Error('Failed to parse news XML response');
        }

        const newArticles = parseNewsData(xmlDoc);
        setArticles(newArticles);
        
      } catch (err) {
        setError('Failed to fetch news articles');
        console.error('News fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    // Refresh every 30 minutes (news doesn't change as frequently)
    const interval = setInterval(fetchNews, 30 * 60 * 1000);
    
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

  if (loading) {
    return (
      <Card padding="2rem">
        <Flex direction="column" alignItems="center" gap="1rem">
          <Loader size="large" />
          <Text>Loading local news...</Text>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="2rem">
        <Text color="red.80">⚠️ {error}</Text>
        <Text fontSize="0.875rem" color="gray.70" marginTop="1rem">
          You can access the latest news directly at{' '}
          <a 
            href="https://www.mlive.com/topic/local-aa/index.html" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', textDecoration: 'underline' }}
          >
            MLive Ann Arbor
          </a>
        </Text>
      </Card>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <Text fontSize="1.5rem" fontWeight="bold" marginBottom="1rem">
        📰 Local Ann Arbor News
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
                  📰
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
                      📺 {article.source}
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
                  {article.content.length > 200 
                    ? `${article.content.substring(0, 200)}...` 
                    : article.content
                  }
                </Text>
              </div>
              
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
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontWeight: 'medium'
                  }}>
                    📰 Local News
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
              📰 No news articles available at the moment.
            </Text>
            <Text textAlign="center" color="gray.60" fontSize="0.875rem" marginTop="0.5rem">
              Visit{' '}
              <a 
                href="https://www.mlive.com/topic/local-aa/index.html" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'underline' }}
              >
                MLive Ann Arbor
              </a>
              {' '}for the latest local news.
            </Text>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NewsTab;
