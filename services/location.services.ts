/**
 * Location Services
 *
 * Browser-bound implementations of the location-aware tools offered to the AI:
 * the device's current position and nearby food places from OpenStreetMap.
 *
 * The decision logic that calls these lives in `ai-tool-action.services.ts`
 * and receives them as injected dependencies, so this module only has to
 * deal with the browser and the network.
 */

export interface ToolLocation {
	latitude: number;
	longitude: number;
	accuracyMeters: number;
}

export interface NearbyPlace {
	name: string;
	amenity: string;
	cuisine: string;
	address: string | null;
	distanceMeters: number;
	latitude: number;
	longitude: number;
	osmId: string | number;
}

export interface NearbyFoodResult {
	locationUsed: { latitude: number; longitude: number };
	radiusMeters: number;
	cuisineKeyword: string | null;
	totalFound: number;
	places: NearbyPlace[];
}

const MIN_RADIUS_METERS = 100;
const MAX_RADIUS_METERS = 5000;
export const DEFAULT_RADIUS_METERS = 1200;
const MIN_LIMIT = 1;
const MAX_LIMIT = 20;
export const DEFAULT_LIMIT = 10;
/**
 * Raw sample to request when a cuisine keyword is present. Overpass does not
 * sort by distance, so the client picks the nearest matches from whatever the
 * cap returns; a cap near the limit can hold no keyword match at all and the
 * search returns empty despite matches inside the radius.
 */
const KEYWORD_SAMPLE_SIZE = 200;

/** Great-circle distance between two coordinates, in metres. */
export const distanceInMeters = (
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number => {
	const toRad = (v: number) => (v * Math.PI) / 180;
	const R = 6371000;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) *
			Math.cos(toRad(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
};

/** Clamp the requested search radius into a range Overpass will answer. */
export const clampRadius = (radiusMeters: number): number =>
	Math.min(
		Math.max(radiusMeters || DEFAULT_RADIUS_METERS, MIN_RADIUS_METERS),
		MAX_RADIUS_METERS,
	);

/** Clamp the requested number of places into a sane range. */
export const clampLimit = (limit: number): number =>
	Math.min(
		Math.max(Math.floor(limit || DEFAULT_LIMIT), MIN_LIMIT),
		MAX_LIMIT,
	);

/** Resolve the device's current position. */
export const getCurrentLocation = (): Promise<ToolLocation> => {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error("Geolocation is not supported on this device/browser."));
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				resolve({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					accuracyMeters: position.coords.accuracy,
				});
			},
			(error) => {
				reject(
					new Error(
						error.code === error.PERMISSION_DENIED
							? "Location permission was denied."
							: "Unable to get current location.",
					),
				);
			},
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 60000,
			},
		);
	});
};

/**
 * Map an Overpass response into the places the model sees, nearest first.
 *
 * Elements without usable coordinates are dropped, and the cuisine keyword
 * filters on name, cuisine and amenity. Returns every match; the caller
 * applies any limit so it can also report the untruncated count.
 */
export const mapOverpassToPlaces = (
	elements: any[],
	latitude: number,
	longitude: number,
	cuisineKeyword?: string,
): NearbyPlace[] => {
	const keyword = cuisineKeyword?.trim().toLowerCase();

	return (elements || [])
		.map((el: any) => {
			const lat = el.lat ?? el.center?.lat;
			const lon = el.lon ?? el.center?.lon;
			if (typeof lat !== "number" || typeof lon !== "number") return null;

			const name = el.tags?.name || "Unnamed place";
			const cuisine = el.tags?.cuisine || "";
			const amenity = el.tags?.amenity || "food";
			const address = [el.tags?.["addr:street"], el.tags?.["addr:city"]]
				.filter(Boolean)
				.join(", ");

			const dist = distanceInMeters(latitude, longitude, lat, lon);

			return {
				name,
				amenity,
				cuisine,
				address: address || null,
				distanceMeters: Math.round(dist),
				latitude: lat,
				longitude: lon,
				osmId: el.id,
			};
		})
		.filter(Boolean)
		.filter((p: any) => {
			if (!keyword) return true;
			const haystack = `${p.name} ${p.cuisine} ${p.amenity}`.toLowerCase();
			return haystack.includes(keyword);
		})
		.sort((a: any, b: any) => a.distanceMeters - b.distanceMeters) as NearbyPlace[];
};

/** Client-side abort limit; the query already sets [timeout:25] server-side. */
const OVERPASS_TIMEOUT_MS = 30000;

/** Build the Overpass QL for a nearby-food search around a coordinate. */
export const buildOverpassQuery = (
	latitude: number,
	longitude: number,
	radiusMeters: number,
	limit: number,
	cuisineKeyword?: string,
): string => {
	const sample = cuisineKeyword?.trim() ? KEYWORD_SAMPLE_SIZE : limit * 3;

	return `
[out:json][timeout:25];
nwr(around:${radiusMeters},${latitude},${longitude})[amenity~"restaurant|fast_food|cafe|food_court|ice_cream"];
out center ${sample};`;
};

/** Find nearby food places around a coordinate using OpenStreetMap. */
export const fetchNearbyFood = async (
	latitude: number,
	longitude: number,
	radiusMeters: number,
	limit: number,
	cuisineKeyword?: string,
): Promise<NearbyFoodResult> => {
	const safeRadius = clampRadius(radiusMeters);
	const safeLimit = clampLimit(limit);

	const overpassQuery = buildOverpassQuery(
		latitude,
		longitude,
		safeRadius,
		safeLimit,
		cuisineKeyword,
	);

	const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
		overpassQuery,
	)}`;
	const response = await fetch(url, {
		headers: {
			Accept: "application/json",
		},
		signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new Error("Failed to query nearby places from OpenStreetMap.");
	}

	const data = await response.json();

	const matches = mapOverpassToPlaces(
		data?.elements || [],
		latitude,
		longitude,
		cuisineKeyword,
	);

	return {
		locationUsed: { latitude, longitude },
		radiusMeters: safeRadius,
		cuisineKeyword: cuisineKeyword || null,
		totalFound: matches.length,
		places: matches.slice(0, safeLimit),
	};
};
