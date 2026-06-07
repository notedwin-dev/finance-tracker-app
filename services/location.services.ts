export const getCurrentLocation = (): Promise<{
	latitude: number;
	longitude: number;
	accuracyMeters: number;
}> => {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(
				new Error("Geolocation is not supported on this device/browser."),
			);
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

const distanceInMeters = (
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

const buildPlaceAddress = (tags: any): string | null => {
	const parts = [tags?.["addr:street"], tags?.["addr:city"]].filter(Boolean);
	return parts.length > 0 ? parts.join(", ") : null;
};

const mapPlaceElement = (
	el: any,
	latitude: number,
	longitude: number,
) => {
	const lat = el.lat ?? el.center?.lat;
	const lon = el.lon ?? el.center?.lon;
	if (typeof lat !== "number" || typeof lon !== "number") return null;

	return {
		name: el.tags?.name || "Unnamed place",
		amenity: el.tags?.amenity || "food",
		cuisine: el.tags?.cuisine || "",
		address: buildPlaceAddress(el.tags),
		distanceMeters: Math.round(
			distanceInMeters(latitude, longitude, lat, lon),
		),
		latitude: lat,
		longitude: lon,
		osmId: el.id,
	};
};

const matchesCuisineKeyword = (
	p: any,
	keyword: string | undefined,
): boolean => {
	if (!keyword) return true;
	const haystack = `${p.name} ${p.cuisine} ${p.amenity}`.toLowerCase();
	return haystack.includes(keyword);
};

const sortByDistanceAsc = (a: any, b: any) =>
	a.distanceMeters - b.distanceMeters;

const buildOverpassQuery = (
	latitude: number,
	longitude: number,
	safeRadius: number,
	safeLimit: number,
): string => `
[out:json][timeout:25];
nwr(around:${safeRadius},${latitude},${longitude})[amenity~"restaurant|fast_food|cafe|food_court|ice_cream"];
out center ${safeLimit * 3};`;

const buildOverpassUrl = (query: string): string =>
	`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

export const fetchNearbyFood = async (
	latitude: number,
	longitude: number,
	radiusMeters: number,
	limit: number,
	cuisineKeyword?: string,
) => {
	const safeRadius = Math.min(Math.max(radiusMeters || 1200, 100), 5000);
	const safeLimit = Math.min(Math.max(limit || 10, 1), 20);

	const response = await fetch(
		buildOverpassUrl(
			buildOverpassQuery(latitude, longitude, safeRadius, safeLimit),
		),
		{ headers: { Accept: "application/json" } },
	);

	if (!response.ok) {
		throw new Error("Failed to query nearby places from OpenStreetMap.");
	}

	const data = await response.json();
	const keyword = cuisineKeyword?.trim().toLowerCase();

	const places = (data?.elements || [])
		.map((el: any) => mapPlaceElement(el, latitude, longitude))
		.filter(Boolean)
		.filter((p: any) => matchesCuisineKeyword(p, keyword))
		.sort(sortByDistanceAsc)
		.slice(0, safeLimit);

	return {
		locationUsed: { latitude, longitude },
		radiusMeters: safeRadius,
		cuisineKeyword: cuisineKeyword || null,
		totalFound: places.length,
		places,
	};
};
