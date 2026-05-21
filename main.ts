import { serveDir } from "jsr:@std/http/file-server";

// Deno.serve automatically binds to port 8000 and is fully 
// supported by Deno Deploy's new architecture.
Deno.serve((req: Request) => {
  return serveDir(req, {
    fsRoot: "public",
  });
});