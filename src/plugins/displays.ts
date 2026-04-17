import L from "leaflet";
import "@/plugins/objects";

L.Control.Display = L.Control.extend({
	onAdd: function (map) {
		this._map = map;
		this._container = L.DomUtil.create("div", "leaflet-control-layers leaflet-control-display");

		this.collapsed = this.createIcon(this.options.icon);
		L.DomEvent.on(
			this.collapsed,
			{
				click: this.expand,
			},
			this,
		);
		this._container.appendChild(this.collapsed);
		this._container.title = this.options.title;
		L.DomEvent.disableClickPropagation(this._container);

		const closeIcon = L.DomUtil.create("a", "leaflet-control-display-icon-close");
		L.DomEvent.on(
			closeIcon,
			{
				click: this.collapse,
			},
			this,
		);
		L.DomEvent.disableClickPropagation(closeIcon);

		const expandedContent = this.createInterface();
		const expandedContentContainer = L.DomUtil.create("div", "leaflet-control-display-container-expanded");
		expandedContentContainer.appendChild(expandedContent);

		this.expanded = L.DomUtil.create("div", "leaflet-control-display");
		this.expanded.appendChild(closeIcon);
		this.expanded.appendChild(expandedContentContainer);

		return this._container;
	},

	// @method expand(): this
	// Expand the control container if collapsed.
	expand: function () {
		this._container.innerHTML = "";
		this._container.append(this.expanded);
		return this;
	},

	// @method collapse(): this
	// Collapse the control container.
	collapse: function () {
		this._container.innerHTML = "";
		this._container.append(this.collapsed);
		return this;
	},

	expanded: undefined,

	// @method createInterface
	// Reimplement .createInterface to set content for the expanded interface;
	// return a HTML Element
	createInterface: () => L.DomUtil.create("div"),

	collapsed: undefined,

	createIcon: (icon) => {
		const container = L.DomUtil.create("div", "leaflet-control-display-collapsed");
		const img = L.DomUtil.create("img", "leaflet-control-display-icon");
		img.src = icon;
		container.append(img);
		return container;
	},

	onRemove: (_map) => {
		// Nothing to do here
	},

	setSearchParams: (parameters) => {
		const url = new URL(window.location.href);
		const params = url.searchParams;

		for (const [key, value] of Object.entries(parameters)) {
			if (value || value === 0) {
				params.set(key, value);
			} else {
				params.delete(key);
			}
		}
		url.search = params;
		history.replaceState(0, "Location", url);
	},
});

L.control.display = (options) => new L.Control.Display(options);

L.Control.Display.Objects = L.Control.Display.extend({
	options: {
		expand: true,
		position: "bottomleft",
		title: "Display objects",
		icon: "images/objects.png",
	},

	onAdd: function (map) {
		return L.Control.Display.prototype.onAdd.call(this, map);
	},
	createInterface: function () {
		const parsedUrl = new URL(window.location.href);
		const objectName = parsedUrl.searchParams.get("object") || "";
		const objectId = parsedUrl.searchParams.get("objectid");

		const container = L.DomUtil.create("div", "leaflet-control-display-expanded");

		const objectForm = L.DomUtil.create("form", "leaflet-control-display-form", container);

		const nameDescription = L.DomUtil.create("label", "leaflet-control-display-label", objectForm);
		nameDescription.innerHTML = "Name";
		const nameInput = L.DomUtil.create("input", "leaflet-control-display-input", objectForm);
		nameInput.setAttribute("name", "name");
		nameInput.setAttribute("value", objectName);
		nameInput.setAttribute("autocomplete", "off");

		const idDescription = L.DomUtil.create("label", "leaflet-control-display-label", objectForm);
		idDescription.innerHTML = "Id";
		const idInput = L.DomUtil.create("input", "leaflet-control-display-input", objectForm);
		idInput.setAttribute("name", "id");
		idInput.setAttribute("type", "number");
		idInput.setAttribute("value", objectId);
		idInput.setAttribute("autocomplete", "off");

		const submitButton = L.DomUtil.create("input", "leaflet-control-display-submit", objectForm);
		submitButton.setAttribute("type", "submit");
		submitButton.setAttribute("value", "Look up");

		objectForm.addEventListener("submit", (e) => {
			// on form submission, prevent default
			e.preventDefault();

			const formData = new FormData(objectForm);
			this.submitData(formData);
		});

		//Instantiate lookup if urlparam data is present
		if (objectName || objectId) {
			const formData = new FormData(objectForm);
			this.submitData(formData);
		}

		return container;
	},

	submitData: function (formData) {
		const name = formData.get("name").trim();
		const id = formData.get("id").trim() ? Number.parseInt(formData.get("id").trim(), 10) : undefined;
		const names = name && id === undefined ? [name] : [];
		const ids = Number.isInteger(id) ? [id] : [];

		this.invokeObjectmap(names, ids);
	},

	_objectmap: undefined,

	invokeObjectmap: function (names, ids) {
		if (this._objectmap) {
			this._objectmap.remove();
		}

		this.setSearchParams({
			object: names[0],
			objectid: ids[0],
		});

		if (names[0] || ids[0] || ids[0] === 0) {
			this._objectmap = this.options
				.displayLayer({
					names: names,
					ids: ids,
					folder: this.options.folder,
				})
				.addTo(this._map);
		}
	},
});

L.control.display.objects = (options) => new L.Control.Display.Objects(options);

L.Control.Display.NPCs = L.Control.Display.extend({
	options: {
		expand: true,
		position: "bottomleft",
		title: "Display NPCs",
		icon: "images/npcs.png",
	},
	onAdd: function (map) {
		return L.Control.Display.prototype.onAdd.call(this, map);
	},

	createInterface: function () {
		const parsedUrl = new URL(window.location.href);
		const npcName = parsedUrl.searchParams.get("npc") || "";
		const npcId = parsedUrl.searchParams.get("npcid");
		const range = Number(parsedUrl.searchParams.get("range")) || 0;
		if (Number.isNaN(range) || range < 0) {
			throw new Error(`${parsedUrl.searchParams.get("range")} is invalid`);
		}

		const container = L.DomUtil.create("div", "leaflet-control-display-expanded");

		const npcForm = L.DomUtil.create("form", "leaflet-control-display-form", container);

		const nameDescription = L.DomUtil.create("label", "leaflet-control-display-label", npcForm);
		nameDescription.innerHTML = "Name";
		const nameInput = L.DomUtil.create("input", "leaflet-control-display-input", npcForm);
		nameInput.setAttribute("name", "name");
		nameInput.setAttribute("value", npcName);
		nameInput.setAttribute("autocomplete", "off");

		const idDescription = L.DomUtil.create("label", "leaflet-control-display-label", npcForm);
		idDescription.innerHTML = "Id";
		const idInput = L.DomUtil.create("input", "leaflet-control-display-input", npcForm);
		idInput.setAttribute("name", "id");
		idInput.setAttribute("type", "number");
		idInput.setAttribute("value", npcId);
		idInput.setAttribute("autocomplete", "off");

		const rangeDescription = L.DomUtil.create("label", "leaflet-control-display-label", npcForm);
		rangeDescription.innerHTML = "Wander range";
		const rangeInput = L.DomUtil.create("input", "leaflet-control-display-input", npcForm);
		rangeInput.setAttribute("name", "range");
		rangeInput.setAttribute("type", "number");
		rangeInput.setAttribute("value", range ?? "7");

		const submitButton = L.DomUtil.create("input", "leaflet-control-display-submit", npcForm);
		submitButton.setAttribute("type", "submit");
		submitButton.setAttribute("value", "Look up");

		npcForm.addEventListener("submit", (e) => {
			// on form submission, prevent default
			e.preventDefault();

			const formData = new FormData(npcForm);
			this.submitData(formData);
		});

		//Instantiate lookup if urlparam data is present
		if (npcName || npcId) {
			const formData = new FormData(npcForm);
			this.submitData(formData);
		}

		return container;
	},

	submitData: function (formData) {
		const name = formData.get("name").trim();

		const id = formData.get("id").trim() ? Number.parseInt(formData.get("id").trim(), 10) : undefined;
		const range = Number.parseInt(formData.get("range").trim(), 10) || 0;
		const showHeat = range || false;
		const names = name && id === undefined ? [name] : [];
		const ids = Number.isInteger(id) ? [id] : [];

		this.invokeHeatmap(names, ids, showHeat, range);
	},

	_heatmap: undefined,

	invokeHeatmap: function (names, ids, showHeat, range) {
		if (this._heatmap) {
			this._heatmap.remove();
		}
		this.setSearchParams({
			npc: names[0],
			npcid: ids[0],
			range: range || undefined,
		});

		if (names[0] || ids[0] || ids[0] === 0) {
			this._heatmap = L.heatmap({
				npcs: names,
				ids: ids,
				showHeat: showHeat,
				range: range,
				folder: this.options.folder,
			}).addTo(this._map);
		}
	},
});

L.control.display.npcs = (options) => new L.Control.Display.NPCs(options);

L.Control.Display.Items = L.Control.Display.extend({
	options: {
		position: "bottomleft",
		title: "Display objects",
		icon: "images/items.png",
	},

	onAdd: function (map) {
		return L.Control.Display.prototype.onAdd.call(this, map);
	},
});

L.control.display.items = (options) => new L.Control.Display.Items(options);

L.Control.Display.OSRSVarbits = L.Control.Display.extend({
	options: {
		position: "bottomleft",
		title: "Display varbits",
		icon: "images/Flag.png",
	},

	onAdd: function (map) {
		return L.Control.Display.prototype.onAdd.call(this, map);
	},
	createInterface: function () {
		const parsedUrl = new URL(window.location.href);
		const varp = parsedUrl.searchParams.get("varp");
		const varbit = parsedUrl.searchParams.get("varbit");
		const varvalue = parsedUrl.searchParams.get("varvalue");

		const container = L.DomUtil.create("div", "leaflet-control-display-expanded");

		const varForm = L.DomUtil.create("form", "leaflet-control-display-form", container);

		const varpDescription = L.DomUtil.create("label", "leaflet-control-display-label", varForm);
		varpDescription.innerHTML = "varp";
		const varpInput = L.DomUtil.create("input", "leaflet-control-display-input", varForm);
		varpInput.setAttribute("name", "varp");
		varpInput.setAttribute("type", "number");
		varpInput.setAttribute("value", varp);
		varpInput.setAttribute("autocomplete", "off");

		const varbitDescription = L.DomUtil.create("label", "leaflet-control-display-label", varForm);
		varbitDescription.innerHTML = "varbit";
		const varbitInput = L.DomUtil.create("input", "leaflet-control-display-input", varForm);
		varbitInput.setAttribute("name", "varbit");
		varbitInput.setAttribute("type", "number");
		varbitInput.setAttribute("value", varbit);
		varbitInput.setAttribute("autocomplete", "off");

		const varvalueDescription = L.DomUtil.create("label", "leaflet-control-display-label", varForm);
		varvalueDescription.innerHTML = "value";
		const varvalueInput = L.DomUtil.create("input", "leaflet-control-display-input", varForm);
		varvalueInput.setAttribute("name", "varvalue");
		varvalueInput.setAttribute("type", "number");
		varvalueInput.setAttribute("value", varvalue);
		varvalueInput.setAttribute("autocomplete", "off");

		const submitButton = L.DomUtil.create("input", "leaflet-control-display-submit", varForm);
		submitButton.setAttribute("type", "submit");
		submitButton.setAttribute("value", "Look up");

		varForm.addEventListener("submit", (e) => {
			// on form submission, prevent default
			e.preventDefault();

			const formData = new FormData(varForm);
			this.submitData(formData);
		});

		//Instantiate lookup if urlparam data is present
		if (varp || varbit) {
			const formData = new FormData(varForm);
			this.submitData(formData);
		}

		return container;
	},

	submitData: function (formData) {
		const varp = formData.get("varp");
		const varbit = formData.get("varbit");
		const varvalue = formData.get("varvalue");
		this.invokeVarbitmap(varp, varbit, varvalue);
	},

	_varbitmap: undefined,

	invokeVarbitmap: function (varp, varbit, varvalue) {
		if (this._varbitmap) {
			this._varbitmap.remove();
		}

		this.setSearchParams({
			varp: varp,
			varbit: varbit,
			varvalue: varvalue,
		});

		if (varp !== undefined && varbit !== undefined) {
			this._varbitmap = L.varbit({
				varp: varp,
				varbit: varbit,
				varvalue: varvalue,
			}).addTo(this._map);
		}
	},
});

L.control.display.OSRSvarbits = (options) => new L.Control.Display.OSRSVarbits(options);
