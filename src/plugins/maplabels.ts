import L from "leaflet";

const MaplabelGroup = L.LayerGroup.extend({
	options: {
		dataUrl: "/data/dungeon_labels.json",
	},

	initialize: function (options) {
		L.LayerGroup.prototype.initialize.call(this, {}, options);
	},

	onAdd: function (map) {
		fetch(this.options.dataUrl)
			.then((res) => res.json())
			.then((rows) => {
				for (const row of rows) {
					this.addLayer(this.create_textlabel(...row));
				}
			});
		L.LayerGroup.prototype.eachLayer.call(this, map.addLayer, map);

		map.on("zoomanim", (e) => {
			const scale = map.getZoomScale(e.zoom, 2);

			const labels = document.getElementsByClassName("map-label-container");
			for (const label of labels) {
				label.firstChild.setAttribute("style", `transform: scale(${scale})`);
				label.setAttribute("style", "transform: translate(-50%, -50%)");
			}
		});
	},

	onRemove: function (map) {
		L.LayerGroup.prototype.eachLayer.call(this, map.removeLayer, map);
	},

	create_textlabel: function (x, y, _plane, description) {
		const text = document.createTextNode(description);
		const sub = document.createElement("div");
		sub.appendChild(text);
		sub.setAttribute("class", "map-label-sub-container");
		const scale = this._map.getZoomScale(this._map.getZoom(), 2);
		sub.setAttribute("style", `transform: scale(${scale})`);

		const html = document.createElement("div");
		html.setAttribute("class", "map-label-container");
		html.setAttribute("style", "transform: translate(-50%, -50%)");
		html.appendChild(sub);

		const divicon = L.divIcon({
			html: html,
			iconSize: null, // I love gross hacks! necessary to not make the text 12x12px
			className: "map-label",
		});

		const marker = L.marker([Number(y), Number(x)], {
			icon: divicon,
		});

		return marker;
	},
});

L.maplabelGroup = (options) => new MaplabelGroup(options);
