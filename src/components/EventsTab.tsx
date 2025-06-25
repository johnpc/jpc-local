import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Text, Flex, Image, Loader } from '@aws-amplify/ui-react';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  location: string;
  address: string;
  category: string;
  genre: string;
  priceRange: string;
  imageUrl: string;
  description: string;
  emoji: string;
  eventName: string;
  sortDate: Date;
}

const EventsTab: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const parseEventData = (xmlDoc: Document): Event[] => {
    // Try both methods to get items
    let items = xmlDoc.getElementsByTagName('item');
    console.log(`getElementsByTagName found: ${items.length} items`);
    
    if (items.length === 0) {
      // Fallback to querySelectorAll
      const itemsNodeList = xmlDoc.querySelectorAll('item');
      console.log(`querySelectorAll found: ${itemsNodeList.length} items`);
      // Convert NodeList to HTMLCollection-like object
      items = itemsNodeList as unknown as HTMLCollectionOf<Element>;
    }
    
    const parsedEvents: Event[] = [];

    console.log(`Found ${items.length} total items in XML`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.getElementsByTagName('title')[0]?.textContent || '';
      const description = item.getElementsByTagName('description')[0]?.textContent || '';
      const enclosure = item.getElementsByTagName('enclosure')[0];
      const imageUrl = enclosure?.getAttribute('url') || '';

      // Parse the HTML content within CDATA
      const htmlParser = new DOMParser();
      const htmlDoc = htmlParser.parseFromString(description, 'text/html');

      // Extract event details from the HTML
      const eventName = htmlDoc.querySelector('h2')?.textContent || '';
      const dateTimeText = htmlDoc.querySelector('p strong')?.parentElement?.textContent || '';

      // Extract venue information
      const venueSection = Array.from(htmlDoc.querySelectorAll('h3')).find(h3 => h3.textContent?.includes('📍'));
      const venueDiv = venueSection?.parentElement;

      let venue = '';
      let location = '';
      let address = '';

      if (venueDiv) {
        const venueParagraphs = venueDiv.querySelectorAll('p');
        venueParagraphs.forEach(p => {
          const text = p.textContent || '';
          if (text.includes('🏟️ Venue:')) {
            venue = text.replace('🏟️ Venue:', '').trim();
          } else if (text.includes('🏙️ Location:')) {
            location = text.replace('🏙️ Location:', '').trim();
          } else if (text.includes('📮 Address:')) {
            address = text.replace('📮 Address:', '').trim();
          }
        });
      }

      // Extract event details
      const detailsSection = Array.from(htmlDoc.querySelectorAll('h3')).find(h3 => h3.textContent?.includes('🎫'));
      const detailsDiv = detailsSection?.parentElement;

      let category = '';
      let genre = '';
      let priceRange = '';

      if (detailsDiv) {
        const detailsParagraphs = detailsDiv.querySelectorAll('p');
        detailsParagraphs.forEach(p => {
          const text = p.textContent || '';
          if (text.includes('🎭 Category:')) {
            category = text.replace('🎭 Category:', '').trim();
          } else if (text.includes('🎪 Genre:')) {
            genre = text.replace('🎪 Genre:', '').trim();
          } else if (text.includes('💰 Price Range:')) {
            priceRange = text.replace('💰 Price Range:', '').trim();
          }
        });
      }

      // Extract emoji and clean event name from title
      const emojiMatch = title.match(/^(\p{Emoji}+)/u);
      const emoji = emojiMatch ? emojiMatch[1] : '🎪';

      // Extract date and time
      const dateMatch = dateTimeText.match(/(\w+day,\s+\w+\s+\d+,\s+\d+)/);
      const timeMatch = dateTimeText.match(/(\d+:\d+\s+[AP]M)/);
      const eventDate = dateMatch ? dateMatch[1] : '';
      const eventTime = timeMatch ? timeMatch[1] : 'Time TBA';

      // Create a sortable date
      let sortDate = new Date();
      if (eventDate) {
        try {
          sortDate = new Date(eventDate);
        } catch {
          console.warn('Could not parse date:', eventDate);
        }
      }

      const event: Event = {
        id: `${i}-${Date.now()}`,
        title,
        date: eventDate,
        time: eventTime,
        venue,
        location,
        address,
        category,
        genre,
        priceRange,
        imageUrl,
        description,
        emoji,
        eventName: eventName.replace(emoji, '').trim(),
        sortDate
      };

      // Only include events that have images
      if (imageUrl && imageUrl.trim() !== '' && imageUrl !== 'undefined') {
        parsedEvents.push(event);
      } else {
        console.log('Event without image:', { title, imageUrl });
      }
    }

    console.log(`Parsed ${parsedEvents.length} events with images out of ${items.length} total events`);
    return parsedEvents;
  };

  const fetchEvents = useCallback(async (pageNum: number = 0) => {
    try {
      if (pageNum === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const response = await fetch(`https://rss-feeds.jpc.io/api/ticketmaster-events?_t=${Date.now()}`);
      
      // Debug: log response headers
      console.log('Response status:', response.status);
      console.log('Response headers:');
      response.headers.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });
      
      const xmlText = await response.text();
      
      // Debug: log the actual XML response length and first part
      console.log('XML response length:', xmlText.length);
      console.log('XML response start:', xmlText.substring(0, 500));
      console.log('Number of <item> tags in response:', (xmlText.match(/<item>/g) || []).length);

      // Clean the XML to fix malformed entities
      const cleanedXml = xmlText
        .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;') // Fix unescaped & characters
        .replace(/&amp;amp;/g, '&amp;'); // Fix double-escaped ampersands

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(cleanedXml, 'application/xml');
      
      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        console.error('XML parsing error:', parserError.textContent);
        throw new Error('Failed to parse XML response');
      }

      const newEvents = parseEventData(xmlDoc);
      
      // Debug: Also try alternative parsing methods
      const itemsViaQuery = xmlDoc.querySelectorAll('item');
      console.log('Items found via querySelectorAll:', itemsViaQuery.length);
      
      const itemsViaTagName = xmlDoc.getElementsByTagName('item');
      console.log('Items found via getElementsByTagName:', itemsViaTagName.length);

      // Sort events: today's events first, then future events
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sortedEvents = newEvents.sort((a, b) => {
        const aIsToday = a.sortDate.toDateString() === today.toDateString();
        const bIsToday = b.sortDate.toDateString() === today.toDateString();

        // Today's events first
        if (aIsToday && !bIsToday) return -1;
        if (!aIsToday && bIsToday) return 1;

        // Then sort by date
        return a.sortDate.getTime() - b.sortDate.getTime();
      });

      // Simulate pagination by slicing the results
      const itemsPerPage = 1000;
      const startIndex = pageNum * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageEvents = sortedEvents.slice(startIndex, endIndex);

      if (pageNum === 0) {
        setEvents(pageEvents);
      } else {
        setEvents(prev => [...prev, ...pageEvents]);
      }

      setHasMore(endIndex < sortedEvents.length);

    } catch (err) {
      setError('Failed to fetch events');
      console.error('Events fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Intersection Observer for infinite scroll
  const lastEventElementRef = useCallback((node: HTMLDivElement | null) => {
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
    fetchEvents(0);
  }, [fetchEvents]);

  useEffect(() => {
    if (page > 0) {
      fetchEvents(page);
    }
  }, [page, fetchEvents]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Date TBA';
    try {
      const date = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      }

      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <Card padding="2rem">
        <Flex direction="column" alignItems="center" gap="1rem">
          <Loader size="large" />
          <Text>Loading events...</Text>
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

  console.log({events, hasMore})
  return (
    <div style={{ padding: '1rem' }}>
      <Text fontSize="1.5rem" fontWeight="bold" marginBottom="1rem">
        🎉 Upcoming Events
      </Text>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {events.map((event, index) => (
          <Card
            key={event.id}
            ref={index === events.length - 1 ? lastEventElementRef : null}
            padding="1rem"
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              backgroundColor: 'white'
            }}
          >
            {/* Mobile-optimized layout */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

              {/* Header with emoji, title, and date */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <Text fontSize="1.5rem" style={{ flexShrink: 0, marginTop: '0.125rem' }}>
                  {event.emoji}
                </Text>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    fontSize="1rem"
                    fontWeight="bold"
                    style={{
                      lineHeight: '1.3',
                      marginBottom: '0.25rem',
                      wordBreak: 'break-word'
                    }}
                  >
                    {event.eventName}
                  </Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    <Text fontSize="0.875rem" color="blue.80" fontWeight="medium">
                      📅 {formatDate(event.date)}
                    </Text>
                    <Text fontSize="0.875rem" color="blue.80" fontWeight="medium">
                      🕐 {event.time}
                    </Text>
                  </div>
                </div>
              </div>

              {/* Event Image */}
              <div style={{ width: '100%', textAlign: 'center' }}>
                <Image
                  src={event.imageUrl}
                  alt={event.eventName}
                  style={{
                    width: '100%',
                    maxWidth: '300px',
                    height: '180px',
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                />
              </div>

              {/* Venue Information */}
              <div style={{
                backgroundColor: '#f8fafc',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <Text fontSize="0.875rem" fontWeight="medium" color="gray.90" marginBottom="0.25rem">
                  🏟️ {event.venue}
                </Text>
                <Text fontSize="0.75rem" color="gray.70">
                  📍 {event.location}
                </Text>
              </div>

              {/* Event Details */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    backgroundColor: '#f3e8ff',
                    color: '#7c3aed',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontWeight: 'medium'
                  }}>
                    🎭 {event.category}
                  </span>
                  {event.genre && (
                    <span style={{
                      fontSize: '0.75rem',
                      backgroundColor: '#fef3c7',
                      color: '#d97706',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px',
                      fontWeight: 'medium'
                    }}>
                      🎪 {event.genre}
                    </span>
                  )}
                </div>
                {event.priceRange && event.priceRange !== 'TBA' && (
                  <span style={{
                    fontSize: '0.75rem',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    fontWeight: 'medium'
                  }}>
                    💰 {event.priceRange}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}

        {/* Loading indicator for infinite scroll */}
        {loadingMore && (
          <Card padding="1rem">
            <Flex direction="row" alignItems="center" justifyContent="center" gap="0.5rem">
              <Loader size="small" />
              <Text>Loading more events...</Text>
            </Flex>
          </Card>
        )}

        {/* End of results indicator */}
        {!hasMore && events.length > 0 && (
          <Card padding="1rem" style={{ backgroundColor: '#f9fafb' }}>
            <Text textAlign="center" color="gray.60">
              🎭 That's all the events for now!
            </Text>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EventsTab;
