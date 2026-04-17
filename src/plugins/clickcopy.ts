import L from "leaflet";

L.Map.addInitHook(function () {
	this.on("dblclick", (e) => {
		if (e.originalEvent.shiftKey || e.originalEvent.ctrlKey) {
			const plane = this.getPlane();
			const x = Math.floor(e.latlng.lng);
			const y = Math.floor(e.latlng.lat);
			const copystr = e.originalEvent.ctrlKey ? `|x=${x}|y=${y}|plane=${plane}` : `|${x},${y}`;
			navigator.clipboard.writeText(copystr).then(
				() => this.addMessage(`Copied to clipboard: ${copystr}`),
				() => console.error("Cannot copy text to clipboard"),
			);
		}
	});
});
