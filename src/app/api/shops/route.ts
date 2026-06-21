import { NextResponse } from 'next/server';
import axios from 'axios';
import { withAuth } from '@/lib/api-auth';
import { queryOne } from '@/lib/db';

export const GET = withAuth(async (request, user) => {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius');
  const type = searchParams.get('type');

  if (!lat || !lng || !radius) {
    return NextResponse.json({ error: 'Missing required parameters: lat, lng, radius' }, { status: 400 });
  }

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);

  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    return NextResponse.json({ error: 'Invalid coordinates: lat and lng must be numbers' }, { status: 400 });
  }

  // Clamp Latitude: [-90, 90]
  const cleanLat = Math.min(Math.max(parsedLat, -90), 90);
  
  // Wrap Longitude: [-180, 180]
  const cleanLng = ((parsedLng + 180) % 360 + 360) % 360 - 180;

  // Query Google Maps API Key dynamically from MySQL crm_settings for this user
  let API_KEY = '';
  try {
    const row = await queryOne<{ value: string }>(
      'SELECT value FROM crm_settings WHERE user_id = ? AND `key` = ? LIMIT 1',
      [user.id, 'GOOGLE_MAPS_API_KEY']
    );
    API_KEY = row?.value || '';
  } catch (err) {
    console.error('Failed to retrieve GOOGLE_MAPS_API_KEY from crm_settings:', err);
  }

  // Fallback to environment variables
  if (!API_KEY) {
    API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
  }

  if (!API_KEY || API_KEY.trim() === '') {
    return NextResponse.json({ error: 'Server misconfiguration: Google Maps API key is not configured.' }, { status: 500 });
  }

  try {
    const url = 'https://places.googleapis.com/v1/places:searchText';
    const fieldMask = 'places.id,places.displayName,places.location,places.formattedAddress,places.rating,places.userRatingCount,places.businessStatus,places.primaryType,places.nationalPhoneNumber,places.websiteUri';
    const textQuery = type && type.trim() !== '' ? type : 'businesses';

    const response = await axios.post(
      url,
      {
        textQuery: textQuery,
        locationBias: {
          circle: {
            center: {
              latitude: cleanLat,
              longitude: cleanLng,
            },
            radius: parseFloat(radius),
          },
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': fieldMask,
        },
      }
    );

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error fetching from Places API:', error.response?.data || error.message);
    return NextResponse.json({ 
      error: 'Failed to fetch places from Google', 
      details: error.response?.data || error.message 
    }, { status: 500 });
  }
});

export const dynamic = 'force-dynamic';
