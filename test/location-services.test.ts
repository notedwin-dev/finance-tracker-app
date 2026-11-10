/**
 * Spec for the location-aware tools.
 *
 * Derived from the requirement, not from any implementation:
 *
 *   R10. A place the user cannot reach is never offered: the search radius
 *        and the number of places are clamped to what the data source can
 *        answer.
 *   R11. Only places with usable coordinates are offered, nearest first.
 *   R12. A cuisine keyword filters on name, cuisine and amenity.
 *   R13. A place without a name is still offered under a fallback name.
 *   R14. A geolocation failure is reported as an error, not swallowed.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
	clampLimit,
	clampRadius,
	distanceInMeters,
	fetchNearbyFood,
	getCurrentLocation,
	mapOverpassToPlaces,
} from "../services/location.services";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("clampRadius", () => {
	it("keeps a radius inside the range the data source can answer", () => {
		expect(clampRadius(1200)).toBe(1200);
		expect(clampRadius(10)).toBe(100);
		expect(clampRadius(99999)).toBe(5000);
	});

	it("falls back to the default when no radius is given", () => {
		expect(clampRadius(0)).toBe(1200);
		expect(clampRadius(Number.NaN)).toBe(1200);
	});
});

describe("clampLimit", () => {
	it("keeps the number of places inside a sane range", () => {
		expect(clampLimit(10)).toBe(10);
		expect(clampLimit(0)).toBe(10);
		expect(clampLimit(999)).toBe(20);
	});
});

describe("distanceInMeters", () => {
	it("is zero for the same point", () => {
		expect(distanceInMeters(3.1, 101.7, 3.1, 101.7)).toBe(0);
	});

	it("grows with the separation", () => {
		const near = distanceInMeters(3.1, 101.7, 3.11, 101.7);
		const far = distanceInMeters(3.1, 101.7, 3.3, 101.7);

		expect(near).toBeGreaterThan(0);
		expect(far).toBeGreaterThan(near);
	});

	it("measures roughly the right magnitude for a known separation", () => {
		// ~0.1 degrees of latitude is ~11.1 km.
		const metres = distanceInMeters(3.0, 101.7, 3.1, 101.7);
		expect(metres).toBeGreaterThan(11000);
		expect(metres).toBeLessThan(11200);
	});
});

describe("mapOverpassToPlaces", () => {
	const elements = [
		{
			id: 1,
			lat: 3.2,
			lon: 101.7,
			tags: { name: "Far Ramen", amenity: "restaurant", cuisine: "ramen" },
		},
		{
			id: 2,
			lat: 3.11,
			lon: 101.71,
			tags: { name: "Near Cafe", amenity: "cafe", cuisine: "coffee_shop" },
		},
		{
			id: 3,
			center: { lat: 3.12, lon: 101.72 },
			tags: { name: "Waypoint Bistro", amenity: "restaurant" },
		},
		{ id: 4, tags: { name: "No Coordinates" } },
	];

	it("R11: drops places without usable coordinates", () => {
		const places = mapOverpassToPlaces(elements, 3.1, 101.7, 10);

		expect(places.map((p) => p.osmId)).not.toContain(4);
		expect(places).toHaveLength(3);
	});

	it("R11: orders places nearest first", () => {
		const places = mapOverpassToPlaces(elements, 3.1, 101.7, 10);

		expect(places.map((p) => p.osmId)).toEqual([2, 3, 1]);
	});

	it("R11: reads coordinates from a node's centre", () => {
		const places = mapOverpassToPlaces(elements, 3.1, 101.7, 10);
		const waypoint = places.find((p) => p.osmId === 3)!;

		expect(waypoint.latitude).toBe(3.12);
		expect(waypoint.longitude).toBe(101.72);
	});

	it("R12: filters on the cuisine keyword", () => {
		const places = mapOverpassToPlaces(
			elements,
			3.1,
			101.7,
			10,
			"ramen",
		);

		expect(places.map((p) => p.name)).toEqual(["Far Ramen"]);
	});

	it("R12: matches the keyword against the amenity too", () => {
		const places = mapOverpassToPlaces(
			elements,
			3.1,
			101.7,
			10,
			"cafe",
		);

		expect(places.map((p) => p.name)).toEqual(["Near Cafe"]);
	});

	it("R12: ignores surrounding whitespace and case", () => {
		const places = mapOverpassToPlaces(
			elements,
			3.1,
			101.7,
			10,
			"  RAMEN ",
		);

		expect(places).toHaveLength(1);
	});

	it("R13: gives an unnamed place a fallback name", () => {
		const places = mapOverpassToPlaces(
			[{ id: 9, lat: 3.1, lon: 101.7, tags: { amenity: "cafe" } }],
			3.1,
			101.7,
			10,
		);

		expect(places[0].name).toBe("Unnamed place");
	});

	it("R10: honours the limit", () => {
		const places = mapOverpassToPlaces(elements, 3.1, 101.7, 1);
		expect(places).toHaveLength(1);
	});
});

describe("getCurrentLocation", () => {
	it("resolves the device position", async () => {
		vi.stubGlobal("navigator", {
			geolocation: {
				getCurrentPosition: (onOk: any) =>
					onOk({
						coords: { latitude: 3.1, longitude: 101.7, accuracy: 12 },
					}),
			},
		});

		await expect(getCurrentLocation()).resolves.toEqual({
			latitude: 3.1,
			longitude: 101.7,
			accuracyMeters: 12,
		});
	});

	it("R14: reports a denied permission as an error", async () => {
		vi.stubGlobal("navigator", {
			geolocation: {
				getCurrentPosition: (_onOk: any, onError: any) =>
					onError({ code: 1, PERMISSION_DENIED: 1 }),
			},
		});

		await expect(getCurrentLocation()).rejects.toThrow(
			"Location permission was denied.",
		);
	});

	it("R14: reports a missing geolocation API as an error", async () => {
		vi.stubGlobal("navigator", {});

		await expect(getCurrentLocation()).rejects.toThrow(
			"Geolocation is not supported on this device/browser.",
		);
	});
});

describe("fetchNearbyFood", () => {
	it("returns the mapped places and the location used", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					elements: [
						{
							id: 5,
							lat: 3.11,
							lon: 101.71,
							tags: { name: "Nearby Nasi", amenity: "restaurant" },
						},
					],
				}),
			}),
		);

		const result = await fetchNearbyFood(3.1, 101.7, 800, 5);

		expect(result.locationUsed).toEqual({ latitude: 3.1, longitude: 101.7 });
		expect(result.radiusMeters).toBe(800);
		expect(result.totalFound).toBe(1);
		expect(result.places[0].name).toBe("Nearby Nasi");
	});

	it("raises when the data source fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
		);

		await expect(fetchNearbyFood(3.1, 101.7, 800, 5)).rejects.toThrow(
			"Failed to query nearby places from OpenStreetMap.",
		);
	});
});
