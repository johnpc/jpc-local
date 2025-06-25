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
    // Try both methods to get items
    let items = xmlDoc.getElementsByTagName('item');
    console.log(`Reddit: getElementsByTagName found: ${items.length} items`);
    
    if (items.length === 0) {
      const itemsNodeList = xmlDoc.querySelectorAll('item');
      console.log(`Reddit: querySelectorAll found: ${itemsNodeList.length} items`);
      items = itemsNodeList as unknown as HTMLCollectionOf<Element>;
    }
    
    const parsedPosts: RedditPost[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.getElementsByTagName('title')[0]?.textContent || '';
      const description = item.getElementsByTagName('description')[0]?.textContent || '';
      const link = item.getElementsByTagName('link')[0]?.textContent || '';
      const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';

      // Parse the HTML content within CDATA
      const htmlParser = new DOMParser();
      const htmlDoc = htmlParser.parseFromString(description, 'text/html');

      // Extract post details from title (format: "🔗 Snow removal update from the city (👌 81 • 💬 11)")
      const cleanTitle = title.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '').replace(/\s*\([\u{1F300}-\u{1F9FF}\d\s•]+\)$/u, '');
      
      // Extract score and comments from title
      const scoreMatch = title.match(/👌\s*(\d+)/);
      const commentsMatch = title.match(/💬\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      const comments = commentsMatch ? parseInt(commentsMatch[1]) : 0;

      // Extract author from HTML
      let author = '';
      const authorSpan = htmlDoc.querySelector('span[style*="background: #ff4500"]');
      if (authorSpan) {
        author = authorSpan.textContent?.replace('👤 u/', '') || '';
      }

      // Extract flair if present
      let flair = '';
      const flairSpans = htmlDoc.querySelectorAll('span[style*="background: #"]');
      flairSpans.forEach(span => {
        const text = span.textContent || '';
        if (!text.includes('👤 u/') && !text.includes('Score') && !text.includes('Comments')) {
          flair = text.trim();
        }
      });

      // Extract self text content
      let selfText = '';
      const contentDiv = htmlDoc.querySelector('div[style*="background: #f8f9fa"]');
      if (contentDiv) {
        const textContent = contentDiv.textContent || '';
        selfText = textContent.replace(/^(Post Content|Self Text)\s*/, '').trim();
      }

      // Determine post type from title emoji
      let postType = 'text';
      if (title.startsWith('🔗')) postType = 'link';
      else if (title.startsWith('🖼️')) postType = 'image';
      else if (title.startsWith('📊')) postType = 'poll';
      else if (title.startsWith('📝')) postType = 'text';

      // Extract domain from link
      let domain = '';
      try {
        if (link && !link.includes('reddit.com')) {
          domain = new URL(link).hostname;
        }
      } catch {
        // Invalid URL, ignore
      }

      const post: RedditPost = {
        id: `${i}-${Date.now()}`,
        title: cleanTitle,
        author,
        score,
        comments,
        subreddit: 'annarbor',
        url: link,
        selfText,
        thumbnail: '',
        created: pubDate,
        flair,
        postType,
        domain,
        permalink: link.includes('reddit.com') ? link : `https://reddit.com/r/annarbor`
      };

      parsedPosts.push(post);
    }

    console.log(`Parsed ${parsedPosts.length} Reddit posts`);
    return parsedPosts;
  };

  const fetchPosts = useCallback(async (pageNum: number = 0) => {
    try {
      if (pageNum === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await fetch(`https://rss-feeds.jpc.io/api/reddit?subreddit=annarbor&sort=new&limit=100&_t=${Date.now()}`);
      const xmlText = await response.text();
      
      console.log('Reddit XML response length:', xmlText.length);
      console.log('Number of <item> tags in response:', (xmlText.match(/<item>/g) || []).length);

      // Clean the XML to fix malformed entities
      const cleanedXml = xmlText
        .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;')
        .replace(/&amp;amp;/g, '&amp;');

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(cleanedXml, 'application/xml');
      
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        console.error('Reddit XML parsing error:', parserError.textContent);
        throw new Error('Failed to parse Reddit XML response');
      }

      const newPosts = parseRedditData(xmlDoc);
      
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
      
    } catch (err) {
      setError('Failed to fetch Reddit posts');
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
        <Text color="red.80">⚠️ {error}</Text>
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
                        👤 u/{post.author}
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
                      👌 {post.score}
                    </span>
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
