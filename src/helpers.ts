// Pure helper functions for tile marker operations.
// No Leaflet dependency — safe to import in tests or server-side.

// Convert global OSRS coordinates to RuneLite region format
export function toRegionCoords(plane, globalX, globalY) {
	return {
		regionId: ((globalX >> 6) << 8) | (globalY >> 6),
		regionX: globalX & 63,
		regionY: globalY & 63,
		z: plane,
	};
}

// Convert RuneLite region format back to global OSRS coordinates
export function toGlobalCoords(regionId, regionX, regionY) {
	return {
		globalX: ((regionId >> 8) << 6) + regionX,
		globalY: ((regionId & 0xff) << 6) + regionY,
	};
}

// Parse ARGB hex string (#AARRGGBB) to CSS rgba
export function argbToCss(argb) {
	if (!argb || typeof argb !== "string") return "rgba(255, 255, 0, 0.5)";
	const hex = argb.replace("#", "");
	if (hex.length === 8) {
		const a = parseInt(hex.substring(0, 2), 16) / 255;
		const r = parseInt(hex.substring(2, 4), 16);
		const g = parseInt(hex.substring(4, 6), 16);
		const b = parseInt(hex.substring(6, 8), 16);
		return `rgba(${r}, ${g}, ${b}, ${Math.max(a, 0.3)})`;
	}
	if (hex.length === 6) {
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, 0.5)`;
	}
	return "rgba(255, 255, 0, 0.5)";
}

// Convert CSS color (#RRGGBB) + opacity to RuneLite ARGB format (#AARRGGBB)
export function cssToArgb(cssColor, opacity?) {
	let hex = cssColor.replace("#", "");
	if (hex.length > 6) hex = hex.substring(0, 6);
	const a = Math.round((opacity != null ? opacity : 1) * 255);
	return `#${a.toString(16).padStart(2, "0").toUpperCase()}${hex.toUpperCase()}`;
}

// Bresenham's line: returns array of [x, y] tile coords
export function bresenhamLine(x0, y0, x1, y1) {
	const tiles = [];
	const dx = Math.abs(x1 - x0),
		sx = x0 < x1 ? 1 : -1;
	const dy = -Math.abs(y1 - y0),
		sy = y0 < y1 ? 1 : -1;
	let err = dx + dy;
	while (true) {
		tiles.push([x0, y0]);
		if (x0 === x1 && y0 === y1) break;
		const e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			x0 += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y0 += sy;
		}
	}
	return tiles;
}

// All tiles in a filled rectangle (inclusive)
export function rectTiles(x0, y0, x1, y1) {
	const tiles = [];
	const minX = Math.min(x0, x1),
		maxX = Math.max(x0, x1);
	const minY = Math.min(y0, y1),
		maxY = Math.max(y0, y1);
	for (let x = minX; x <= maxX; x++) {
		for (let y = minY; y <= maxY; y++) {
			tiles.push([x, y]);
		}
	}
	return tiles;
}

// Just the border of a rectangle (inclusive).
// thickness=1 is a single-tile border; higher values add concentric rings inward.
export function rectOutlineTiles(x0, y0, x1, y1, thickness = 1) {
	const tiles: [number, number][] = [];
	const seen = new Set<string>();
	const minX = Math.min(x0, x1),
		maxX = Math.max(x0, x1);
	const minY = Math.min(y0, y1),
		maxY = Math.max(y0, y1);
	for (let t = 0; t < thickness; t++) {
		const lx = minX + t,
			rx = maxX - t,
			ty = minY + t,
			by = maxY - t;
		if (lx > rx || ty > by) break;
		const push = (x: number, y: number) => {
			const k = `${x}:${y}`;
			if (!seen.has(k)) {
				seen.add(k);
				tiles.push([x, y]);
			}
		};
		for (let x = lx; x <= rx; x++) {
			push(x, ty);
			if (ty !== by) push(x, by);
		}
		for (let y = ty + 1; y < by; y++) {
			push(lx, y);
			if (lx !== rx) push(rx, y);
		}
	}
	return tiles;
}

// Square brush footprint centred at (cx, cy). size=1 → just the tile.
export function brushTiles(cx: number, cy: number, size: number): [number, number][] {
	const r = Math.max(0, size - 1);
	const tiles: [number, number][] = [];
	for (let dx = -r; dx <= r; dx++) {
		for (let dy = -r; dy <= r; dy++) {
			tiles.push([cx + dx, cy + dy]);
		}
	}
	return tiles;
}

// 4-connected flood fill starting at (startX, startY).
// `match` decides whether a tile belongs to the region to fill.
// Returns { tiles, hitLimit } — if hitLimit is true the search was aborted.
export function floodFill(
	startX: number,
	startY: number,
	match: (x: number, y: number) => boolean,
	maxTiles = 10000,
) {
	const tiles: [number, number][] = [];
	const visited = new Set<string>();
	const stack: [number, number][] = [[startX, startY]];

	while (stack.length > 0) {
		if (tiles.length >= maxTiles) return { tiles, hitLimit: true };
		const [x, y] = stack.pop()!;
		const key = `${x}:${y}`;
		if (visited.has(key)) continue;
		visited.add(key);
		if (!match(x, y)) continue;
		tiles.push([x, y]);
		stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
	}
	return { tiles, hitLimit: false };
}

// Marker key for fast duplicate lookups
export function markerKey(plane, globalX, globalY) {
	return `${plane}:${globalX}:${globalY}`;
}

// Pack markers into binary (variable length due to labels)
export function packMarkers(markers) {
	const encoder = new TextEncoder();
	const parts = [];
	let totalLen = 0;
	for (const m of markers) {
		const labelBytes = m.label ? encoder.encode(m.label) : new Uint8Array(0);
		const labelLen = Math.min(labelBytes.length, 255);
		const chunk = new Uint8Array(10 + labelLen);
		const view = new DataView(chunk.buffer);
		view.setUint16(0, m.regionId);
		chunk[2] = m.regionX;
		chunk[3] = m.regionY;
		chunk[4] = m.z;
		const colorInt = parseInt(m.color.replace("#", ""), 16) >>> 0;
		view.setUint32(5, colorInt);
		chunk[9] = labelLen;
		if (labelLen > 0) chunk.set(labelBytes.subarray(0, labelLen), 10);
		parts.push(chunk);
		totalLen += chunk.length;
	}
	const result = new Uint8Array(totalLen);
	let offset = 0;
	for (const p of parts) {
		result.set(p, offset);
		offset += p.length;
	}
	return result;
}

// Compress bytes to base64url string via deflate
export async function compressToUrl(bytes) {
	const cs = new CompressionStream("deflate-raw");
	const writer = cs.writable.getWriter();
	writer.write(bytes);
	writer.close();
	const chunks = [];
	const reader = cs.readable.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const totalLen = chunks.reduce((s, c) => s + c.length, 0);
	const result = new Uint8Array(totalLen);
	let off = 0;
	for (const c of chunks) {
		result.set(c, off);
		off += c.length;
	}
	const b64 = btoa(String.fromCharCode(...result));
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Decompress base64url string back to bytes
export async function decompressFromUrl(str) {
	let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
	const pad = (4 - (b64.length % 4)) % 4;
	b64 += "=".repeat(pad);
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

	const ds = new DecompressionStream("deflate-raw");
	const writer = ds.writable.getWriter();
	writer.write(bytes);
	writer.close();
	const chunks = [];
	const reader = ds.readable.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const totalLen = chunks.reduce((s, c) => s + c.length, 0);
	const result = new Uint8Array(totalLen);
	let off = 0;
	for (const c of chunks) {
		result.set(c, off);
		off += c.length;
	}
	return result;
}

// Unpack markers from binary
export function unpackMarkers(bytes) {
	const decoder = new TextDecoder();
	const markers = [];
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let off = 0;
	while (off + 10 <= bytes.length) {
		const regionId = view.getUint16(off);
		const regionX = bytes[off + 2];
		const regionY = bytes[off + 3];
		const z = bytes[off + 4];
		const colorInt = view.getUint32(off + 5) >>> 0;
		const labelLen = bytes[off + 9];
		let label;
		if (labelLen > 0 && off + 10 + labelLen <= bytes.length) {
			label = decoder.decode(bytes.subarray(off + 10, off + 10 + labelLen));
		}
		markers.push({
			regionId,
			regionX,
			regionY,
			z,
			color: `#${colorInt.toString(16).padStart(8, "0").toUpperCase()}`,
			label,
		});
		off += 10 + labelLen;
	}
	return markers;
}
