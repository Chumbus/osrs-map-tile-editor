<script>
	import { onMount } from "svelte";
	import { initMap } from "@/map";
	import { mapStore } from "@/stores/map.svelte";

	let container;

	onMount(() => {
		const map = initMap(container);
		return () => map.remove();
	});

	$effect(() => {
		if (!container) return;
		const el = container.querySelector(".leaflet-control-mouseposition");
		if (el) el.style.display = mapStore.showCoords ? "" : "none";
	});
</script>

<div class="map-wrap">
	<div bind:this={container} class="map-container"></div>
	<button class="fullscreen-btn" onclick={() => mapStore.toggleFullscreen()} title="Fullscreen">⛶</button>
</div>

<style>
	.map-wrap {
		width: 100%;
		height: 100%;
		position: relative;
	}

	.map-container {
		width: 100%;
		height: 100%;
		background: black;
	}

	.fullscreen-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 1000;
		width: 32px;
		height: 32px;
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-radius: 6px;
		color: var(--text-secondary);
		font-size: 18px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(6px);
		transition: all 0.1s;
	}

	.fullscreen-btn:hover {
		color: var(--accent);
		border-color: var(--accent-dim);
	}
</style>
