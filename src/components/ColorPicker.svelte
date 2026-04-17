<script>
	import { toolStore } from "@/stores/tools.svelte";
</script>

<div class="color-picker">
	<label class="section-label">Color &amp; Opacity</label>
	<div class="color-row">
		<div class="swatch-wrap">
			<input
				type="color"
				class="color-input"
				value={toolStore.color}
				oninput={(e) => (toolStore.color = e.currentTarget.value)}
			/>
		</div>
		<div class="opacity-wrap">
			<input
				type="range"
				class="opacity-slider"
				min="0"
				max="100"
				value={toolStore.opacity}
				oninput={(e) => (toolStore.opacity = Number(e.currentTarget.value))}
			/>
			<span class="opacity-value">{toolStore.opacity}%</span>
		</div>
	</div>
</div>

<style>
	.color-picker {
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

	.color-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.swatch-wrap {
		position: relative;
	}

	.color-input {
		width: 32px;
		height: 32px;
		border: 2px solid var(--border);
		border-radius: 5px;
		padding: 0;
		background: var(--bg-input);
		cursor: pointer;
		transition: border-color 0.1s;
	}

	.color-input:hover {
		border-color: var(--accent-dim);
	}

	.opacity-wrap {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.opacity-slider {
		flex: 1;
		cursor: pointer;
		accent-color: var(--accent);
		height: 4px;
	}

	.opacity-value {
		font-size: 11px;
		color: var(--text-muted);
		min-width: 30px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
