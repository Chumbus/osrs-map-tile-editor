import L from "leaflet";

// textScale: 0 = landmark/POI, 1 = city/town, 2 = region
const SCALE_STYLES = {
	2: { fontSize: 22, fontWeight: "bold", minZoom: -4, color: "#fff" },
	1: { fontSize: 16, fontWeight: "bold", minZoom: -2, color: "#fff" },
	0: { fontSize: 12, fontWeight: "normal", minZoom: 0, color: "#ddd" },
};

const OverworldLabelLayer = L.LayerGroup.extend({
	options: {
		dataUrl: "data/overworld_labels.json",
	},

	initialize: function (options) {
		L.LayerGroup.prototype.initialize.call(this, [], options);
		L.setOptions(this, options);
		this._labelMarkers = []; // {marker, minZoom}
		this._loaded = false;
	},

	onAdd: function (map) {
		this._map = map;
		L.LayerGroup.prototype.onAdd.call(this, map);

		if (!this._loaded) {
			this._loadData();
		} else {
			this._updateVisibility();
		}

		map.on("zoomend", this._updateVisibility, this);
	},

	onRemove: function (map) {
		map.off("zoomend", this._updateVisibility, this);
		L.LayerGroup.prototype.onRemove.call(this, map);
	},

	_loadData: function () {
		fetch(this.options.dataUrl)
			.then((r) => r.json())
			.then((data) => {
				this._loaded = true;
				this._buildLabels(data);
				this._updateVisibility();
			})
			.catch((e) => console.error("Failed to load overworld labels:", e));
	},

	_buildLabels: function (data) {
		for (const entry of data) {
			const style = SCALE_STYLES[entry.textScale] || SCALE_STYLES[0];
			const text = entry.displayName || entry.name.replace(/\n/g, " ");

			const html = document.createElement("div");
			html.className = "overworld-label-container";

			const inner = document.createElement("div");
			inner.className = "overworld-label";
			inner.textContent = text;
			inner.style.fontSize = `${style.fontSize}px`;
			inner.style.fontWeight = style.fontWeight;
			inner.style.color = style.color;
			html.appendChild(inner);

			const icon = L.divIcon({
				html: html,
				iconSize: null,
				className: "overworld-label-icon",
			});

			const marker = L.marker([entry.y, entry.x], {
				icon: icon,
				interactive: false,
				keyboard: false,
			});

			this._labelMarkers.push({
				marker: marker,
				minZoom: style.minZoom,
			});
		}
	},

	_updateVisibility: function () {
		if (!this._map) return;
		const zoom = this._map.getZoom();
		// Scale labels relative to zoom level 2 (where they look "normal")
		const scale = this._map.getZoomScale(zoom, 2);

		for (const entry of this._labelMarkers) {
			if (zoom >= entry.minZoom) {
				if (!this.hasLayer(entry.marker)) {
					this.addLayer(entry.marker);
				}
				const el = entry.marker.getElement();
				if (el) {
					const inner = el.querySelector(".overworld-label");
					if (inner) inner.style.transform = `scale(${scale})`;
				}
			} else {
				if (this.hasLayer(entry.marker)) {
					this.removeLayer(entry.marker);
				}
			}
		}
	},
});

L.overworldLabelLayer = (options) => new OverworldLabelLayer(options);
