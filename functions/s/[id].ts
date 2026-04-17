/// <reference types="@cloudflare/workers-types" />

interface Env {
	SHORT_URLS: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
	const id = typeof params.id === "string" ? params.id : params.id?.[0];
	if (!id) return new Response("Not found", { status: 404 });

	const target = await env.SHORT_URLS.get(id);
	if (!target) return new Response("Not found", { status: 404 });

	return Response.redirect(target, 302);
};
