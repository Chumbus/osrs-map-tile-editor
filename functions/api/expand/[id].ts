/// <reference types="@cloudflare/workers-types" />

interface Env {
	SHORT_URLS: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
	const id = typeof params.id === "string" ? params.id : params.id?.[0];
	if (!id) return Response.json({ error: "missing id" }, { status: 400 });

	const target = await env.SHORT_URLS.get(id);
	if (!target) return Response.json({ error: "not found" }, { status: 404 });

	let markers: string | null = null;
	try {
		const url = new URL(target);
		markers = url.searchParams.get("markers");
	} catch {
		// target wasn't a parseable URL; fall through with markers=null
	}

	return Response.json({ url: target, markers });
};
