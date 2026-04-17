import L from "leaflet";
import "@/plugins/displays";

// -- Coordinate helpers --------------------------------------------------

function toRegionCoords(plane, globalX, globalY) {
	return {
		regionId: ((globalX >> 6) << 8) | (globalY >> 6),
		regionX: globalX & 63,
		regionY: globalY & 63,
		z: plane,
	};
}

function toGlobalCoords(regionId, regionX, regionY) {
	return {
		globalX: ((regionId >> 8) << 6) + regionX,
		globalY: ((regionId & 0xff) << 6) + regionY,
	};
}

// -- Color helpers -------------------------------------------------------

function argbToCss(argb) {
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

// opacity is 0.0-1.0
function cssToArgb(cssColor, opacity) {
	let hex = cssColor.replace("#", "");
	if (hex.length > 6) hex = hex.substring(0, 6);
	const a = Math.round((opacity != null ? opacity : 1) * 255);
	return `#${a.toString(16).padStart(2, "0").toUpperCase()}${hex.toUpperCase()}`;
}

// -- Geometry helpers ----------------------------------------------------

// Bresenham's line: returns array of [x, y] tile coords
function bresenhamLine(x0, y0, x1, y1) {
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
function rectTiles(x0, y0, x1, y1) {
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

// -- Marker key for fast duplicate lookups -------------------------------

function markerKey(plane, globalX, globalY) {
	return `${plane}:${globalX}:${globalY}`;
}

// -- URL serialization helpers -------------------------------------------

// Pack markers into binary (variable length due to labels):
//   regionId: uint16 (2), regionX: uint8 (1), regionY: uint8 (1),
//   z: uint8 (1), color ARGB: uint32 (4), labelLen: uint8 (1), label: UTF-8 (0-255)
function packMarkers(markers) {
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

function unpackMarkers(bytes) {
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
			regionId: regionId,
			regionX: regionX,
			regionY: regionY,
			z: z,
			color: `#${colorInt.toString(16).padStart(8, "0").toUpperCase()}`,
			label: label,
		});
		off += 10 + labelLen;
	}
	return markers;
}

// Compress with deflate, return base64url string
async function compressToUrl(bytes) {
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
	let offset = 0;
	for (const c of chunks) {
		result.set(c, offset);
		offset += c.length;
	}
	// base64url
	const b64 = btoa(String.fromCharCode(...result));
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Decompress base64url string back to bytes
async function decompressFromUrl(str) {
	// base64url -> base64
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
	let offset = 0;
	for (const c of chunks) {
		result.set(c, offset);
		offset += c.length;
	}
	return result;
}

// -- Tools ---------------------------------------------------------------

const TOOLS = [
	{ id: "point", label: "Point", cursor: "crosshair" },
	{ id: "freehand", label: "Freehand", cursor: "crosshair" },
	{ id: "line", label: "Line", cursor: "crosshair" },
	{ id: "rect", label: "Rect", cursor: "crosshair" },
	{ id: "eraser", label: "Eraser", cursor: "not-allowed" },
];

// -- Plugin --------------------------------------------------------------

L.Control.Display.TileMarkers = L.Control.Display.extend({
	options: {
		position: "bottomleft",
		title: "Tile Markers",
		icon: "images/Blue_square_(Prisoner_of_Glouphrie).png",
	},

	onAdd: function (map) {
		this._markers = [];
		this._markerIndex = {}; // key -> index for O(1) lookup
		this._activeColor = "#FFFF0000";
		this._cssColor = "#FFFF00";
		this._opacity = 1.0;
		this._tool = "point";
		this._drawing = false; // true while mouse is held during freehand/rect/eraser
		this._lineStart = null; // {x, y} for line tool first click
		this._rectStart = null; // {x, y} for rect tool drag start
		this._preview = null; // Leaflet layer for previews
		this._undoStack = []; // Array of actions: {type:'add'|'remove', tiles:[{plane,x,y,color}]}
		this._redoStack = [];
		this._pendingAction = null; // Accumulates tiles during a single draw gesture

		const container = L.Control.Display.prototype.onAdd.call(this, map);

		// Bind mouse handlers to the map container so we intercept before Leaflet dragging
		this._bindMapEvents();

		// Keyboard shortcuts
		this._onKeyDown = (e) => {
			if (!this._isActive()) return;
			if (e.key === "Escape") {
				this._cancelPending();
				this._updateHint();
			}
			// Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo
			const k = e.key.toLowerCase();
			if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) {
				e.preventDefault();
				this._undo();
			} else if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) {
				e.preventDefault();
				this._redo();
			}
			// 1-5 to switch tools
			const idx = parseInt(e.key, 10) - 1;
			if (idx >= 0 && idx < TOOLS.length) {
				this._setTool(TOOLS[idx].id);
			}
		};
		L.DomEvent.on(document, "keydown", this._onKeyDown, this);

		// Load markers from URL on init
		this._loadFromUrl();

		return container;
	},

	// -- UI --------------------------------------------------------------

	createInterface: function () {
		const container = L.DomUtil.create("div", "leaflet-control-display-expanded tilemarker-panel");

		// Tool selector
		const toolLabel = L.DomUtil.create("label", "tilemarker-label", container);
		toolLabel.innerHTML = "Tool";
		const toolSection = L.DomUtil.create("div", "tilemarker-section tilemarker-toolbar", container);
		this._toolBtns = {};
		for (const tool of TOOLS) {
			const btn = L.DomUtil.create("button", "tilemarker-btn tilemarker-tool-btn", toolSection);
			btn.innerHTML = tool.label;
			btn.dataset.tool = tool.id;
			btn.addEventListener("click", () => this._setTool(tool.id));
			this._toolBtns[tool.id] = btn;
		}
		this._toolBtns[this._tool].classList.add("tilemarker-btn-active");

		// Color picker + opacity
		const colorSection = L.DomUtil.create("div", "tilemarker-section tilemarker-color-section", container);
		const colorLabel = L.DomUtil.create("label", "tilemarker-label", colorSection);
		colorLabel.innerHTML = "Color";
		this._colorInput = L.DomUtil.create("input", "tilemarker-color", colorSection);
		this._colorInput.setAttribute("type", "color");
		this._colorInput.setAttribute("value", this._cssColor);

		this._opacityInput = L.DomUtil.create("input", "tilemarker-opacity", colorSection);
		this._opacityInput.setAttribute("type", "range");
		this._opacityInput.setAttribute("min", "0");
		this._opacityInput.setAttribute("max", "100");
		this._opacityInput.setAttribute("value", String(Math.round(this._opacity * 100)));

		this._opacityValue = L.DomUtil.create("span", "tilemarker-opacity-value", colorSection);
		this._opacityValue.innerHTML = "100%";

		const updateColor = () => {
			this._cssColor = this._colorInput.value;
			this._opacity = parseInt(this._opacityInput.value, 10) / 100;
			this._opacityValue.innerHTML = `${this._opacityInput.value}%`;
			this._activeColor = cssToArgb(this._cssColor, this._opacity);
		};
		this._colorInput.addEventListener("input", updateColor);
		this._opacityInput.addEventListener("input", updateColor);

		// Hint text
		this._hint = L.DomUtil.create("div", "tilemarker-hint", container);
		this._updateHint();

		// Counter
		const counterSection = L.DomUtil.create("div", "tilemarker-section", container);
		this._counter = L.DomUtil.create("span", "tilemarker-counter", counterSection);
		this._counter.innerHTML = "0 markers";

		// Import / Export / Clear
		const ioSection = L.DomUtil.create("div", "tilemarker-section", container);

		const importBtn = L.DomUtil.create("button", "tilemarker-btn", ioSection);
		importBtn.innerHTML = "Import";
		importBtn.addEventListener("click", () => this._import());

		const exportBtn = L.DomUtil.create("button", "tilemarker-btn", ioSection);
		exportBtn.innerHTML = "Export";
		exportBtn.addEventListener("click", () => this._export());

		const clearBtn = L.DomUtil.create("button", "tilemarker-btn tilemarker-btn-danger", ioSection);
		clearBtn.innerHTML = "Clear All";
		clearBtn.addEventListener("click", () => this._clearAll());

		return container;
	},

	_setTool: function (toolId) {
		this._tool = toolId;
		this._cancelPending();
		for (const id in this._toolBtns) {
			this._toolBtns[id].classList.toggle("tilemarker-btn-active", id === toolId);
		}
		const toolDef = TOOLS.find((t) => t.id === toolId);
		this._map.getContainer().style.cursor = toolDef ? toolDef.cursor : "";
		this._updateHint();
	},

	_updateHint: function () {
		if (!this._hint) return;
		const hints = {
			point: "Click to place, click existing to edit. [1]",
			freehand: "Click and drag to paint tiles. [2]",
			line: "Click start, then click end. [3]",
			rect: "Click and drag to fill a rectangle. [4]",
			eraser: "Click or drag to remove markers. [5]",
		};
		this._hint.innerHTML = hints[this._tool] || "";
	},

	// Cancel any in-progress line start / preview
	_cancelPending: function () {
		this._lineStart = null;
		this._rectStart = null;
		this._drawing = false;
		this._removePreview();
	},

	_removePreview: function () {
		if (this._preview) {
			this._preview.remove();
			this._preview = null;
		}
	},

	// -- Event binding ---------------------------------------------------

	_bindMapEvents: function () {
		const map = this._map;

		map.on("mousedown", this._onMouseDown, this);
		map.on("mousemove", this._onMouseMove, this);
		map.on("mouseup", this._onMouseUp, this);
		map.on("click", this._onMapClick, this);

		// Cancel drawing if mouse leaves the map
		map.on("mouseout", () => {
			if (this._drawing) this._endDraw();
		});
	},

	_isActive: function () {
		return this._container?.contains(this.expanded);
	},

	_tileAt: (e) => ({
		x: Math.floor(e.latlng.lng),
		y: Math.floor(e.latlng.lat),
	}),

	// -- Mouse handlers --------------------------------------------------

	_onMouseDown: function (e) {
		if (!this._isActive()) return;
		const tile = this._tileAt(e);
		const tool = this._tool;

		if (tool === "freehand") {
			this._drawing = true;
			this._map.dragging.disable();
			this._beginAction("add");
			this._placeMarker(this._map.getPlane(), tile.x, tile.y);
		} else if (tool === "rect") {
			this._drawing = true;
			this._rectStart = tile;
			this._map.dragging.disable();
		} else if (tool === "eraser") {
			this._drawing = true;
			this._map.dragging.disable();
			this._beginAction("remove");
			this._removeMarker(this._map.getPlane(), tile.x, tile.y);
		}
	},

	_onMouseMove: function (e) {
		if (!this._isActive()) return;
		const tile = this._tileAt(e);

		if (this._tool === "freehand" && this._drawing) {
			this._placeMarker(this._map.getPlane(), tile.x, tile.y);
		} else if (this._tool === "eraser" && this._drawing) {
			this._removeMarker(this._map.getPlane(), tile.x, tile.y);
		} else if (this._tool === "rect" && this._drawing && this._rectStart) {
			this._showRectPreview(this._rectStart, tile);
		} else if (this._tool === "line" && this._lineStart) {
			this._showLinePreview(this._lineStart, tile);
		}
	},

	_onMouseUp: function (e) {
		if (!this._isActive()) return;
		const tile = this._tileAt(e);

		if (this._tool === "rect" && this._drawing && this._rectStart) {
			this._beginAction("add");
			this._commitRect(this._rectStart, tile);
			this._commitAction();
			this._endDraw();
		} else if ((this._tool === "freehand" || this._tool === "eraser") && this._drawing) {
			this._commitAction();
			this._endDraw();
		}
	},

	_onMapClick: function (e) {
		if (!this._isActive()) return;
		const tile = this._tileAt(e);
		const plane = this._map.getPlane();

		if (this._tool === "point") {
			const key = markerKey(plane, tile.x, tile.y);
			const existingIdx = this._markerIndex[key];
			if (existingIdx !== undefined) {
				this._editMarker(existingIdx, tile.x, tile.y);
			} else {
				this._beginAction("add");
				this._placeMarker(plane, tile.x, tile.y);
				this._commitAction();
			}
		} else if (this._tool === "line") {
			if (!this._lineStart) {
				this._lineStart = tile;
				this._hint.innerHTML = "Now click the end tile. (Esc to cancel)";
			} else {
				this._beginAction("add");
				this._commitLine(this._lineStart, tile);
				this._commitAction();
				this._lineStart = null;
				this._removePreview();
				this._updateHint();
			}
		}
	},

	_editMarker: function (idx, tileX, tileY) {
		const marker = this._markers[idx];
		// Parse the current ARGB color to get the CSS hex and alpha
		const hex = marker.color.replace("#", "");
		const currentAlpha = hex.length === 8 ? parseInt(hex.substring(0, 2), 16) : 255;
		const currentRgb = `#${hex.length === 8 ? hex.substring(2) : hex}`;
		const currentLabel = marker.label || "";

		const popup = L.popup({
			closeButton: true,
			autoClose: true,
			className: "tilemarker-edit-popup",
			minWidth: 180,
		})
			.setLatLng([tileY + 0.5, tileX + 0.5])
			.setContent(
				'<div class="tilemarker-edit">' +
					'  <label class="tilemarker-edit-label">Color</label>' +
					'  <div class="tilemarker-edit-row">' +
					'    <input type="color" class="tilemarker-edit-color" value="' +
					currentRgb +
					'">' +
					'    <input type="range" class="tilemarker-edit-opacity" min="0" max="100" value="' +
					Math.round((currentAlpha / 255) * 100) +
					'">' +
					'    <span class="tilemarker-edit-opacity-val">' +
					Math.round((currentAlpha / 255) * 100) +
					"%</span>" +
					"  </div>" +
					'  <label class="tilemarker-edit-label">Label</label>' +
					'  <input type="text" class="tilemarker-edit-text" value="' +
					currentLabel.replace(/"/g, "&quot;") +
					'" placeholder="optional label" maxlength="255">' +
					'  <div class="tilemarker-edit-row" style="margin-top:6px">' +
					'    <button class="tilemarker-btn tilemarker-edit-save">Save</button>' +
					'    <button class="tilemarker-btn tilemarker-btn-danger tilemarker-edit-delete">Delete</button>' +
					"  </div>" +
					"</div>",
			)
			.openOn(this._map);

		const container = popup.getElement();

		const opacityInput = container.querySelector(".tilemarker-edit-opacity");
		const opacityVal = container.querySelector(".tilemarker-edit-opacity-val");
		opacityInput.addEventListener("input", () => {
			opacityVal.textContent = `${opacityInput.value}%`;
		});

		container.querySelector(".tilemarker-edit-save").addEventListener("click", () => {
			const newRgb = container.querySelector(".tilemarker-edit-color").value;
			const newOpacity = parseInt(opacityInput.value, 10) / 100;
			const newColor = cssToArgb(newRgb, newOpacity);
			const newLabel = container.querySelector(".tilemarker-edit-text").value.trim() || undefined;

			marker.color = newColor;
			marker.label = newLabel;
			const cssColor = argbToCss(newColor);
			marker.rectangle.setStyle({ color: cssColor, fillColor: cssColor });

			this._map.closePopup(popup);
			this._scheduleSyncToUrl();
		});

		container.querySelector(".tilemarker-edit-delete").addEventListener("click", () => {
			const plane = marker.z;
			const coords = toGlobalCoords(marker.regionId, marker.regionX, marker.regionY);
			this._beginAction("remove");
			this._removeMarker(plane, coords.globalX, coords.globalY);
			this._commitAction();
			this._map.closePopup(popup);
		});
	},

	_endDraw: function () {
		this._drawing = false;
		this._rectStart = null;
		this._removePreview();
		this._map.dragging.enable();
	},

	// -- Preview rendering -----------------------------------------------

	_showRectPreview: function (start, end) {
		this._removePreview();
		const minX = Math.min(start.x, end.x);
		const maxX = Math.max(start.x, end.x);
		const minY = Math.min(start.y, end.y);
		const maxY = Math.max(start.y, end.y);
		this._preview = L.rectangle(
			[
				[minY, minX],
				[maxY + 1, maxX + 1],
			],
			{ color: this._cssColor, fillOpacity: 0.15, weight: 1, dashArray: "4", interactive: false },
		).addTo(this._map);
	},

	_showLinePreview: function (start, end) {
		this._removePreview();
		// Show a polyline through tile centers
		this._preview = L.polyline(
			[
				[start.y + 0.5, start.x + 0.5],
				[end.y + 0.5, end.x + 0.5],
			],
			{ color: this._cssColor, weight: 2, dashArray: "4", interactive: false },
		).addTo(this._map);
	},

	// -- Shape commits ---------------------------------------------------

	_commitRect: function (start, end) {
		const plane = this._map.getPlane();
		const tiles = rectTiles(start.x, start.y, end.x, end.y);
		for (const [x, y] of tiles) {
			this._placeMarker(plane, x, y);
		}
	},

	_commitLine: function (start, end) {
		const plane = this._map.getPlane();
		const tiles = bresenhamLine(start.x, start.y, end.x, end.y);
		for (const [x, y] of tiles) {
			this._placeMarker(plane, x, y);
		}
	},

	// -- Undo / Redo -----------------------------------------------------

	_beginAction: function (type) {
		this._pendingAction = { type: type, tiles: [] };
	},

	_commitAction: function () {
		if (this._pendingAction && this._pendingAction.tiles.length > 0) {
			this._undoStack.push(this._pendingAction);
			this._redoStack = [];
		}
		this._pendingAction = null;
	},

	_undo: function () {
		if (this._undoStack.length === 0) return;
		const action = this._undoStack.pop();

		if (action.type === "add") {
			// Reverse: remove these tiles
			const redoTiles = [];
			for (const t of action.tiles) {
				const key = markerKey(t.plane, t.x, t.y);
				const idx = this._markerIndex[key];
				if (idx === undefined) continue;
				const m = this._markers[idx];
				redoTiles.push({ plane: t.plane, x: t.x, y: t.y, color: m.color, label: m.label });
				this._rawRemove(key, idx);
			}
			this._redoStack.push({ type: "add", tiles: redoTiles });
		} else {
			// Reverse: re-add these tiles
			const redoTiles = [];
			for (const t of action.tiles) {
				redoTiles.push({ plane: t.plane, x: t.x, y: t.y, color: t.color, label: t.label });
				this._rawPlace(t.plane, t.x, t.y, t.color, t.label);
			}
			this._redoStack.push({ type: "remove", tiles: redoTiles });
		}
		this._updateCounter();
	},

	_redo: function () {
		if (this._redoStack.length === 0) return;
		const action = this._redoStack.pop();

		if (action.type === "add") {
			// Re-add tiles
			const undoTiles = [];
			for (const t of action.tiles) {
				undoTiles.push({ plane: t.plane, x: t.x, y: t.y, color: t.color, label: t.label });
				this._rawPlace(t.plane, t.x, t.y, t.color, t.label);
			}
			this._undoStack.push({ type: "add", tiles: undoTiles });
		} else {
			// Re-remove tiles
			const undoTiles = [];
			for (const t of action.tiles) {
				const key = markerKey(t.plane, t.x, t.y);
				const idx = this._markerIndex[key];
				if (idx === undefined) continue;
				const m = this._markers[idx];
				undoTiles.push({ plane: t.plane, x: t.x, y: t.y, color: m.color, label: m.label });
				this._rawRemove(key, idx);
			}
			this._undoStack.push({ type: "remove", tiles: undoTiles });
		}
		this._updateCounter();
	},

	// -- Marker CRUD -----------------------------------------------------

	// Place with undo tracking (called by tools)
	_placeMarker: function (plane, globalX, globalY) {
		const key = markerKey(plane, globalX, globalY);
		if (this._markerIndex[key] !== undefined) return;

		this._rawPlace(plane, globalX, globalY, this._activeColor);

		if (this._pendingAction) {
			this._pendingAction.tiles.push({ plane: plane, x: globalX, y: globalY, color: this._activeColor });
		}
		this._updateCounter();
	},

	// Remove with undo tracking (called by tools)
	_removeMarker: function (plane, globalX, globalY) {
		const key = markerKey(plane, globalX, globalY);
		const idx = this._markerIndex[key];
		if (idx === undefined) return;

		const m = this._markers[idx];
		if (this._pendingAction) {
			this._pendingAction.tiles.push({ plane: plane, x: globalX, y: globalY, color: m.color, label: m.label });
		}
		this._rawRemove(key, idx);
		this._updateCounter();
	},

	// Low-level place (no undo tracking)
	_rawPlace: function (plane, globalX, globalY, color, label) {
		const key = markerKey(plane, globalX, globalY);
		if (this._markerIndex[key] !== undefined) return;

		const region = toRegionCoords(plane, globalX, globalY);
		const cssColor = argbToCss(color);

		const rectangle = L.rectangle(
			[
				[globalY, globalX],
				[globalY + 1, globalX + 1],
			],
			{ color: cssColor, fillColor: cssColor, fillOpacity: 0.4, weight: 2, interactive: false },
		).addTo(this._map);

		this._markerIndex[key] = this._markers.length;
		this._markers.push({
			regionId: region.regionId,
			regionX: region.regionX,
			regionY: region.regionY,
			z: region.z,
			color: color,
			label: label || undefined,
			rectangle: rectangle,
		});
	},

	// Low-level remove (no undo tracking)
	_rawRemove: function (key, idx) {
		this._markers[idx].rectangle.remove();
		const last = this._markers.length - 1;
		if (idx !== last) {
			const moved = this._markers[last];
			this._markers[idx] = moved;
			const movedCoords = toGlobalCoords(moved.regionId, moved.regionX, moved.regionY);
			this._markerIndex[markerKey(moved.z, movedCoords.globalX, movedCoords.globalY)] = idx;
		}
		this._markers.pop();
		delete this._markerIndex[key];
	},

	_updateCounter: function () {
		if (this._counter) {
			const n = this._markers.length;
			this._counter.innerHTML = n + (n === 1 ? " marker" : " markers");
		}
		this._scheduleSyncToUrl();
	},

	// -- URL sync --------------------------------------------------------

	_scheduleSyncToUrl: function () {
		if (this._syncTimer) clearTimeout(this._syncTimer);
		this._syncTimer = setTimeout(() => this._syncToUrl(), 300);
	},

	_syncToUrl: function () {
		const url = new URL(window.location.href);
		if (this._markers.length === 0) {
			url.searchParams.delete("markers");
			history.replaceState(null, "", url);
			return;
		}
		const packed = packMarkers(this._markers);
		compressToUrl(packed).then((encoded) => {
			url.searchParams.set("markers", encoded);
			history.replaceState(null, "", url);
		});
	},

	_loadFromUrl: function () {
		const url = new URL(window.location.href);
		const encoded = url.searchParams.get("markers");
		if (!encoded) return;

		decompressFromUrl(encoded)
			.then((bytes) => {
				const data = unpackMarkers(bytes);
				for (const m of data) {
					const coords = toGlobalCoords(m.regionId, m.regionX, m.regionY);
					const key = markerKey(m.z, coords.globalX, coords.globalY);
					if (this._markerIndex[key] !== undefined) continue;
					this._rawPlace(m.z, coords.globalX, coords.globalY, m.color, m.label);
				}
				this._updateCounter();
				if (data.length > 0) {
					const first = data[0];
					const coords = toGlobalCoords(first.regionId, first.regionX, first.regionY);
					this._map.setPlane(first.z);
					this._map.flyTo([coords.globalY, coords.globalX], 3, { duration: 1, animate: false });
				}
			})
			.catch((e) => {
				console.error("Failed to load markers from URL:", e);
			});
	},

	// -- Import / Export -------------------------------------------------

	_import: function () {
		const input = prompt("Paste RuneLite Ground Markers JSON:");
		if (!input) return;

		try {
			const data = JSON.parse(input);
			if (!Array.isArray(data)) {
				this._map.addMessage("Invalid format: expected a JSON array");
				return;
			}

			let count = 0;
			for (const marker of data) {
				if (marker.regionId == null || marker.regionX == null || marker.regionY == null) continue;

				const plane = marker.z || 0;
				const coords = toGlobalCoords(marker.regionId, marker.regionX, marker.regionY);
				const key = markerKey(plane, coords.globalX, coords.globalY);
				if (this._markerIndex[key] !== undefined) continue;

				let color = "#FFFF0000";
				if (typeof marker.color === "string") {
					color = marker.color;
				} else if (marker.color && typeof marker.color === "object" && marker.color.value != null) {
					const intColor = marker.color.value >>> 0;
					color = `#${intColor.toString(16).padStart(8, "0").toUpperCase()}`;
				}

				const cssColor = argbToCss(color);
				const rectangle = L.rectangle(
					[
						[coords.globalY, coords.globalX],
						[coords.globalY + 1, coords.globalX + 1],
					],
					{ color: cssColor, fillColor: cssColor, fillOpacity: 0.4, weight: 2, interactive: false },
				).addTo(this._map);

				const m = {
					regionId: marker.regionId,
					regionX: marker.regionX,
					regionY: marker.regionY,
					z: plane,
					color: color,
					label: marker.label || undefined,
					rectangle: rectangle,
				};
				this._markerIndex[key] = this._markers.length;
				this._markers.push(m);
				count++;
			}

			this._updateCounter();
			this._map.addMessage(`Imported ${count} marker(s)`);

			if (count > 0) {
				const first = data[0];
				const coords = toGlobalCoords(first.regionId, first.regionX, first.regionY);
				this._map.setPlane(first.z || 0);
				this._map.flyTo([coords.globalY, coords.globalX], 3, { duration: 1, animate: false });
			}
		} catch (e) {
			this._map.addMessage(`Failed to parse JSON: ${e.message}`);
		}
	},

	_export: function () {
		if (this._markers.length === 0) {
			this._map.addMessage("No markers to export");
			return;
		}

		const data = this._markers.map((m) => {
			const entry = {
				regionId: m.regionId,
				regionX: m.regionX,
				regionY: m.regionY,
				z: m.z,
				color: m.color,
			};
			if (m.label) entry.label = m.label;
			return entry;
		});

		const json = JSON.stringify(data);
		navigator.clipboard.writeText(json).then(
			() => {
				this._map.addMessage(`Exported ${data.length} marker(s) to clipboard`);
			},
			() => {
				prompt("Copy this JSON:", json);
			},
		);
	},

	_clearAll: function () {
		if (this._markers.length === 0) return;
		if (!confirm(`Remove all ${this._markers.length} markers?`)) return;

		for (const m of this._markers) {
			m.rectangle.remove();
		}
		this._markers = [];
		this._markerIndex = {};
		this._updateCounter();
		this._map.addMessage("All markers cleared");
	},

	// -- Expand / Collapse -----------------------------------------------

	expand: function () {
		L.DomUtil.addClass(this._map.getContainer(), "tilemarker-active");
		const toolDef = TOOLS.find((t) => t.id === this._tool);
		if (toolDef) this._map.getContainer().style.cursor = toolDef.cursor;
		return L.Control.Display.prototype.expand.call(this);
	},

	collapse: function () {
		this._cancelPending();
		L.DomUtil.removeClass(this._map.getContainer(), "tilemarker-active");
		this._map.getContainer().style.cursor = "";
		this._map.dragging.enable();
		return L.Control.Display.prototype.collapse.call(this);
	},
});

L.control.display.tileMarkers = (options) => new L.Control.Display.TileMarkers(options);

L.Map.addInitHook(function () {
	if (this.options.tileMarkers) {
		this.tileMarkers = L.control.display.tileMarkers();
		this.addControl(this.tileMarkers);
	}
});

// -- Exports for testing -------------------------------------------------

export { argbToCss, bresenhamLine, cssToArgb, markerKey, rectTiles, toGlobalCoords, toRegionCoords };
