// Parses coordinates out of a pasted Google Maps share link, and builds a
// search-by-name link - both client-side only, no Maps API/network call
// (Google's My Maps KML export is blocked by CORS for client-side fetches,
// and a full Places API integration needs billing - a pasted link plus a
// regex is what stays free and works offline once the link is in).
const COORD_PATTERNS = [
  // Precise pin location, present on most place share links: .../@.../data=!...!3d<lat>!4d<lng>
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  // Map view center, present on nearly every Google Maps URL: .../@<lat>,<lng>,<zoom>z
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  // Plain coordinate query param: ...?q=<lat>,<lng>
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
];

export function parseGoogleMapsCoords(url) {
  if (!url) return null;
  for (const pattern of COORD_PATTERNS) {
    const match = url.match(pattern);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
  }
  return null;
}

export function googleMapsSearchUrl(query) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}
