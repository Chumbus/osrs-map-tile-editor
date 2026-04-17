import L from "leaflet";

// Core extensions
import "@/layers";

// Plugins (side-effect imports — they extend L)
import "@/plugins/fullscreen";
import "@/plugins/mapSelector";
import "@/plugins/zoom";
import "@/plugins/plane";
import "@/plugins/position";
import "@/plugins/displays";
import "@/plugins/urllayers";
import "@/plugins/rect";
import "@/plugins/clickcopy";
import "@/plugins/maplabels";
import "@/plugins/mapicons";
import "@/plugins/overworldlabels";

import { toolStore } from "@/stores/tools.svelte";
import { markerStore } from "@/stores/markers.svelte";
import { mapStore } from "@/stores/map.svelte";
import { layerStore } from "@/stores/layers.svelte";
import { argbToCss, bresenhamLine, rectTiles, toGlobalCoords } from "@/helpers";

// Rectangle cache: key → L.Rectangle
const rectangles: Record<string, L.Rectangle> = {};

function makeKey(plane: number, x: number, y: number) {
	return `${plane}:${x}:${y}`;
}

export function initMap(container: HTMLElement) {
	const map = (L as any).gameMap(container, {
		maxBounds: [
			[-1000, -1000],
			[12800 + 1000, 12800 + 1000],
		],
		maxBoundsViscosity: 0.5,
		customZoomControl: false,
		fullscreenControl: false,
		planeControl: false,
		positionControl: true,
		messageBox: true,
		initialMapId: -1,
		plane: 0,
		x: 3200,
		y: 3200,
		minPlane: 0,
		maxPlane: 3,
		minZoom: -4,
		maxZoom: 8,
		doubleClickZoom: false,
		showMapBorder: true,
		enableUrlLocation: true,
	});

	// Tile layer
	(L as any).tileLayer
		.main("https://pub-2e3f94de41b64e66a90f86810d405566.r2.dev/{zoom}/{plane}_{x}_{y}.png", {
			minZoom: -4,
			maxNativeZoom: 4,
			maxZoom: 8,
		})
		.addTo(map)
		.bringToBack();

	// Optional layers
	const grid = (L as any).grid({ bounds: [[0, 0], [12800, 6400]] });
	const dungeonLabels = (L as any).maplabelGroup({
		API_KEY: "AIzaSyBrYT0-aS9VpW2Aenm-pJ2UCUhih8cZ4g8",
		SHEET_ID: "1859HuKw5dXqmfakFd6e6kQ_PEXQA02namB4aNVQ0qpY",
	});
	const mapIcons = (L as any).mapIconLayer();
	const overworldLabels = (L as any).overworldLabelLayer();

	// Register layers with store (sidebar controls toggle them)
	layerStore.register("map-icons", "Map Icons", mapIcons, map);
	layerStore.register("area-labels", "Area Labels", overworldLabels, map);
	layerStore.register("dungeon-labels", "Dungeon Labels", dungeonLabels, map);
	layerStore.register("grid", "Grid", grid, map);

	// Register map instance with store
	mapStore.setInstance(map);

	// --- Bridge store ↔ Leaflet rendering ---

	markerStore.onPlace = (plane, x, y, color) => {
		const key = makeKey(plane, x, y);
		if (rectangles[key]) return;
		const css = argbToCss(color);
		rectangles[key] = L.rectangle(
			[[y, x], [y + 1, x + 1]],
			{ color: css, fillColor: css, fillOpacity: 0.4, weight: 2, interactive: false },
		).addTo(map);
	};

	markerStore.onRemove = (plane, x, y) => {
		const key = makeKey(plane, x, y);
		if (rectangles[key]) {
			rectangles[key].remove();
			delete rectangles[key];
		}
	};

	// Load markers from URL (after bridge is set up so they render)
	markerStore.loadFromUrl();

	// --- Drawing interaction ---

	let drawing = false;
	let lineStart: { x: number; y: number } | null = null;
	let rectStart: { x: number; y: number } | null = null;
	let preview: L.Layer | null = null;

	function tileAt(e: any) {
		return { x: Math.floor(e.latlng.lng), y: Math.floor(e.latlng.lat) };
	}

	function removePreview() {
		if (preview) {
			(preview as any).remove();
			preview = null;
		}
	}

	// --- Middle-click drag to pan (works regardless of active tool) ---
	let middleDragging = false;
	let middleStart = { x: 0, y: 0 };

	container.addEventListener("pointerdown", (e: PointerEvent) => {
		if (e.button === 1) {
			e.preventDefault();
			middleDragging = true;
			middleStart = { x: e.clientX, y: e.clientY };
			container.setPointerCapture(e.pointerId);
		}
	});
	container.addEventListener("pointermove", (e: PointerEvent) => {
		if (!middleDragging) return;
		const dx = e.clientX - middleStart.x;
		const dy = e.clientY - middleStart.y;
		middleStart = { x: e.clientX, y: e.clientY };
		map.panBy([-dx, -dy], { animate: false });
	});
	container.addEventListener("pointerup", (e: PointerEvent) => {
		if (e.button === 1) middleDragging = false;
	});
	// Prevent middle-click scroll icon
	container.addEventListener("auxclick", (e: MouseEvent) => {
		if (e.button === 1) e.preventDefault();
	});

	// --- Drawing interaction ---

	map.on("mousedown", (e: any) => {
		if (e.originalEvent.button !== 0) return; // left click only
		const tile = tileAt(e);
		const tool = toolStore.activeTool;

		if (tool === "hand") return; // hand tool: Leaflet handles panning natively

		if (tool === "freehand") {
			drawing = true;
			map.dragging.disable();
			markerStore.beginAction();
			markerStore.place(map.getPlane(), tile.x, tile.y, toolStore.argbColor);
		} else if (tool === "rect") {
			drawing = true;
			rectStart = tile;
			map.dragging.disable();
		} else if (tool === "eraser") {
			drawing = true;
			map.dragging.disable();
			markerStore.beginAction();
			markerStore.remove(map.getPlane(), tile.x, tile.y);
		}
	});

	map.on("mousemove", (e: any) => {
		const tile = tileAt(e);
		if (toolStore.activeTool === "freehand" && drawing) {
			markerStore.place(map.getPlane(), tile.x, tile.y, toolStore.argbColor);
		} else if (toolStore.activeTool === "eraser" && drawing) {
			markerStore.remove(map.getPlane(), tile.x, tile.y);
		} else if (toolStore.activeTool === "rect" && drawing && rectStart) {
			removePreview();
			const minX = Math.min(rectStart.x, tile.x);
			const maxX = Math.max(rectStart.x, tile.x);
			const minY = Math.min(rectStart.y, tile.y);
			const maxY = Math.max(rectStart.y, tile.y);
			preview = L.rectangle(
				[[minY, minX], [maxY + 1, maxX + 1]],
				{ color: toolStore.cssColor, fillOpacity: 0.15, weight: 1, dashArray: "4", interactive: false },
			).addTo(map);
		} else if (toolStore.activeTool === "line" && lineStart) {
			removePreview();
			preview = L.polyline(
				[[lineStart.y + 0.5, lineStart.x + 0.5], [tile.y + 0.5, tile.x + 0.5]],
				{ color: toolStore.cssColor, weight: 2, dashArray: "4", interactive: false },
			).addTo(map);
		}
	});

	map.on("mouseup", (e: any) => {
		const tile = tileAt(e);
		if (toolStore.activeTool === "rect" && drawing && rectStart) {
			markerStore.beginAction();
			const plane = map.getPlane();
			for (const [x, y] of rectTiles(rectStart.x, rectStart.y, tile.x, tile.y)) {
				markerStore.place(plane, x, y, toolStore.argbColor);
			}
			markerStore.commitAction();
			endDraw();
		} else if ((toolStore.activeTool === "freehand" || toolStore.activeTool === "eraser") && drawing) {
			markerStore.commitAction();
			endDraw();
		}
	});

	map.on("click", (e: any) => {
		const tile = tileAt(e);
		const plane = map.getPlane();

		if (toolStore.activeTool === "point") {
			if (markerStore.has(plane, tile.x, tile.y)) {
				openEditPopup(map, plane, tile.x, tile.y);
			} else {
				markerStore.beginAction();
				markerStore.place(plane, tile.x, tile.y, toolStore.argbColor);
				markerStore.commitAction();
			}
		} else if (toolStore.activeTool === "line") {
			if (!lineStart) {
				lineStart = tile;
			} else {
				markerStore.beginAction();
				const plane = map.getPlane();
				for (const [x, y] of bresenhamLine(lineStart.x, lineStart.y, tile.x, tile.y)) {
					markerStore.place(plane, x, y, toolStore.argbColor);
				}
				markerStore.commitAction();
				lineStart = null;
				removePreview();
			}
		}
	});

	map.on("mouseout", () => {
		if (drawing) endDraw();
	});

	function endDraw() {
		drawing = false;
		rectStart = null;
		removePreview();
		map.dragging.enable();
	}

	// --- Edit popup ---

	function openEditPopup(map: any, plane: number, tileX: number, tileY: number) {
		const marker = markerStore.getAt(plane, tileX, tileY);
		if (!marker) return;

		const hex = marker.color.replace("#", "");
		const currentAlpha = hex.length === 8 ? parseInt(hex.substring(0, 2), 16) : 255;
		const currentRgb = "#" + (hex.length === 8 ? hex.substring(2) : hex);
		const currentLabel = marker.label || "";

		const popup = L.popup({
			closeButton: true,
			autoClose: true,
			className: "tilemarker-edit-popup",
			minWidth: 180,
		})
			.setLatLng([tileY + 0.5, tileX + 0.5])
			.setContent(
				`<div class="tilemarker-edit">
				<label class="te-label">Color</label>
				<div class="te-row">
					<input type="color" class="te-color" value="${currentRgb}">
					<input type="range" class="te-opacity" min="0" max="100" value="${Math.round((currentAlpha / 255) * 100)}">
					<span class="te-opacity-val">${Math.round((currentAlpha / 255) * 100)}%</span>
				</div>
				<label class="te-label">Label</label>
				<input type="text" class="te-text" value="${currentLabel.replace(/"/g, "&quot;")}" placeholder="optional" maxlength="255">
				<div class="te-row te-actions">
					<button class="te-btn te-save">Save</button>
					<button class="te-btn te-delete">Delete</button>
				</div>
			</div>`,
			)
			.openOn(map);

		const el = popup.getElement();
		if (!el) return;

		const opacityInput = el.querySelector(".te-opacity") as HTMLInputElement;
		const opacityVal = el.querySelector(".te-opacity-val")!;
		opacityInput.addEventListener("input", () => {
			opacityVal.textContent = opacityInput.value + "%";
		});

		el.querySelector(".te-save")!.addEventListener("click", () => {
			const newRgb = (el.querySelector(".te-color") as HTMLInputElement).value;
			const newOpacity = parseInt(opacityInput.value) / 100;
			const a = Math.round(newOpacity * 255);
			const newColor = "#" + a.toString(16).padStart(2, "0").toUpperCase() + newRgb.replace("#", "").toUpperCase();
			const newLabel = (el.querySelector(".te-text") as HTMLInputElement).value.trim() || undefined;

			marker.color = newColor;
			marker.label = newLabel;
			const css = argbToCss(newColor);
			const key = makeKey(plane, tileX, tileY);
			if (rectangles[key]) {
				rectangles[key].setStyle({ color: css, fillColor: css });
			}
			map.closePopup(popup);
		});

		el.querySelector(".te-delete")!.addEventListener("click", () => {
			markerStore.beginAction();
			markerStore.remove(plane, tileX, tileY);
			markerStore.commitAction();
			map.closePopup(popup);
		});
	}

	// Keyboard shortcuts
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			lineStart = null;
			removePreview();
		}
		const k = e.key.toLowerCase();
		if ((e.ctrlKey || e.metaKey) && k === "z" && !e.shiftKey) {
			e.preventDefault();
			markerStore.undo();
		} else if ((e.ctrlKey || e.metaKey) && (k === "y" || (k === "z" && e.shiftKey))) {
			e.preventDefault();
			markerStore.redo();
		}
		const idx = Number.parseInt(e.key) - 1;
		if (idx >= 0 && idx < 6) {
			const tools = ["hand", "point", "freehand", "line", "rect", "eraser"] as const;
			toolStore.setTool(tools[idx]);
		}
	});

	return map;
}
