import L from "leaflet";

L.Control.Layers.UrlParam = L.Control.Layers.extend({
	onAdd: function (map) {
		this.initParamLayers(map);
		return L.Control.Layers.prototype.onAdd.call(this, map);
	},

	initParamLayers: function (map) {
		const url = new URL(window.location.href);
		const params = url.searchParams;
		const initLayers = params.getAll("layer");

		for (const overlay of this._layers.filter((layer) => layer.overlay)) {
			if (initLayers.includes(overlay.name)) {
				overlay.layer.addTo(map);
			}
		}
	},

	addSearchParam: (layerName) => {
		const url = new URL(window.location.href);
		const params = url.searchParams;
		params.append("layer", layerName);
		url.search = params;
		history.replaceState(0, "Location", url);
	},

	removeSearchParam: (layerName) => {
		const url = new URL(window.location.href);
		const params = url.searchParams;
		const otherLayers = params.getAll("layer").filter((layer) => layer !== layerName);

		params.delete("layer");
		for (const layer of otherLayers) {
			params.append("layer", layer);
		}
		url.search = params;
		history.replaceState(0, "Location", url);
	},

	_onLayerChange: function (e) {
		const layerName = this._getLayer(L.Util.stamp(e.target)).name;
		if (e.type === "add") {
			this.addSearchParam(layerName);
		} else if (e.type === "remove") {
			this.removeSearchParam(layerName);
		}
		return L.Control.Layers.prototype._onLayerChange.call(this, e);
	},
});

L.control.layers.urlParam = (baseLayers, overlays, options) =>
	new L.Control.Layers.UrlParam(baseLayers, overlays, options);
