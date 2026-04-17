<script>
	import { mapStore } from "@/stores/map.svelte";
</script>

<div class="map-controls">
	<label class="section-label">Map</label>
	<div class="controls-row">
		<div class="control-group">
			<span class="control-label">Zoom</span>
			<div class="btn-group">
				<button class="ctrl-btn" onclick={() => mapStore.zoomOut()}>−</button>
				<span class="ctrl-value">{mapStore.zoom}</span>
				<button class="ctrl-btn" onclick={() => mapStore.zoomIn()}>+</button>
			</div>
		</div>
		<div class="control-group">
			<span class="control-label">Plane</span>
			<div class="btn-group">
				<button class="ctrl-btn" disabled={mapStore.plane <= 0} onclick={() => mapStore.planeDown()}>▼</button>
				<span class="ctrl-value">{mapStore.plane}</span>
				<button class="ctrl-btn" disabled={mapStore.plane >= 3} onclick={() => mapStore.planeUp()}>▲</button>
			</div>
		</div>
	</div>
	<label class="toggle-row">
		<input
			type="checkbox"
			checked={mapStore.showCoords}
			onchange={() => (mapStore.showCoords = !mapStore.showCoords)}
		/>
		<span class="toggle-text">Show coordinates</span>
	</label>
</div>

<style>
	.map-controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.controls-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.control-label {
		font-size: 10px;
		color: var(--text-label);
	}

	.btn-group {
		display: flex;
		align-items: center;
		background: var(--bg-input);
		border: 1px solid var(--border);
		border-radius: 5px;
		overflow: hidden;
	}

	.ctrl-btn {
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-size: 13px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.1s;
	}

	.ctrl-btn:hover:not(:disabled) {
		background: var(--bg-hover);
		color: var(--accent);
	}

	.ctrl-btn:disabled {
		color: var(--border);
		cursor: default;
	}

	.ctrl-value {
		width: 24px;
		text-align: center;
		font-size: 12px;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
		border-left: 1px solid var(--border);
		border-right: 1px solid var(--border);
		line-height: 28px;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		margin-top: 2px;
	}

	.toggle-row input[type="checkbox"] {
		accent-color: var(--accent);
		width: 13px;
		height: 13px;
		cursor: pointer;
	}

	.toggle-text {
		font-size: 11px;
		color: var(--text-muted);
	}
</style>
