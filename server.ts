import index from "./index.html";

Bun.serve({
	port: 3000,
	routes: {
		"/": index,
	},
	fetch(req) {
		const url = new URL(req.url);

		// Serve static files from public/
		const publicPath = `./public${url.pathname}`;
		const file = Bun.file(publicPath);
		return file.exists().then((exists) => {
			if (exists) return new Response(file);
			return new Response("Not Found", { status: 404 });
		});
	},
	development: {
		hmr: true,
		console: true,
	},
});

console.log("OSRS Tile Editor running at http://localhost:3000");
