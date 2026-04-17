export const TOOLS = [
	{ id: "hand", label: "Hand", cursor: "grab", key: "1" },
	{ id: "point", label: "Point", cursor: "crosshair", key: "2" },
	{ id: "freehand", label: "Draw", cursor: "crosshair", key: "3" },
	{ id: "line", label: "Line", cursor: "crosshair", key: "4" },
	{ id: "rect", label: "Rect", cursor: "crosshair", key: "5" },
	{ id: "eraser", label: "Eraser", cursor: "not-allowed", key: "6" },
] as const;

export type ToolId = (typeof TOOLS)[number]["id"];

class ToolStore {
	activeTool: ToolId = $state("hand");
	color: string = $state("#FFFF00");
	opacity: number = $state(100);

	get cssColor() {
		return this.color;
	}

	// Accent color for the UI — the selected color, lightened if too dark
	get accent() {
		const hex = this.color.replace("#", "");
		let r = parseInt(hex.substring(0, 2), 16);
		let g = parseInt(hex.substring(2, 4), 16);
		let b = parseInt(hex.substring(4, 6), 16);

		// Convert to HSL
		r /= 255; g /= 255; b /= 255;
		const max = Math.max(r, g, b), min = Math.min(r, g, b);
		let h = 0, s = 0, l = (max + min) / 2;

		if (max !== min) {
			const d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
			else if (max === g) h = ((b - r) / d + 2) / 6;
			else h = ((r - g) / d + 4) / 6;
		}

		// Ensure minimum lightness of 55% and saturation of 40%
		l = Math.max(l, 0.55);
		s = Math.max(s, 0.4);

		// Convert back to RGB
		function hue2rgb(p: number, q: number, t: number) {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1/6) return p + (q - p) * 6 * t;
			if (t < 1/2) return q;
			if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
			return p;
		}
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		const ro = Math.round(hue2rgb(p, q, h + 1/3) * 255);
		const go = Math.round(hue2rgb(p, q, h) * 255);
		const bo = Math.round(hue2rgb(p, q, h - 1/3) * 255);

		return `#${ro.toString(16).padStart(2, "0")}${go.toString(16).padStart(2, "0")}${bo.toString(16).padStart(2, "0")}`;
	}

	get argbColor() {
		const hex = this.color.replace("#", "");
		const a = Math.round((this.opacity / 100) * 255);
		return "#" + a.toString(16).padStart(2, "0").toUpperCase() + hex.toUpperCase();
	}

	get toolDef() {
		return TOOLS.find((t) => t.id === this.activeTool)!;
	}

	get hint() {
		const hints: Record<ToolId, string> = {
			hand: "Drag to pan the map. [1]",
			point: "Click to place, click existing to edit. [2]",
			freehand: "Click and drag to paint tiles. [3]",
			line: "Click start, then click end. [4]",
			rect: "Click and drag to fill a rectangle. [5]",
			eraser: "Click or drag to remove markers. [6]",
		};
		return hints[this.activeTool];
	}

	setTool(id: ToolId) {
		this.activeTool = id;
	}
}

export const toolStore = new ToolStore();
