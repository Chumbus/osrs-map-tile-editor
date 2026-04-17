type LayerEntry = {
	id: string;
	label: string;
	layer: any;
	map: any;
	active: boolean;
};

class LayerStore {
	layers: LayerEntry[] = $state([]);

	register(id: string, label: string, layer: any, map: any) {
		this.layers.push({ id, label, layer, map, active: false });
	}

	toggle(id: string) {
		const entry = this.layers.find((l) => l.id === id);
		if (!entry) return;
		if (entry.active) {
			entry.layer.remove();
			entry.active = false;
		} else {
			entry.layer.addTo(entry.map);
			entry.active = true;
		}
	}

	isActive(id: string) {
		return this.layers.find((l) => l.id === id)?.active ?? false;
	}
}

export const layerStore = new LayerStore();
