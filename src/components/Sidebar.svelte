<script>
	import ToolPicker from "@/components/ToolPicker.svelte";
	import ColorPicker from "@/components/ColorPicker.svelte";
	import MarkerActions from "@/components/MarkerActions.svelte";
	import MapControls from "@/components/MapControls.svelte";
	import LayerToggles from "@/components/LayerToggles.svelte";
	import { markerStore } from "@/stores/markers.svelte";
</script>

<aside class="sidebar">
	<header class="sidebar-header">
		<h1 class="logo">OSRS Tile Editor</h1>
	</header>

	<div class="sidebar-scroll">
		<section class="panel">
			<MapControls />
		</section>

		<hr class="divider" />

		<section class="panel">
			<LayerToggles />
		</section>

		<hr class="divider" />

		<section class="panel">
			<ToolPicker />
		</section>

		<section class="panel">
			<ColorPicker />
		</section>

		<hr class="divider" />

		<section class="panel">
			<div class="marker-count">
				<span class="count-num">{markerStore.count}</span>
				<span class="count-label">{markerStore.count === 1 ? "marker" : "markers"}</span>
			</div>
		</section>

		<section class="panel">
			<MarkerActions />
		</section>
	</div>

	<footer class="sidebar-footer">
		Made with ❤ by <a href="https://github.com/Chumbus" target="_blank" rel="noopener">Ben Knowles</a>
	</footer>
</aside>

<style>
	.sidebar {
		width: 252px;
		min-width: 252px;
		background: var(--bg-panel);
		color: var(--text-primary);
		display: flex;
		flex-direction: column;
		border-right: 2px solid var(--accent-dim);
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	}

	.sidebar-header {
		padding: 14px 16px 10px;
		border-bottom: 1px solid var(--bg-hover);
	}

	.logo {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		color: var(--accent);
		letter-spacing: 0.02em;
	}

	.sidebar-scroll {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 10px 14px 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.sidebar-scroll::-webkit-scrollbar {
		width: 4px;
	}

	.sidebar-scroll::-webkit-scrollbar-thumb {
		background: var(--bg-hover);
		border-radius: 2px;
	}

	.panel {
		display: flex;
		flex-direction: column;
	}

	.divider {
		border: none;
		border-top: 1px solid var(--bg-hover);
		margin: 2px 0;
	}

	.marker-count {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.count-num {
		font-size: 22px;
		font-weight: 700;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.count-label {
		font-size: 11px;
		color: var(--text-muted);
	}

	.sidebar-footer {
		padding: 10px 14px;
		border-top: 1px solid var(--bg-hover);
		font-size: 11px;
		color: var(--text-dim);
		text-align: center;
	}

	.sidebar-footer a {
		color: var(--text-muted);
		text-decoration: none;
	}

	.sidebar-footer a:hover {
		color: var(--accent);
	}
</style>
