<script>
	import { layerStore } from "@/stores/layers.svelte";
</script>

<div class="layer-toggles">
	<label class="section-label">Layers</label>
	<div class="toggles">
		{#each layerStore.layers as layer}
			<label class="toggle-row">
				<input
					type="checkbox"
					checked={layer.active}
					onchange={() => layerStore.toggle(layer.id)}
				/>
				<span class="toggle-label">{layer.label}</span>
			</label>
		{/each}
	</div>
</div>

<style>
	.layer-toggles {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.section-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		font-weight: 600;
	}

	.toggles {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 6px;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.1s;
	}

	.toggle-row:hover {
		background: var(--bg-hover);
	}

	.toggle-row input[type="checkbox"] {
		accent-color: var(--accent);
		width: 14px;
		height: 14px;
		cursor: pointer;
	}

	.toggle-label {
		font-size: 12px;
		color: var(--text-secondary);
	}
</style>
