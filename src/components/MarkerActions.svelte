<script>
	import { markerStore } from "@/stores/markers.svelte";
	import { toGlobalCoords } from "@/helpers";

	let shareStatus = $state("");

	async function handleShare() {
		const current = new URL(window.location.href);
		let toCopy = current.href;

		// Skip the API call if we've already shortened the current marker set
		// (indicated by the presence of an `?s=<id>` param; any marker edit
		// clears it via markerStore.syncToUrl).
		if (!current.searchParams.has("s")) {
			shareStatus = "Shortening…";
			try {
				const res = await fetch("/api/shorten", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ url: current.href }),
				});
				if (res.ok) {
					const data = await res.json();
					if (data?.id) {
						current.searchParams.delete("markers");
						current.searchParams.set("s", data.id);
						history.replaceState(null, "", current);
						toCopy = current.href;
					}
				}
			} catch {
				// Network / endpoint unreachable — fall through to copying the full URL.
			}
		}

		try {
			await navigator.clipboard.writeText(toCopy);
			shareStatus = "Copied!";
			setTimeout(() => (shareStatus = ""), 1500);
		} catch {
			shareStatus = "";
			prompt("Copy this URL:", toCopy);
		}
	}

	function handleImport() {
		const input = prompt("Paste RuneLite Ground Markers JSON:");
		if (!input) return;

		try {
			const data = JSON.parse(input);
			if (!Array.isArray(data)) {
				alert("Invalid format: expected a JSON array");
				return;
			}

			let count = 0;
			for (const marker of data) {
				if (marker.regionId == null || marker.regionX == null || marker.regionY == null) continue;

				const plane = marker.z || 0;
				const coords = toGlobalCoords(marker.regionId, marker.regionX, marker.regionY);

				if (markerStore.has(plane, coords.globalX, coords.globalY)) continue;

				let color = "#FFFF0000";
				if (typeof marker.color === "string") {
					color = marker.color;
				} else if (marker.color?.value != null) {
					const intColor = marker.color.value >>> 0;
					color = "#" + intColor.toString(16).padStart(8, "0").toUpperCase();
				}

				markerStore._rawPlace(plane, coords.globalX, coords.globalY, color, marker.label);
				markerStore.onPlace?.(plane, coords.globalX, coords.globalY, color);
				count++;
			}
			alert(`Imported ${count} marker(s)`);
		} catch (e) {
			alert("Failed to parse JSON: " + e.message);
		}
	}

	function handleExport() {
		if (markerStore.count === 0) {
			alert("No markers to export");
			return;
		}

		const data = markerStore.markers.map((m) => {
			const entry = {
				regionId: m.regionId,
				regionX: m.regionX,
				regionY: m.regionY,
				z: m.z,
				color: m.color,
			};
			if (m.label) entry.label = m.label;
			return entry;
		});

		const json = JSON.stringify(data);
		navigator.clipboard.writeText(json).then(
			() => alert(`Exported ${data.length} marker(s) to clipboard`),
			() => prompt("Copy this JSON:", json),
		);
	}

	function handleClear() {
		if (markerStore.count === 0) return;
		if (!confirm(`Remove all ${markerStore.count} markers?`)) return;
		markerStore.clearAll();
	}
</script>

<div class="marker-actions">
	<button class="action-btn" onclick={handleShare}>
		<span class="btn-icon">⎘</span>
		{shareStatus || "Share URL"}
	</button>

	<label class="section-label">RuneLite</label>
	<div class="button-row">
		<button class="action-btn" onclick={handleImport}>
			<span class="btn-icon">↓</span> Import
		</button>
		<button class="action-btn" onclick={handleExport}>
			<span class="btn-icon">↑</span> Export
		</button>
	</div>
	<button class="action-btn danger" onclick={handleClear}>Clear All Markers</button>
</div>

<style>
	.marker-actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		font-weight: 600;
	}

	.button-row {
		display: flex;
		gap: 5px;
	}

	.action-btn {
		flex: 1;
		padding: 7px 10px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg-input);
		color: var(--text-secondary);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.12s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}

	.action-btn:hover {
		background: var(--bg-hover);
		border-color: var(--border-hover);
		color: var(--text-primary);
	}

	.btn-icon {
		font-size: 12px;
	}

	.action-btn.danger {
		color: var(--danger-text);
		border-color: var(--danger-border);
	}

	.action-btn.danger:hover {
		background: var(--danger);
		border-color: var(--danger);
		color: white;
	}
</style>
