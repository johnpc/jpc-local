import React, { useState, useEffect } from 'react';
import { Card, Text, Flex, Loader } from '@aws-amplify/ui-react';
import { MapView } from '@aws-amplify/ui-react-geo';
import { Marker } from 'react-map-gl'; // Note: this dependency should NOT be installed separately
import { Geo } from '@aws-amplify/geo';

interface Property {
  id: string;
  title: string;
  address: string;
  price: string;
  bedrooms: string;
  bathrooms: string;
  squareFootage: string;
  pricePerSqFt: string;
  propertyType: string;
  yearBuilt: string;
  neighborhood: string;
  description: string;
  status: string; // NEW, PRICE_REDUCED, etc.
  emoji: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Map Component using proper MapView with react-map-gl Marker
const MapComponent: React.FC<{ coordinates: { latitude: number; longitude: number } }> = ({ coordinates }) => {
  return (
    <MapView
      initialViewState={{
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        zoom: 10,
      }}
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <Marker
        latitude={coordinates.latitude}
        longitude={coordinates.longitude}
      />
    </MapView>
  );
};

const HousingTab: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AWS Location Service geocoding function
  const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      // Use AWS Location Service for geocoding
      const results = await Geo.searchByText(address, {
        countries: ['USA'],
        maxResults: 1,
      });

      if (results && results.length > 0) {
        const result = results[0];
        if (result.geometry && result.geometry.point) {
          return {
            latitude: result.geometry.point[1], // AWS returns [longitude, latitude]
            longitude: result.geometry.point[0]
          };
        }
      }
    } catch (error) {
      console.error('AWS Location Service geocoding error for address:', address, error);

      // Fallback to a simple coordinate estimation for Ann Arbor area
      // This provides a basic map view even when geocoding fails
      const annArborCoords = {
        latitude: 42.2808 + (Math.random() - 0.5) * 0.1, // Add some variation
        longitude: -83.7430 + (Math.random() - 0.5) * 0.1
      };

      console.log(`Using fallback coordinates for ${address}:`, annArborCoords);
      return annArborCoords;
    }
    return null;
  };

  const parsePropertyData = async (xmlDoc: Document): Promise<Property[]> => {
    // Try both methods to get items
    let items = xmlDoc.getElementsByTagName('item');
    console.log(`Real Estate: getElementsByTagName found: ${items.length} items`);

    if (items.length === 0) {
      const itemsNodeList = xmlDoc.querySelectorAll('item');
      console.log(`Real Estate: querySelectorAll found: ${itemsNodeList.length} items`);
      items = itemsNodeList as unknown as HTMLCollectionOf<Element>;
    }

    const parsedProperties: Property[] = [];

    // First, parse all properties without geocoding
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.getElementsByTagName('title')[0]?.textContent || '';
      const description = item.getElementsByTagName('description')[0]?.textContent || '';

      // Parse the HTML content within CDATA
      const htmlParser = new DOMParser();
      const htmlDoc = htmlParser.parseFromString(description, 'text/html');

      // Extract address from title (format: "🆕 🏠 NEW: 3065 Hilltop Dr, Ann Arbor, MI 48103 - $299,900 | 4BR/2BA")
      const addressMatch = title.match(/(\d+[^,]+,\s*[^,]+,\s*[^-]+)/);
      const address = addressMatch ? addressMatch[1].trim() : '';

      // Extract price from title
      const priceMatch = title.match(/\$([0-9,]+)/);
      const price = priceMatch ? `$${priceMatch[1]}` : '';

      // Extract bedrooms and bathrooms from title
      const bedroomMatch = title.match(/(\d+)BR/);
      const bathroomMatch = title.match(/(\d+)BA/);
      const bedrooms = bedroomMatch ? bedroomMatch[1] : '';
      const bathrooms = bathroomMatch ? bathroomMatch[1] : '';

      // Extract status and emoji from title
      const statusMatch = title.match(/(NEW|PRICE_REDUCED|SOLD|PENDING)/);
      const status = statusMatch ? statusMatch[1] : 'ACTIVE';
      const emojiMatch = title.match(/^([\u{1F300}-\u{1F9FF}]+)/u);
      const emoji = emojiMatch ? emojiMatch[1] : '🏠';

      // Extract details from HTML content
      let squareFootage = '';
      let pricePerSqFt = '';
      let propertyType = '';
      let yearBuilt = '';
      let neighborhood = '';
      let propertyDescription = '';

      // Look for specific details in the HTML
      const paragraphs = htmlDoc.querySelectorAll('p');
      paragraphs.forEach(p => {
        const text = p.textContent || '';
        if (text.includes('Square Footage:')) {
          squareFootage = text.replace(/.*Square Footage:\s*/, '').replace(/\s*sq ft.*/, '') + ' sq ft';
        } else if (text.includes('Price per Sq Ft:')) {
          pricePerSqFt = text.replace(/.*Price per Sq Ft:\s*/, '').replace(/\s*$.*/, '');
        } else if (text.includes('Property Type:')) {
          propertyType = text.replace(/.*Property Type:\s*/, '').trim();
        } else if (text.includes('Year Built:')) {
          yearBuilt = text.replace(/.*Year Built:\s*/, '').trim();
        } else if (text.includes('Neighborhood:')) {
          neighborhood = text.replace(/.*Neighborhood:\s*/, '').trim();
        }
      });

      // Get description from the description section
      const descriptionSection = Array.from(htmlDoc.querySelectorAll('h3')).find(h3 => h3.textContent?.includes('📋'));
      if (descriptionSection?.parentElement) {
        const descParagraph = descriptionSection.parentElement.querySelector('p');
        propertyDescription = descParagraph?.textContent || '';
      }

      const property: Property = {
        id: `${i}-${Date.now()}`,
        title,
        address,
        price,
        bedrooms,
        bathrooms,
        squareFootage,
        pricePerSqFt,
        propertyType,
        yearBuilt: yearBuilt === 'undefined' ? '' : yearBuilt,
        neighborhood,
        description: propertyDescription,
        status,
        emoji,
        coordinates: undefined // Will be filled in parallel
      };

      // Only include properties that don't have "Summary" in the title
      if (!title.toLowerCase().includes('summary')) {
        parsedProperties.push(property);
      } else {
        console.log('Filtered out summary listing:', title);
      }
    }

    // Now geocode all addresses in parallel using AWS Location Service
    console.log(`Starting parallel geocoding for ${parsedProperties.length} properties using AWS Location Service`);

    const geocodingPromises = parsedProperties.map(async (property, index) => {
      if (property.address) {
        try {
          const coordinates = await geocodeAddress(property.address);
          return { index, coordinates };
        } catch (error) {
          console.error(`Geocoding failed for property ${index}:`, property.address, error);
          return { index, coordinates: null };
        }
      }
      return { index, coordinates: null };
    });

    // Wait for all geocoding requests to complete
    const geocodingResults = await Promise.all(geocodingPromises);

    // Apply the coordinates back to the properties
    geocodingResults.forEach(({ index, coordinates }) => {
      if (coordinates && parsedProperties[index]) {
        parsedProperties[index].coordinates = coordinates;
      }
    });

    console.log(`Parsed ${parsedProperties.length} properties with parallel geocoding`);
    return parsedProperties;
  };

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        setLoading(true);
        const response = await fetch(`https://rss-feeds.jpc.io/api/realestate?_t=${Date.now()}`);
        const xmlText = await response.text();

        console.log('Real Estate XML response length:', xmlText.length);
        console.log('Number of <item> tags in response:', (xmlText.match(/<item>/g) || []).length);

        // Clean the XML to fix malformed entities
        const cleanedXml = xmlText
          .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;')
          .replace(/&amp;amp;/g, '&amp;');

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(cleanedXml, 'application/xml');

        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
          console.error('Real Estate XML parsing error:', parserError.textContent);
          throw new Error('Failed to parse real estate XML response');
        }

        const newProperties = await parsePropertyData(xmlDoc);
        setProperties(newProperties);

      } catch (err) {
        setError('Failed to fetch real estate listings');
        console.error('Real estate fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
    // Refresh every 30 minutes (real estate data doesn't change as frequently)
    const interval = setInterval(fetchProperties, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card padding="2rem">
        <Flex direction="column" alignItems="center" gap="1rem">
          <Loader size="large" />
          <Text>Loading real estate listings...</Text>
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return { bg: '#dcfce7', color: '#16a34a' }; // Green
      case 'PRICE_REDUCED':
        return { bg: '#fef3c7', color: '#d97706' }; // Yellow
      case 'SOLD':
        return { bg: '#fee2e2', color: '#dc2626' }; // Red
      case 'PENDING':
        return { bg: '#e0e7ff', color: '#4f46e5' }; // Blue
      default:
        return { bg: '#f3f4f6', color: '#6b7280' }; // Gray
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      <Text fontSize="1.5rem" fontWeight="bold" marginBottom="1rem">
        🏠 Real Estate Listings
      </Text>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {properties.map((property) => {
          const statusStyle = getStatusColor(property.status);

          return (
            <Card
              key={property.id}
              padding="1rem"
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                backgroundColor: 'white'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                {/* Header with emoji, address, and status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <Text fontSize="1.5rem" style={{ flexShrink: 0, marginTop: '0.125rem' }}>
                    {property.emoji}
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
                      {property.address}
                    </Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Text fontSize="1.25rem" fontWeight="bold" color="green.80">
                        {property.price}
                      </Text>
                      {property.status !== 'ACTIVE' && (
                        <span style={{
                          fontSize: '0.75rem',
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color,
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontWeight: 'medium'
                        }}>
                          {property.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Property Details */}
                <div style={{
                  backgroundColor: '#f8fafc',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '0.5rem',
                    marginBottom: '0.5rem'
                  }}>
                    {property.bedrooms && (
                      <Text fontSize="0.875rem" color="gray.90">
                        🛏️ {property.bedrooms} BR
                      </Text>
                    )}
                    {property.bathrooms && (
                      <Text fontSize="0.875rem" color="gray.90">
                        🛁 {property.bathrooms} BA
                      </Text>
                    )}
                    {property.squareFootage && (
                      <Text fontSize="0.875rem" color="gray.90">
                        📐 {property.squareFootage}
                      </Text>
                    )}
                    {property.pricePerSqFt && (
                      <Text fontSize="0.875rem" color="gray.90">
                        💲 {property.pricePerSqFt}/sq ft
                      </Text>
                    )}
                  </div>

                  {property.propertyType && (
                    <Text fontSize="0.75rem" color="gray.70">
                      🏠 {property.propertyType}
                    </Text>
                  )}

                  {property.neighborhood && (
                    <Text fontSize="0.75rem" color="gray.70">
                      📍 {property.neighborhood}
                    </Text>
                  )}
                </div>

                {/* Description */}
                {property.description && (
                  <div style={{
                    backgroundColor: '#fafafa',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    borderLeft: '3px solid #3b82f6'
                  }}>
                    <Text fontSize="0.875rem" color="gray.80">
                      {property.description}
                    </Text>
                  </div>
                )}

                {/* Map */}
                {property.coordinates && (
                  <div style={{
                    height: '200px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0'
                  }}>
                    <MapComponent
                      coordinates={property.coordinates}
                    />
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {properties.length === 0 && !loading && (
          <Card padding="2rem" style={{ backgroundColor: '#f9fafb' }}>
            <Text textAlign="center" color="gray.60">
              🏠 No real estate listings available at the moment.
            </Text>
          </Card>
        )}
      </div>
    </div>
  );
};

export default HousingTab;
