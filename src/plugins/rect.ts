import L from "leaflet";
import "@/plugins/displays";

const VertexIcon = L.DivIcon.extend({
	options: {
		iconSize: new L.Point(8, 8),
	},
});

const Vertex = L.Marker.extend({
	initialize: function (latlng, owner) {
		L.Util.setOptions(this, {
			draggable: true,
			icon: new VertexIcon(),
			owner: owner,
		});
		this._latlng = L.latLng(latlng);
		this.trunc();
	},

	onAdd: function (map) {
		this.on("drag", this.onDragEnd.bind(this));
		return L.Marker.prototype.onAdd.call(this, map);
	},

	onDragEnd: function () {
		this.trunc();
		this.options.owner.update(this);
	},

	trunc: function () {
		const latlng = this.getLatLng();
		const newLat = Math.trunc(latlng.lat);
		const newLng = Math.trunc(latlng.lng);
		const newLatLng = L.latLng(newLat, newLng);
		this.setLatLng(newLatLng);
		return this;
	},
});

L.DraggableSquare = L.Rectangle.extend({
	initialize: function (latLngBounds, options) {
		const bounds = L.latLngBounds(latLngBounds);
		// do not change order, important
		this.vertices = [
			bounds.getSouthWest(),
			bounds.getNorthWest(),
			bounds.getNorthEast(),
			bounds.getSouthEast(),
		].map(this.createVertex.bind(this));
		return L.Rectangle.prototype.initialize.call(this, bounds, options);
	},

	onAdd: function (map) {
		this.vertices.forEach((v) => v.trunc().addTo(map));

		L.Rectangle.prototype.onAdd.call(this, map);
		this.options.owner.update(this.getBounds());
	},

	createVertex: function (latlng) {
		return new Vertex(latlng, this);
	},

	update: function (changedVertex) {
		const i = (this.vertices.indexOf(changedVertex) + 2) & 0x3;
		const oppositeVertex = this.vertices[i];
		const otherVertices = this.vertices.filter((vertex) => vertex !== oppositeVertex && vertex !== changedVertex);

		const corner1 = oppositeVertex.getLatLng();
		const corner2 = changedVertex.getLatLng();
		const newBounds = L.latLngBounds([corner1, corner2]);
		this.setRectBounds(newBounds);

		const newLatLng1 = L.latLng(corner1.lat, corner2.lng);
		otherVertices[0].setLatLng(newLatLng1);

		const newLatLng2 = L.latLng(corner2.lat, corner1.lng);
		otherVertices[1].setLatLng(newLatLng2);

		this.options.owner.update(newBounds);
	},

	setRectBounds: function (bounds) {
		return L.Rectangle.prototype.setBounds.call(this, bounds);
	},

	setBounds: function (bounds) {
		const positions = [bounds.getSouthWest(), bounds.getNorthWest(), bounds.getNorthEast(), bounds.getSouthEast()];
		this.vertices.forEach((v, i) => v.setLatLng(positions[i]).trunc());
		bounds = L.latLngBounds(this.vertices.map((v) => v.getLatLng()));
		this.setRectBounds(bounds);
	},

	remove: function () {
		this.vertices.forEach((v) => v.remove());
		return L.Rectangle.prototype.remove.call(this);
	},
});

L.draggableSquare = (bounds, options) => new L.DraggableSquare(bounds, options);

L.Control.Display.Rect = L.Control.Display.extend({
	onAdd: function (map) {
		this.rect = L.draggableSquare(
			[
				[3232, 3200],
				[3200, 3232],
			],
			{
				owner: this,
			},
		);

		return L.Control.Display.prototype.onAdd.call(this, map);
	},

	options: {
		position: "bottomleft",
		title: "Dimensions:",
		icon: "images/Blue_square_(Prisoner_of_Glouphrie).png",
	},

	createInterface: function () {
		const container = L.DomUtil.create("div", "leaflet-control-display-expanded");
		const rectForm = L.DomUtil.create("form", "leaflet-control-display-form", container);

		const widthLabel = L.DomUtil.create("label", "leaflet-control-display-label", rectForm);
		widthLabel.innerHTML = "Width";
		this.width = L.DomUtil.create("input", "leaflet-control-display-input-number", rectForm);
		this.width.setAttribute("type", "number");
		this.width.setAttribute("name", "width");

		const heightLabel = L.DomUtil.create("label", "leaflet-control-display-label", rectForm);
		heightLabel.innerHTML = "Height";
		this.height = L.DomUtil.create("input", "leaflet-control-display-input-number", rectForm);
		this.height.setAttribute("type", "number");
		this.height.setAttribute("name", "height");

		const areaLabel = L.DomUtil.create("label", "leaflet-control-display-label", rectForm);
		areaLabel.innerHTML = "Area";
		this.area = L.DomUtil.create("input", "leaflet-control-display-input-number", rectForm);
		this.area.setAttribute("type", "number");
		this.area.setAttribute("name", "area");
		this.area.setAttribute("readonly", true);

		const westLabel = L.DomUtil.create("label", "leaflet-control-display-label", rectForm);
		westLabel.innerHTML = "West";
		this.west = L.DomUtil.create("input", "leaflet-control-display-input-number", rectForm);
		this.west.setAttribute("type", "number");
		this.west.setAttribute("name", "west");

		const eastLabel = L.DomUtil.create("label", "leaflet-control-display-label", rectForm);
		eastLabel.innerHTML = "East";
		this.east = L.DomUtil.create("input", "leaflet-control-display-input-number", rectForm);
		this.east.setAttribute("type", "number");
		this.east.setAttribute("name", "east");

		const northLabel = L.DomUtil.create("label", "leaflet-control-display-label", rectForm);
		northLabel.innerHTML = "North";
		this.north = L.DomUtil.create("input", "leaflet-control-display-input-number", rectForm);
		this.north.setAttribute("type", "number");
		this.north.setAttribute("name", "north");

		const southLabel = L.DomUtil.create("label", "leaflet-control-display-label", rectForm);
		southLabel.innerHTML = "South";
		this.south = L.DomUtil.create("input", "leaflet-control-display-input-number", rectForm);
		this.south.setAttribute("type", "number");
		this.south.setAttribute("name", "south");

		const centerLabel = L.DomUtil.create("label", "leaflet-control-display-label", rectForm);
		centerLabel.innerHTML = "Center";
		this.center = L.DomUtil.create("input", "leaflet-control-display-input-number", rectForm);
		this.center.setAttribute("type", "text");
		this.center.setAttribute("name", "center");
		this.center.setAttribute("readOnly", true);

		rectForm.addEventListener("change", this.changeRect.bind(this));

		return container;
	},

	changeRect: function (e) {
		let [width, height, _, west, east, north, south] = Array.from(e.srcElement.parentElement.children)
			.filter((elem) => elem.nodeName === "INPUT")
			.map((elem) => elem.value);
		if (["width", "height"].includes(e.srcElement.name)) {
			east = Number(west) + Number(width);
			north = Number(south) + Number(height);
		}
		const bounds = L.latLngBounds([
			[south, west],
			[north, east],
		]);
		this.rect.setBounds(bounds);
		this.update(bounds);
	},

	update: function (bounds) {
		// update control content
		const west = bounds.getWest();
		const east = bounds.getEast();
		const north = bounds.getNorth();
		const south = bounds.getSouth();
		const width = east - west;
		const height = north - south;
		const center_width = (west + east) / 2;
		const center_height = (north + south) / 2;

		this.width.value = width;
		this.height.value = height;
		this.area.value = height * width;
		this.west.value = west;
		this.east.value = east;
		this.north.value = north;
		this.south.value = south;
		this.center.value = `${center_width}, ${center_height}`;
	},

	expand: function () {
		const bounds = this._map.getBounds().pad(-0.3);
		this.rect.setBounds(bounds);
		this.rect.addTo(this._map);
		return L.Control.Display.prototype.expand.call(this);
	},

	collapse: function () {
		this.rect.remove();
		return L.Control.Display.prototype.collapse.call(this);
	},
});

L.control.display.rect = (options) => new L.Control.Display.Rect(options);

L.Map.addInitHook(function () {
	if (this.options.rect) {
		this.rect = L.control.display.rect();
		this.addControl(this.rect);
	}
});
