import { describe, expect, test } from "bun:test";
import {
	argbToCss,
	bresenhamLine,
	cssToArgb,
	floodFill,
	markerKey,
	packMarkers,
	rectOutlineTiles,
	rectTiles,
	toGlobalCoords,
	toRegionCoords,
	unpackMarkers,
} from "@/helpers";

describe("toRegionCoords", () => {
	test("converts Lumbridge coords", () => {
		// Lumbridge center is roughly (3222, 3218) on plane 0
		const result = toRegionCoords(0, 3222, 3218);
		expect(result.regionId).toBe(((3222 >> 6) << 8) | (3218 >> 6));
		expect(result.regionX).toBe(3222 & 63);
		expect(result.regionY).toBe(3218 & 63);
		expect(result.z).toBe(0);
	});

	test("preserves plane", () => {
		const result = toRegionCoords(2, 3200, 3200);
		expect(result.z).toBe(2);
	});

	test("regionX and regionY are 0-63", () => {
		for (let x = 0; x < 128; x++) {
			const result = toRegionCoords(0, x, 0);
			expect(result.regionX).toBeGreaterThanOrEqual(0);
			expect(result.regionX).toBeLessThanOrEqual(63);
		}
	});
});

describe("toGlobalCoords", () => {
	test("round-trips with toRegionCoords", () => {
		const testCases = [
			[0, 3222, 3218],
			[1, 2400, 3600],
			[0, 0, 0],
			[3, 12799, 6399],
		];
		for (const [plane, x, y] of testCases) {
			const region = toRegionCoords(plane, x, y);
			const global = toGlobalCoords(region.regionId, region.regionX, region.regionY);
			expect(global.globalX).toBe(x);
			expect(global.globalY).toBe(y);
		}
	});
});

describe("argbToCss", () => {
	test("converts 8-char ARGB hex to rgba", () => {
		const result = argbToCss("#FF00FF00");
		expect(result).toBe("rgba(0, 255, 0, 1)");
	});

	test("handles transparent alpha", () => {
		const result = argbToCss("#8000FF00");
		// alpha = 0x80/255 ≈ 0.502, clamped to max(0.502, 0.3)
		expect(result).toContain("rgba(0, 255, 0,");
	});

	test("clamps very low alpha to 0.3", () => {
		const result = argbToCss("#0100FF00");
		expect(result).toContain("0.3)");
	});

	test("handles 6-char hex", () => {
		const result = argbToCss("#FF0000");
		expect(result).toBe("rgba(255, 0, 0, 0.5)");
	});

	test("returns fallback for invalid input", () => {
		expect(argbToCss(null)).toBe("rgba(255, 255, 0, 0.5)");
		expect(argbToCss("")).toBe("rgba(255, 255, 0, 0.5)");
	});
});

describe("cssToArgb", () => {
	test("converts 6-char hex with opacity", () => {
		const result = cssToArgb("#FF0000", 1.0);
		expect(result).toBe("#FFFF0000");
	});

	test("encodes half opacity", () => {
		const result = cssToArgb("#00FF00", 0.5);
		expect(result).toBe("#8000FF00");
	});

	test("defaults to full opacity when undefined", () => {
		const result = cssToArgb("#0000FF");
		expect(result).toBe("#FF0000FF");
	});
});

describe("bresenhamLine", () => {
	test("horizontal line", () => {
		const tiles = bresenhamLine(0, 0, 5, 0);
		expect(tiles.length).toBe(6);
		expect(tiles[0]).toEqual([0, 0]);
		expect(tiles[5]).toEqual([5, 0]);
	});

	test("vertical line", () => {
		const tiles = bresenhamLine(0, 0, 0, 3);
		expect(tiles.length).toBe(4);
	});

	test("diagonal line", () => {
		const tiles = bresenhamLine(0, 0, 3, 3);
		expect(tiles.length).toBe(4);
		expect(tiles[0]).toEqual([0, 0]);
		expect(tiles[3]).toEqual([3, 3]);
	});

	test("single point", () => {
		const tiles = bresenhamLine(5, 5, 5, 5);
		expect(tiles.length).toBe(1);
		expect(tiles[0]).toEqual([5, 5]);
	});

	test("reverse direction works", () => {
		const forward = bresenhamLine(0, 0, 5, 3);
		const backward = bresenhamLine(5, 3, 0, 0);
		expect(forward.length).toBe(backward.length);
	});
});

describe("rectTiles", () => {
	test("1x1 rect", () => {
		const tiles = rectTiles(5, 5, 5, 5);
		expect(tiles.length).toBe(1);
		expect(tiles[0]).toEqual([5, 5]);
	});

	test("2x3 rect", () => {
		const tiles = rectTiles(0, 0, 1, 2);
		expect(tiles.length).toBe(6);
	});

	test("handles reversed corners", () => {
		const a = rectTiles(0, 0, 2, 2);
		const b = rectTiles(2, 2, 0, 0);
		expect(a.length).toBe(b.length);
	});
});

describe("markerKey", () => {
	test("creates unique keys", () => {
		const a = markerKey(0, 100, 200);
		const b = markerKey(0, 100, 201);
		const c = markerKey(1, 100, 200);
		expect(a).not.toBe(b);
		expect(a).not.toBe(c);
	});

	test("same inputs produce same key", () => {
		expect(markerKey(0, 50, 50)).toBe(markerKey(0, 50, 50));
	});
});

describe("packMarkers / unpackMarkers", () => {
	test("round-trips markers without labels", () => {
		const markers = [
			{ regionId: 12850, regionX: 22, regionY: 19, z: 0, color: "#FFFF0000" },
			{ regionId: 12850, regionX: 21, regionY: 19, z: 0, color: "#FF00FF00" },
		];
		const packed = packMarkers(markers);
		const unpacked = unpackMarkers(packed);
		expect(unpacked.length).toBe(2);
		expect(unpacked[0].regionId).toBe(12850);
		expect(unpacked[0].regionX).toBe(22);
		expect(unpacked[0].color).toBe("#FFFF0000");
		expect(unpacked[1].color).toBe("#FF00FF00");
	});

	test("round-trips markers with labels", () => {
		const markers = [
			{ regionId: 100, regionX: 5, regionY: 10, z: 1, color: "#FF0000FF", label: "Zulrah" },
			{ regionId: 200, regionX: 0, regionY: 0, z: 0, color: "#FFFF0000" },
		];
		const packed = packMarkers(markers);
		const unpacked = unpackMarkers(packed);
		expect(unpacked.length).toBe(2);
		expect(unpacked[0].label).toBe("Zulrah");
		expect(unpacked[1].label).toBeUndefined();
	});

	test("empty array round-trips", () => {
		const packed = packMarkers([]);
		const unpacked = unpackMarkers(packed);
		expect(unpacked.length).toBe(0);
	});
});

describe("rectOutlineTiles", () => {
	test("3x3 box returns 8 border tiles (interior excluded)", () => {
		const tiles = rectOutlineTiles(0, 0, 2, 2);
		expect(tiles.length).toBe(8);
		expect(tiles).toEqual(
			expect.arrayContaining([
				[0, 0], [1, 0], [2, 0],
				[0, 2], [1, 2], [2, 2],
				[0, 1], [2, 1],
			]),
		);
	});

	test("single tile returns that tile", () => {
		expect(rectOutlineTiles(5, 5, 5, 5)).toEqual([[5, 5]]);
	});

	test("horizontal 1xN line returns every tile", () => {
		const tiles = rectOutlineTiles(0, 0, 3, 0);
		expect(tiles.length).toBe(4);
	});

	test("swapped corners are equivalent", () => {
		const a = rectOutlineTiles(0, 0, 3, 3).sort();
		const b = rectOutlineTiles(3, 3, 0, 0).sort();
		expect(a).toEqual(b);
	});
});

describe("floodFill", () => {
	test("fills a connected region", () => {
		const filled = new Set(["0:0", "1:0", "0:1", "1:1"]);
		const { tiles, hitLimit } = floodFill(0, 0, (x, y) => filled.has(`${x}:${y}`));
		expect(hitLimit).toBe(false);
		expect(tiles.length).toBe(4);
	});

	test("does not cross boundaries", () => {
		// Two diagonal-only-connected regions — flood fill is 4-connected, so we only get one
		const filled = new Set(["0:0", "1:0", "2:1", "2:2"]);
		const { tiles } = floodFill(0, 0, (x, y) => filled.has(`${x}:${y}`));
		expect(tiles.length).toBe(2);
	});

	test("hits the tile cap on unbounded match", () => {
		const { tiles, hitLimit } = floodFill(0, 0, () => true, 100);
		expect(hitLimit).toBe(true);
		expect(tiles.length).toBe(100);
	});
});
