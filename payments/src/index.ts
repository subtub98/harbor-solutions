import { createServer } from "node:http";
import { submitTransfer, listAuditLog } from "./transfer.ts";

const port = Number(process.env.PORT ?? 8787);

const server = createServer(async (req, res) => {
  const json = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/health") {
    json(200, { ok: true, service: "harbor-ach" });
    return;
  }

  if (req.method === "GET" && req.url === "/audit") {
    json(200, { records: listAuditLog() });
    return;
  }

  if (req.method === "POST" && req.url === "/transfers") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const result = submitTransfer(body);
      json(result.status === "accepted" ? 200 : 400, result);
    } catch {
      json(400, { status: "rejected", reason: "invalid_json" });
    }
    return;
  }

  json(404, { error: "not_found" });
});

server.listen(port, () => {
  console.log(`harbor-ach listening on :${port}`);
});
