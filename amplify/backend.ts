import { defineBackend } from '@aws-amplify/backend';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnMap, CfnPlaceIndex } from 'aws-cdk-lib/aws-location';
import { Stack } from 'aws-cdk-lib/core';
import { auth } from './auth/resource';
import { data } from './data/resource';

const backend = defineBackend({
  auth,
  data,
});

const geoStack = backend.createStack('geo-stack');

// create a location services map
const map = new CfnMap(geoStack, 'Map', {
  mapName: 'a2blockMap',
  description: 'A2Block Housing Map',
  configuration: {
    style: 'VectorEsriStreets', // Clear street map style
  },
  pricingPlan: 'RequestBasedUsage',
  tags: [
    {
      key: 'name',
      value: 'a2blockMap',
    },
  ],
});

// create a place index for geocoding
const placeIndex = new CfnPlaceIndex(geoStack, 'PlaceIndex', {
  indexName: 'a2blockPlaceIndex',
  description: 'Place index for A2Block geocoding',
  dataSource: 'Esri',
  pricingPlan: 'RequestBasedUsage',
  tags: [
    {
      key: 'name',
      value: 'a2blockPlaceIndex',
    },
  ],
});

// create an IAM policy to allow interacting with geo resources
const geoPolicy = new Policy(geoStack, 'GeoPolicy', {
  policyName: 'a2blockGeoPolicy',
  statements: [
    new PolicyStatement({
      actions: [
        'geo:GetMapTile',
        'geo:GetMapSprites',
        'geo:GetMapGlyphs',
        'geo:GetMapStyleDescriptor',
      ],
      resources: [map.attrArn],
    }),
    new PolicyStatement({
      actions: [
        'geo:SearchPlaceIndexForText',
        'geo:SearchPlaceIndexForPosition',
      ],
      resources: [placeIndex.attrArn],
    }),
  ],
});

// apply the policy to the authenticated and unauthenticated roles
backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(geoPolicy);
backend.auth.resources.unauthenticatedUserIamRole.attachInlinePolicy(geoPolicy);

// patch the geo resources to the expected output configuration
backend.addOutput({
  geo: {
    aws_region: geoStack.region,
    maps: {
      items: {
        [map.mapName]: {
          style: 'VectorEsriStreets',
        },
      },
      default: map.mapName,
    },
    search_indices: {
      items: [placeIndex.indexName],
      default: placeIndex.indexName,
    },
  },
});
