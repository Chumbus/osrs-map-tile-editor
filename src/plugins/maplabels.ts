import L from "leaflet";

const MaplabelGroup = L.LayerGroup.extend({
	initialize: function (options) {
		L.LayerGroup.prototype.initialize.call(this, {}, options);
	},

	onAdd: function (map) {
		const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.options.SHEET_ID}/values/A:Z?key=${this.options.API_KEY}`;
		fetch(url)
			.then((res) => res.json())
			.then((sheet) => {
				const markers = this.parse_sheet(sheet);
				const marker_iter = markers[Symbol.iterator]();
				for (const marker of marker_iter) {
					this.addLayer(marker);
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

	parse_sheet: function (sheet) {
		return sheet.values.map((row) => this.create_textlabel(...row));
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
