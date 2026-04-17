import { toRegionCoords, toGlobalCoords, markerKey, packMarkers, unpackMarkers, compressToUrl, decompressFromUrl } from "@/helpers";

export type Marker = {
	regionId: number;
	regionX: number;
	regionY: number;
	z: number;
	color: string;
	label?: string;
};

type TileSnapshot = { plane: number; x: number; y: number; color: string; label?: string };

type UndoAction = {
	added: TileSnapshot[];   // tiles that were placed (undo = remove them)
	removed: TileSnapshot[]; // tiles that were removed (undo = re-add them)
};

class MarkerStore {
	markers: Marker[] = $state([]);
	index: Record<string, number> = $state({});
	undoStack: UndoAction[] = $state([]);
	redoStack: UndoAction[] = $state([]);
	pendingAction: UndoAction | null = $state(null);

	// Callback that Leaflet registers to render/unrender rectangles
	onPlace: ((plane: number, x: number, y: number, color: string) => void) | null = null;
	onRemove: ((plane: number, x: number, y: number) => void) | null = null;

	get count() {
		return this.markers.length;
	}

	has(plane: number, x: number, y: number): boolean {
		return this.index[markerKey(plane, x, y)] !== undefined;
	}

	getAt(plane: number, x: number, y: number): Marker | undefined {
		const idx = this.index[markerKey(plane, x, y)];
		return idx !== undefined ? this.markers[idx] : undefined;
	}

	// --- Action tracking ---

	beginAction() {
		this.pendingAction = { added: [], removed: [] };
	}

	commitAction() {
		if (this.pendingAction && (this.pendingAction.added.length > 0 || this.pendingAction.removed.length > 0)) {
			this.undoStack.push(this.pendingAction);
			this.redoStack = [];
		}
		this.pendingAction = null;
		this.scheduleSyncToUrl();
	}

	// --- Place / Remove (with undo tracking) ---

	place(plane: number, x: number, y: number, color: string) {
		const key = markerKey(plane, x, y);
		const existingIdx = this.index[key];

		if (existingIdx !== undefined) {
			const old = this.markers[existingIdx];
			if (old.color === color) return;

			// Overwrite: track the old tile as removed, remove it, then place new
			if (this.pendingAction) {
				this.pendingAction.removed.push({ plane, x, y, color: old.color, label: old.label });
			}
			this.onRemove?.(plane, x, y);
			this._rawRemove(key, existingIdx);
		}

		this._rawPlace(plane, x, y, color);
		this.onPlace?.(plane, x, y, color);

		if (this.pendingAction) {
			this.pendingAction.added.push({ plane, x, y, color });
		}
	}

	remove(plane: number, x: number, y: number) {
		const key = markerKey(plane, x, y);
		const idx = this.index[key];
		if (idx === undefined) return;

		const m = this.markers[idx];
		if (this.pendingAction) {
			this.pendingAction.removed.push({ plane, x, y, color: m.color, label: m.label });
		}

		this.onRemove?.(plane, x, y);
		this._rawRemove(key, idx);
	}

	// --- Raw operations (no undo, no Leaflet callback) ---

	_rawPlace(plane: number, x: number, y: number, color: string, label?: string) {
		const key = markerKey(plane, x, y);
		if (this.index[key] !== undefined) return;

		const region = toRegionCoords(plane, x, y);
		this.index[key] = this.markers.length;
		this.markers.push({
			regionId: region.regionId,
			regionX: region.regionX,
			regionY: region.regionY,
			z: region.z,
			color,
			label,
		});
	}

	_rawRemove(key: string, idx: number) {
		const last = this.markers.length - 1;
		if (idx !== last) {
			const moved = this.markers[last];
			this.markers[idx] = moved;
			const c = toGlobalCoords(moved.regionId, moved.regionX, moved.regionY);
			this.index[markerKey(moved.z, c.globalX, c.globalY)] = idx;
		}
		this.markers.pop();
		delete this.index[key];
	}

	// --- Undo / Redo ---

	undo() {
		if (this.undoStack.length === 0) return;
		const action = this.undoStack.pop()!;
		const reverse: UndoAction = { added: [], removed: [] };

		// Undo added tiles: remove them
		for (const t of action.added) {
			const key = markerKey(t.plane, t.x, t.y);
			const idx = this.index[key];
			if (idx === undefined) continue;
			const m = this.markers[idx];
			reverse.added.push({ plane: t.plane, x: t.x, y: t.y, color: m.color, label: m.label });
			this.onRemove?.(t.plane, t.x, t.y);
			this._rawRemove(key, idx);
		}

		// Undo removed tiles: re-add them
		for (const t of action.removed) {
			reverse.removed.push({ ...t });
			this._rawPlace(t.plane, t.x, t.y, t.color, t.label);
			this.onPlace?.(t.plane, t.x, t.y, t.color);
		}

		this.redoStack.push(reverse);
		this.scheduleSyncToUrl();
	}

	redo() {
		if (this.redoStack.length === 0) return;
		const action = this.redoStack.pop()!;
		const reverse: UndoAction = { added: [], removed: [] };

		// Redo: remove what was in "removed" (undo had re-added them)
		for (const t of action.removed) {
			const key = markerKey(t.plane, t.x, t.y);
			const idx = this.index[key];
			if (idx === undefined) continue;
			const m = this.markers[idx];
			reverse.removed.push({ plane: t.plane, x: t.x, y: t.y, color: m.color, label: m.label });
			this.onRemove?.(t.plane, t.x, t.y);
			this._rawRemove(key, idx);
		}

		// Redo: re-add what was in "added" (undo had removed them)
		for (const t of action.added) {
			reverse.added.push({ ...t });
			this._rawPlace(t.plane, t.x, t.y, t.color, t.label);
			this.onPlace?.(t.plane, t.x, t.y, t.color);
		}

		this.undoStack.push(reverse);
		this.scheduleSyncToUrl();
	}

	// --- Bulk ---

	clearAll() {
		for (const m of this.markers) {
			const c = toGlobalCoords(m.regionId, m.regionX, m.regionY);
			this.onRemove?.(m.z, c.globalX, c.globalY);
		}
		this.markers = [];
		this.index = {};
		this.undoStack = [];
		this.redoStack = [];
		this.syncToUrl();
	}

	// --- URL sync ---

	_syncTimer: any = null;

	scheduleSyncToUrl() {
		if (this._syncTimer) clearTimeout(this._syncTimer);
		this._syncTimer = setTimeout(() => this.syncToUrl(), 300);
	}

	syncToUrl() {
		const url = new URL(window.location.href);
		if (this.markers.length === 0) {
			url.searchParams.delete("markers");
			history.replaceState(null, "", url);
			return;
		}
		const packed = packMarkers(this.markers);
		compressToUrl(packed).then((encoded) => {
			url.searchParams.set("markers", encoded);
			history.replaceState(null, "", url);
		});
	}

	loadFromUrl() {
		const url = new URL(window.location.href);
		const encoded = url.searchParams.get("markers");
		if (!encoded) return;

		decompressFromUrl(encoded)
			.then((bytes) => {
				const data = unpackMarkers(bytes);
				for (const m of data) {
					const coords = toGlobalCoords(m.regionId, m.regionX, m.regionY);
					const key = markerKey(m.z, coords.globalX, coords.globalY);
					if (this.index[key] !== undefined) continue;
					this._rawPlace(m.z, coords.globalX, coords.globalY, m.color, m.label);
					this.onPlace?.(m.z, coords.globalX, coords.globalY, m.color);
				}
			})
			.catch((e) => {
				console.error("Failed to load markers from URL:", e);
			});
	}
}

export const markerStore = new MarkerStore();
