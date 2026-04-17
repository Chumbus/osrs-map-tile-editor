class MapStore {
	instance: any = $state(null);
	zoom: number = $state(2);
	plane: number = $state(0);
	showCoords: boolean = $state(true);

	get ready() {
		return this.instance !== null;
	}

	setInstance(map: any) {
		this.instance = map;
		this.zoom = map.getZoom();
		this.plane = map.getPlane();

		map.on("zoomend", () => {
			this.zoom = map.getZoom();
		});
		map.on("planechange", (e: any) => {
			this.plane = e.newPlane;
		});
	}

	zoomIn() {
		this.instance?.zoomIn();
	}

	zoomOut() {
		this.instance?.zoomOut();
	}

	planeUp() {
		if (this.plane < 3) this.instance?.setPlane(this.plane + 1);
	}

	planeDown() {
		if (this.plane > 0) this.instance?.setPlane(this.plane - 1);
	}

	toggleFullscreen() {
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			document.getElementById("app")?.requestFullscreen();
		}
	}
}

export const mapStore = new MapStore();
