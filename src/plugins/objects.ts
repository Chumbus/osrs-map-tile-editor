import L from "leaflet";

L.Objects = L.DynamicIcons.extend({
	onAdd: function (map) {
		this._map = map;
		if (this.options.names || this.options.ids) {
			this.getData(this.options.names, this.options.ids)
				.then((locations) => {
					this._icon_data = this.parseData(locations);
					this._icons = {};
					this._resetView();
					this._update();
				})
				.catch(console.error);
		} else {
			throw new Error("No objects specified");
		}
	},

	getData: async function (names, ids) {
		if (names && names.length !== 0) {
			const name_mapping_promise = fetch(`${this.options.folder}/object_name_collection.json`).then(
				(res) => res.json(),
				(_) => {
					throw new Error(`Unable to fetch ${this.options.folder}/object_name_collection.json`);
				},
			);
			const morph_mapping_promise = fetch(`${this.options.folder}/object_morph_collection.json`).then(
				(res) => res.json(),
				(_) => {
					throw new Error(`Unable to fetch ${this.options.folder}/object_morph_collection.json`);
				},
			);
			const [name_mapping, morph_mapping] = await Promise.all([name_mapping_promise, morph_mapping_promise]);

			const ids = names.flatMap((name) => name_mapping[name] ?? []);

			const all_ids = Array.from(new Set(ids.flatMap((id) => [...(morph_mapping[id] ?? []), id])));

			const all_locations = await Promise.allSettled(
				all_ids.map((id) => fetch(`${this.options.folder}/locations/${id}.json`)),
			).then((responses) =>
				Promise.all(
					responses
						.filter((res) => res.status === "fulfilled" && res.value.ok)
						.map((res) => res.value.json()),
				),
			);

			return all_locations.flat();
		} else if (ids && ids.length !== 0) {
			const morph_mapping = await fetch(`${this.options.folder}/object_morph_collection.json`).then((res) =>
				res.json(),
			);
			const all_ids = Array.from(new Set(ids.flatMap((id) => [...(morph_mapping[id] ?? []), id])));
			const all_locations = await Promise.allSettled(
				all_ids.map((id) => fetch(`${this.options.folder}/locations/${id}.json`)),
			).then((responses) =>
				Promise.all(
					responses
						.filter((res) => res.status === "fulfilled" && res.value.ok)
						.map((res) => res.value.json()),
				),
			);

			return all_locations.flat();
		} else {
			throw new Error("");
		}
	},

	parseData: function (data) {
		const icon_data = {};

		data.forEach((item) => {
			const key = this._tileCoordsToKey({
				plane: item.plane,
				x: item.i,
				y: -item.j,
			});

			if (!(key in icon_data)) {
				icon_data[key] = [];
			}
			icon_data[key].push(item);
		});

		const reallyLoadEverything = data.length < 10000 ? true : confirm(`Really load ${data.length} markers?`);
		if (reallyLoadEverything) {
			this._map.addMessage(`Found ${data.length} locations of this object.`);
			return icon_data;
		} else {
			return [];
		}
	},

	createIcon: function (item) {
		const icon = L.icon({
			iconUrl: "images/marker-icon.png",
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			tooltipAnchor: [16, -28],
			shadowSize: [41, 41],
		});
		const greyscaleIcon = L.icon({
			iconUrl: "images/marker-icon-greyscale.png",
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			tooltipAnchor: [16, -28],
			shadowSize: [41, 41],
		});

		const marker = L.marker([(item.j << 6) + item.y + 0.5, (item.i << 6) + item.x + 0.5], {
			icon: item.plane === this._map.getPlane() ? icon : greyscaleIcon,
		});

		this._map.on("planechange", (e) => {
			marker.setIcon(item.plane === e.newPlane ? icon : greyscaleIcon);
		});
		const textContainer = document.createElement("div");
		const imgContainer = document.createElement("div");
		imgContainer.setAttribute("class", "object-image-container");
		const container = document.createElement("div");
		container.appendChild(imgContainer);
		container.appendChild(textContainer);

		marker.bindPopup(container, {
			autoPan: false,
		});

		const as_text = (i) => (typeof i !== "string" ? JSON.stringify(i) : i);

		marker.once("popupopen", async () => {
			const data = await fetch(`${this.options.folder}/location_configs/${item.id}.json`).then((res) =>
				res.json(),
			);
			let textfield = "";
			if (data.name !== undefined) {
				// put name first
				textfield += `name = ${data.name}<br>`;
			}
			textfield += `plane = ${item.plane}<br>`;
			textfield += `x = ${(item.i << 6) + item.x}<br>`;
			textfield += `y = ${(item.j << 6) + item.y}<br>`;
			textfield += `id = ${item.id}<br>`;
			textfield += `type = ${item.type}<br>`;
			textfield += `rotation = ${item.rotation}<br>`;

			for (const [key, value] of Object.entries(data)) {
				if (key !== "name") {
					textfield += `${key} = ${as_text(value)}<br>`;
				}
			}

			textContainer.innerHTML = textfield;
		});

		return marker;
	},
});

L.objects = (options) => new L.Objects(options);

L.Objects.OSRS = L.Objects.extend({
	createChiselIcon: function (item) {
		const icon = L.icon({
			iconUrl: "images/marker-icon.png",
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			tooltipAnchor: [16, -28],
			shadowSize: [41, 41],
		});
		const greyscaleIcon = L.icon({
			iconUrl: "images/marker-icon-greyscale.png",
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			tooltipAnchor: [16, -28],
			shadowSize: [41, 41],
		});

		const marker = L.marker([item.location.y + 0.5, item.location.x + 0.5], {
			icon: item.location.plane === this._map.getPlane() ? icon : greyscaleIcon,
		});
		marker.options.icon.options.className = "huechange";

		this._map.on("planechange", (e) => {
			marker.setIcon(item.location.plane === e.newPlane ? icon : greyscaleIcon);
		});
		const crowdsourcedescription = document.createElement("div");
		crowdsourcedescription.innerHTML =
			"This object's location was gathered with the Runescape Wiki crowdsource project. See <a href='https://oldschool.runescape.wiki/w/RuneScape:Crowdsourcing#Object_locations'>here</a> for more information.";
		const textContainer = document.createElement("div");
		const imgContainer = document.createElement("div");
		imgContainer.setAttribute("class", "object-image-container");
		const container = document.createElement("div");
		container.appendChild(crowdsourcedescription);
		container.appendChild(imgContainer);
		container.appendChild(textContainer);

		marker.bindPopup(container, {
			autoPan: false,
		});

		const as_text = (i) => (typeof i !== "string" ? JSON.stringify(i) : i);

		marker.once("popupopen", async () => {
			const location_config = await fetch(`${this.options.folder}/location_configs/${item.id}.json`).then((res) =>
				res.json(),
			);

			let textfield = "";
			if (location_config.name !== undefined) {
				// put name first
				textfield += `name = ${location_config.name}<br>`;
			}
			textfield += `plane = ${item.location.plane}<br>`;
			textfield += `x = ${item.location.x}<br>`;
			textfield += `y = ${item.location.y}<br>`;
			textfield += `label = ${item.label}<br>`;

			for (const [key, value] of Object.entries(location_config)) {
				if (key !== "name") {
					textfield += `${key} = ${as_text(value)}<br>`;
				}
			}

			textContainer.innerHTML = textfield;
			this.createModelTab(item, location_config).then((img) => imgContainer.appendChild(img));
		});

		return marker;
	},

	createIcon: function (item) {
		if ("location" in item) {
			return this.createChiselIcon(item);
		}
		const icon = L.icon({
			iconUrl: "images/marker-icon.png",
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			tooltipAnchor: [16, -28],
			shadowSize: [41, 41],
		});
		const greyscaleIcon = L.icon({
			iconUrl: "images/marker-icon-greyscale.png",
			iconSize: [25, 41],
			iconAnchor: [12, 41],
			popupAnchor: [1, -34],
			tooltipAnchor: [16, -28],
			shadowSize: [41, 41],
		});

		const marker = L.marker([(item.j << 6) + item.y + 0.5, (item.i << 6) + item.x + 0.5], {
			icon: item.plane === this._map.getPlane() ? icon : greyscaleIcon,
		});

		this._map.on("planechange", (e) => {
			marker.setIcon(item.plane === e.newPlane ? icon : greyscaleIcon);
		});
		const textContainer = document.createElement("div");
		const imgContainer = document.createElement("div");
		imgContainer.setAttribute("class", "object-image-container");
		const container = document.createElement("div");
		container.appendChild(imgContainer);
		container.appendChild(textContainer);

		marker.bindPopup(container, {
			autoPan: false,
		});

		const as_text = (i) => (typeof i !== "string" ? JSON.stringify(i) : i);

		marker.once("popupopen", async () => {
			const location_config = await fetch(`${this.options.folder}/location_configs/${item.id}.json`).then((res) =>
				res.json(),
			);

			let textfield = "";
			if (location_config.name !== undefined) {
				// put name first
				textfield += `name = ${location_config.name}<br>`;
			}
			textfield += `plane = ${item.plane}<br>`;
			textfield += `x = ${(item.i << 6) + item.x}<br>`;
			textfield += `y = ${(item.j << 6) + item.y}<br>`;
			textfield += `id = ${item.id}<br>`;
			textfield += `type = ${item.type}<br>`;
			textfield += `rotation = ${item.rotation}<br>`;

			for (const [key, value] of Object.entries(location_config)) {
				if (key !== "name") {
					textfield += `${key} = ${as_text(value)}<br>`;
				}
			}

			textContainer.innerHTML = textfield;
			this.createModelTab(item, location_config).then((img) => imgContainer.appendChild(img));
		});

		return marker;
	},

	getData: async function (names, ids) {
		if (names && names.length !== 0) {
			const name_mapping_promise = fetch(`${this.options.folder}/object_name_collection.json`).then((res) =>
				res.json(),
			);
			const morph_mapping_promise = fetch(`${this.options.folder}/object_morph_collection.json`).then((res) =>
				res.json(),
			);
			const [name_mapping, morph_mapping] = await Promise.all([name_mapping_promise, morph_mapping_promise]);

			const ids = names.flatMap((name) => name_mapping[name] ?? []);

			const all_ids = Array.from(new Set(ids.flatMap((id) => [...(morph_mapping[id] ?? []), id])));

			const all_locations = await Promise.allSettled([
				...all_ids.map((id) => fetch(`${this.options.folder}/locations/${id}.json`)),
				...all_ids.map((id) => fetch(`https://chisel.weirdgloop.org/scenery/server_mapdata?id=${id}`)),
			]).then((responses) =>
				Promise.all(
					responses
						.filter((res) => res.status === "fulfilled" && res.value.ok)
						.map((res) => res.value.json()),
				),
			);

			return all_locations.flat();
		} else if (ids && ids.length !== 0) {
			const morph_mapping = await fetch(`${this.options.folder}/object_morph_collection.json`).then((res) =>
				res.json(),
			);
			const all_ids = Array.from(new Set(ids.flatMap((id) => [...(morph_mapping[id] ?? []), id])));

			const all_locations = await Promise.allSettled([
				...all_ids.map((id) => fetch(`${this.options.folder}/locations/${id}.json`)),
				...all_ids.map((id) => fetch(`https://chisel.weirdgloop.org/scenery/server_mapdata?id=${id}`)),
			]).then((responses) =>
				Promise.all(
					responses
						.filter((res) => res.status === "fulfilled" && res.value.ok)
						.map((res) => res.value.json()),
				),
			);

			return all_locations.flat();
		} else {
			throw new Error("");
		}
	},

	parseData: function (data) {
		const icon_data = {};

		data.forEach((item) => {
			const key = this._tileCoordsToKey({
				plane: item.plane ?? item.location.plane,
				x: item.i ?? item.location.x >> 6,
				y: -(item.j ?? item.location.y >> 6),
			});

			if (!(key in icon_data)) {
				icon_data[key] = [];
			}
			icon_data[key].push(item);
		});

		const reallyLoadEverything = data.length < 10000 ? true : confirm(`Really load ${data.length} markers?`);
		if (reallyLoadEverything) {
			this._map.addMessage(`Found ${data.length} locations of this object.`);
			return icon_data;
		} else {
			return [];
		}
	},

	createModelTab: async (loc, location_config) => {
		function getImage(id) {
			return new Promise((resolve, reject) => {
				// eslint-disable-line no-unused-vars
				if (id === -1) {
					reject();
				}
				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = () => {
					console.warn(
						`Unable to load https://chisel.weirdgloop.org/static/img/osrs-object/${id}_orient${rotation}.png`,
					);
					reject();
				};
				const rotation = loc.rotation ?? 0;
				img.src = `https://chisel.weirdgloop.org/static/img/osrs-object/${id}_orient${rotation}.png`;
			});
		}
		const ids = Array.from(
			new Set([location_config.id, ...(location_config.morphs ?? []), ...(location_config.morphs_2 ?? [])]),
		);
		ids.sort();

		const imgs = await Promise.allSettled(ids.map(getImage));

		if (imgs.length === 1 && imgs[0].status === "fulfilled") {
			const img = imgs[0].value;
			img.setAttribute("class", "object-image");
			return img;
		} else if (imgs.some((img) => img.status === "fulfilled")) {
			const tabs = document.createElement("div");
			tabs.setAttribute("class", "tabs");

			const content = document.createElement("div");
			content.setAttribute("class", "content");

			imgs.forEach((img_promise, i) => {
				if (
					img_promise.status === "fulfilled" &&
					(img_promise.value.width > 1 || img_promise.value.height > 1)
				) {
					if (!content.innerHTML) {
						const img = img_promise.value;
						img.setAttribute("class", "object-image");
						content.appendChild(img);
					}

					const button = document.createElement("div");
					button.innerHTML = ids[i];
					button.addEventListener("click", () => {
						content.innerHTML = "";
						const img = img_promise.value;
						img.setAttribute("class", "object-image");
						content.appendChild(img);
					});
					button.setAttribute("class", "tabbutton");
					tabs.appendChild(button);
				}
			});
			const combined = document.createElement("div");
			combined.appendChild(tabs);
			combined.appendChild(content);
			return combined;
		} else {
			return document.createElement("div");
		}
	},
});

L.objects.osrs = (options) => new L.Objects.OSRS(options);
