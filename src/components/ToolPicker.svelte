<script>
	import { TOOLS, toolStore } from "@/stores/tools.svelte";
</script>

<div class="tool-picker">
	<label class="section-label">Tool</label>
	<div class="tool-buttons">
		{#each TOOLS as tool}
			<button
				class="tool-btn"
				class:active={toolStore.activeTool === tool.id}
				onclick={() => toolStore.setTool(tool.id)}
				title={tool.label}
			>
				<span class="tool-name">{tool.label}</span>
				<kbd class="key-hint">{tool.key}</kbd>
			</button>
		{/each}
	</div>

	{#if toolStore.activeTool === "eraser"}
		<div class="size-row">
			<label for="eraser-size" class="size-label">Size</label>
			<input
				id="eraser-size"
				type="range"
				min="1"
				max="10"
				bind:value={toolStore.eraserSize}
				class="size-slider"
			/>
			<span class="size-val">{toolStore.eraserSize}</span>
		</div>
	{/if}

	<p class="hint">{toolStore.hint}</p>
</div>

<style>
	.tool-picker {
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

	.tool-buttons {
		display: flex;
		gap: 3px;
	}

	.tool-btn {
		flex: 1;
		padding: 6px 2px 4px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg-input);
		color: var(--text-label);
		font-size: 10px;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		transition: all 0.12s ease;
	}

	.tool-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
		border-color: var(--border-hover);
	}

	.tool-btn.active {
		background: var(--accent);
		color: var(--bg-panel);
		border-color: var(--accent);
		box-shadow: 0 0 8px var(--accent-dim);
	}

	.tool-name {
		font-weight: 600;
		line-height: 1;
	}

	.key-hint {
		font-size: 8px;
		color: var(--text-label);
		font-family: inherit;
		border: none;
		background: none;
		padding: 0;
	}

	.tool-btn.active .key-hint {
		color: var(--bg-panel);
	}

	.hint {
		margin: 0;
		font-size: 10px;
		color: var(--text-dim);
		line-height: 1.3;
	}

	.size-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 2px 0;
	}

	.size-label {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		font-weight: 600;
	}

	.size-slider {
		flex: 1;
		accent-color: var(--accent);
	}

	.size-val {
		font-size: 11px;
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
		min-width: 16px;
		text-align: right;
	}
</style>
