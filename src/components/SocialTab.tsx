import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Text, Flex, Loader } from '@aws-amplify/ui-react';

interface RedditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  comments: number;
  subreddit: string;
  url: string;
  selfText: string;
  thumbnail: string;
  imageUrl: string; // Add image URL field
  created: string;
  flair: string;
  postType: string; // text, link, image, etc.
  domain: string;
  permalink: string;
}

const SocialTab: React.FC = () => {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const parseRedditData = (xmlDoc: Document): RedditPost[] => {
    console.log('Parsing Reddit XML document...');
    
    // Try both RSS (item) and Atom (entry) formats
    let items = xmlDoc.getElementsByTagName('item');
    let isAtomFeed = false;
    
    if (items.length === 0) {
      items = xmlDoc.getElementsByTagName('entry');
      isAtomFeed = true;
      console.log('Using Atom feed format');
    } else {
      console.log('Using RSS feed format');
    }
    
    console.log(`Found ${items.length} ${isAtomFeed ? 'entries' : 'items'}`);
    
    const parsedPosts: RedditPost[] = [];

    for (let i = 0; i < Math.min(items.length, 50); i++) { // Limit to 50 posts for performance
      try {
        const item = items[i];
        
        // Handle both RSS and Atom formats
        const title = item.getElementsByTagName('title')[0]?.textContent?.trim() || `Post ${i + 1}`;
        
        // Get content/description
        const contentElement = isAtomFeed 
          ? item.getElementsByTagName('content')[0]
          : item.getElementsByTagName('description')[0];
        const content = contentElement?.textContent || '';
        
        // Get link
        const linkElement = item.getElementsByTagName('link')[0];
        const link = isAtomFeed 
          ? linkElement?.getAttribute('href') || linkElement?.textContent || ''
          : linkElement?.textContent || '';
        
        // Get date
        const dateElement = isAtomFeed 
          ? (item.getElementsByTagName('updated')[0] || item.getElementsByTagName('published')[0])
          : item.getElementsByTagName('pubDate')[0];
        const pubDate = dateElement?.textContent || '';

        // Extract author - try multiple methods with robust fallbacks
        let author = 'Unknown';
        
        // Method 1: Try XML DOM parsing for Atom feeds
        if (isAtomFeed) {
          const authorElement = item.getElementsByTagName('author')[0];
          if (authorElement) {
            const authorName = authorElement.getElementsByTagName('n')[0]?.textContent || '';
            if (authorName) {
              author = authorName.replace('/u/', '').replace('u/', '');
            }
          }
        }
        
        // Method 2: If still unknown, use regex on the raw XML string
        if (author === 'Unknown') {
          // Get the raw XML string of this item
          const serializer = new XMLSerializer();
          const itemXML = serializer.serializeToString(item);
          
          // Try different patterns to find username, ordered by specificity
          const patterns = [
            /<n>\/u\/([^<]+)<\/n>/,         // "<n>/u/username</n>" (most specific)
            /- \(\/u\/([^)]+)\)/,           // "- (/u/username)" in content
            /\(\/u\/([^)]+)\)/,            // "(/u/username)" anywhere
            /\/u\/([a-zA-Z0-9_-]+)/,       // "/u/username" anywhere
            /u\/([a-zA-Z0-9_-]+)/          // "u/username" anywhere (least specific)
          ];
          
          for (const pattern of patterns) {
            const match = itemXML.match(pattern);
            if (match && match[1] && match[1].length > 0) {
              author = match[1];
              break;
            }
          }
        }
        
        // Method 3: Final fallback - try parsing the content HTML directly
        if (author === 'Unknown' && content) {
          const htmlParser = new DOMParser();
          const htmlDoc = htmlParser.parseFromString(content, 'text/html');
          const spans = htmlDoc.querySelectorAll('span');
          
          for (const span of spans) {
            const spanText = span.textContent || '';
            const match = spanText.match(/- \(\/u\/([^)]+)\)/);
            if (match && match[1]) {
              author = match[1];
              break;
            }
          }
        }
        
        // Clean up author name
        if (author !== 'Unknown') {
          author = author.replace(/^\/+|\/+$/g, '').trim(); // Remove leading/trailing slashes and whitespace
        }

        // Extract content and images from HTML
        let selfText = '';
        let imageUrl = '';
        let hasImage = false;
        
        if (content) {
          try {
            const htmlParser = new DOMParser();
            const htmlDoc = htmlParser.parseFromString(content, 'text/html');
            
            // Check for images first
            const images = htmlDoc.querySelectorAll('img');
            if (images.length > 0) {
              hasImage = true;
              imageUrl = images[0].getAttribute('src') || '';
            }
            
            // Get text content from div > p structure, excluding metadata
            const contentDivs = htmlDoc.querySelectorAll('div');
            for (const div of contentDivs) {
              const paragraphs = div.querySelectorAll('p');
              let divText = '';
              
              for (const p of paragraphs) {
                const text = p.textContent?.trim() || '';
                if (text && !text.includes('(/u/') && !text.includes('- (') && text.length > 10) {
                  divText += text + ' ';
                }
              }
              
              if (divText.trim().length > 20) {
                selfText = divText.trim();
                break;
              }
            }
            
            // If no text found in divs, try direct paragraphs
            if (!selfText) {
              const paragraphs = htmlDoc.querySelectorAll('p');
              for (const p of paragraphs) {
                const text = p.textContent?.trim() || '';
                if (text && !text.includes('(/u/') && !text.includes('- (') && text.length > 20) {
                  selfText = text;
                  break;
                }
              }
            }
            
            // Limit text length
            if (selfText.length > 400) {
              selfText = selfText.substring(0, 400) + '...';
            }
            
          } catch (e) {
            console.warn('Error parsing HTML content:', e);
          }
        }

        // Determine post type
        let postType = 'text';
        let domain = '';
        
        if (hasImage || (content && (content.includes('<img') || content.includes('preview.redd.it')))) {
          postType = 'image';
        } else if (link && !link.includes('reddit.com/r/')) {
          postType = 'link';
          try {
            domain = new URL(link).hostname;
          } catch {
            // Invalid URL, ignore
          }
        }

        const post: RedditPost = {
          id: isAtomFeed ? (item.getElementsByTagName('id')[0]?.textContent || `entry-${i}`) : `item-${i}`,
          title: title,
          author: author,
          score: 0, // Not available in basic feeds
          comments: 0, // Not available in basic feeds
          subreddit: 'annarbor',
          url: link,
          selfText: selfText,
          thumbnail: '',
          imageUrl: imageUrl, // Add the extracted image URL
          created: pubDate,
          flair: '',
          postType: postType,
          domain: domain,
          permalink: link.includes('reddit.com') ? link : `https://reddit.com/r/annarbor`
        };

        parsedPosts.push(post);
        
      } catch (error) {
        console.warn(`Error parsing post ${i}:`, error);
        continue;
      }
    }

    console.log(`Successfully parsed ${parsedPosts.length} Reddit posts`);
    return parsedPosts;
  };

  const fetchPosts = useCallback(async (pageNum: number = 0) => {
    try {
      console.log(`Fetching Reddit posts, page ${pageNum}...`);
      
      if (pageNum === 0) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const response = await fetch(`https://rss-feeds.jpc.io/api/reddit?subreddit=annarbor&sort=new&limit=100&_t=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      
      console.log('Reddit XML response length:', xmlText.length);
      console.log('Number of <item> tags in response:', (xmlText.match(/<item>/g) || []).length);
      console.log('Number of <entry> tags in response:', (xmlText.match(/<entry>/g) || []).length);

      if (xmlText.length < 100) {
        throw new Error('Received empty or invalid response from Reddit API');
      }

      // Clean the XML to fix malformed entities
      const cleanedXml = xmlText
        .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;')
        .replace(/&amp;amp;/g, '&amp;');

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(cleanedXml, 'application/xml');
      
      // Check for XML parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        console.error('Reddit XML parsing error:', parserError.textContent);
        throw new Error('Failed to parse Reddit XML response');
      }

      const newPosts = parseRedditData(xmlDoc);
      
      if (newPosts.length === 0) {
        throw new Error('No posts found in Reddit feed');
      }
      
      // Simulate pagination by slicing the results
      const itemsPerPage = 20;
      const startIndex = pageNum * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pagePosts = newPosts.slice(startIndex, endIndex);

      if (pageNum === 0) {
        setPosts(pagePosts);
      } else {
        setPosts(prev => [...prev, ...pagePosts]);
      }

      setHasMore(endIndex < newPosts.length);
      
      console.log(`Successfully loaded ${pagePosts.length} posts for page ${pageNum}`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch Reddit posts';
      setError(errorMessage);
      console.error('Reddit fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Intersection Observer for infinite scroll
  const lastPostElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore]);

  useEffect(() => {
    fetchPosts(0);
  }, [fetchPosts]);

  useEffect(() => {
    if (page > 0) {
      fetchPosts(page);
    }
  }, [page, fetchPosts]);

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

  const getPostTypeIcon = (postType: string) => {
    switch (postType) {
      case 'link': return '🔗';
      case 'image': return '🖼️';
      case 'poll': return '📊';
      case 'text': return '📝';
      default: return '💬';
    }
  };

  const getPostTypeColor = (postType: string) => {
    switch (postType) {
      case 'link': return { bg: '#e3f2fd', color: '#1976d2' };
      case 'image': return { bg: '#f3e5f5', color: '#7b1fa2' };
      case 'poll': return { bg: '#fff3e0', color: '#f57c00' };
      case 'text': return { bg: '#e8f5e8', color: '#388e3c' };
      default: return { bg: '#f5f5f5', color: '#616161' };
    }
  };

  if (loading) {
    return (
      <Card padding="2rem">
        <Flex direction="column" alignItems="center" gap="1rem">
          <Loader size="large" />
          <Text>Loading Reddit posts...</Text>
        </Flex>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="2rem">
        <Flex direction="column" alignItems="center" gap="1rem">
          <Text color="red.80">⚠️ {error}</Text>
          <button 
            onClick={() => {
              setError(null);
              fetchPosts(0);
            }}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </Flex>
      </Card>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <Text fontSize="1.5rem" fontWeight="bold" marginBottom="1rem">
        👥 r/AnnArbor Community
      </Text>
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        {posts.map((post, index) => {
          const typeStyle = getPostTypeColor(post.postType);
          
          return (
            <Card
              key={post.id}
              ref={index === posts.length - 1 ? lastPostElementRef : null}
              padding="1rem"
              style={{ 
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                backgroundColor: 'white'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                
                {/* Header with post type, title, and metadata */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Text fontSize="1.25rem" style={{ flexShrink: 0, marginTop: '0.125rem' }}>
                    {getPostTypeIcon(post.postType)}
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
                      gap: '0.5rem',
                      alignItems: 'center',
                      marginBottom: '0.5rem'
                    }}>
                      <Text fontSize="0.75rem" color="gray.70">
                        👤 {post.author !== 'Unknown' ? `u/${post.author}` : 'Anonymous'}
                      </Text>
                      <Text fontSize="0.75rem" color="gray.70">
                        🕐 {formatTimeAgo(post.created)}
                      </Text>
                      {post.flair && (
                        <span style={{
                          fontSize: '0.7rem',
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '8px',
                          fontWeight: 'medium'
                        }}>
                          {post.flair}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Post content */}
                {post.selfText && (
                  <div style={{ 
                    backgroundColor: '#f8fafc', 
                    padding: '0.75rem', 
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <Text fontSize="0.875rem" color="gray.80">
                      {post.selfText.length > 300 
                        ? `${post.selfText.substring(0, 300)}...` 
                        : post.selfText
                      }
                    </Text>
                  </div>
                )}
                
                {/* Image display for image posts */}
                {post.imageUrl && (
                  <div style={{ 
                    backgroundColor: '#f8fafc', 
                    padding: '0.5rem', 
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <img 
                      src={post.imageUrl} 
                      alt="Reddit post image"
                      style={{
                        width: '100%',
                        maxWidth: '500px',
                        height: 'auto',
                        borderRadius: '6px',
                        display: 'block'
                      }}
                      onError={(e) => {
                        // Hide image if it fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                {/* External link domain */}
                {post.domain && (
                  <div style={{ 
                    backgroundColor: '#fef3c7', 
                    padding: '0.5rem', 
                    borderRadius: '6px',
                    borderLeft: '3px solid #f59e0b'
                  }}>
                    <Text fontSize="0.75rem" color="gray.70">
                      🔗 {post.domain}
                    </Text>
                  </div>
                )}
                
                {/* Post stats and actions */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      backgroundColor: typeStyle.bg,
                      color: typeStyle.color,
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px',
                      fontWeight: 'medium'
                    }}>
                      {getPostTypeIcon(post.postType)} {post.postType}
                    </span>
                    {post.score > 0 && (
                      <span style={{
                        fontSize: '0.75rem',
                        backgroundColor: '#f0f9ff',
                        color: '#0369a1',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontWeight: 'medium'
                      }}>
                        👌 {post.score}
                      </span>
                    )}
                    {post.comments > 0 && (
                      <span style={{
                        fontSize: '0.75rem',
                        backgroundColor: '#f0f9ff',
                        color: '#0369a1',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontWeight: 'medium'
                      }}>
                        💬 {post.comments}
                      </span>
                    )}
                  </div>
                  
                  <a 
                    href={post.permalink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '0.75rem',
                      color: '#6366f1',
                      textDecoration: 'none',
                      fontWeight: 'medium'
                    }}
                  >
                    View on Reddit →
                  </a>
                </div>
              </div>
            </Card>
          );
        })}
        
        {/* Loading indicator for infinite scroll */}
        {loadingMore && (
          <Card padding="1rem">
            <Flex direction="row" alignItems="center" justifyContent="center" gap="0.5rem">
              <Loader size="small" />
              <Text>Loading more posts...</Text>
            </Flex>
          </Card>
        )}
        
        {/* End of results indicator */}
        {!hasMore && posts.length > 0 && (
          <Card padding="1rem" style={{ backgroundColor: '#f9fafb' }}>
            <Text textAlign="center" color="gray.60">
              👥 That's all the posts for now!
            </Text>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SocialTab;
