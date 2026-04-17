<script>
	import Map from "@/components/Map.svelte";
	import Sidebar from "@/components/Sidebar.svelte";
	import { toolStore } from "@/stores/tools.svelte";
</script>

<div class="app" style="--accent: {toolStore.accent}; --accent-dim: {toolStore.accent}33;">
	<Sidebar />
	<div class="map-area">
		<Map />
	</div>
</div>

<style>
	:global(:root) {
		/* Surface colors */
		--bg-base: #0a0a1a;
		--bg-panel: #12122a;
		--bg-input: #16162a;
		--bg-hover: #1e1e38;

		/* Border colors */
		--border: #2a2a40;
		--border-hover: #3a3a54;

		/* Text colors */
		--text-primary: #e0e0ec;
		--text-secondary: #d0d0e0;
		--text-muted: #a0a0b4;
		--text-dim: #9898b0;
		--text-label: #b8b8cc;

		/* Danger */
		--danger: #c0392b;
		--danger-text: #c07070;
		--danger-border: #3a2020;
	}

	.app {
		display: flex;
		height: 100vh;
		width: 100vw;
		overflow: hidden;
		background: var(--bg-base);
	}

	.map-area {
		flex: 1;
		position: relative;
		min-width: 0;
	}
</style>
