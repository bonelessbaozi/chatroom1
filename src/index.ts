import { DurableObject } from "cloudflare:workers";

export default {
  async fetch(request, env) {
    if (request.headers.get("Upgrade") === "websocket") {
      const id = env.CHAT_ROOM.idFromName("global");
      return env.CHAT_ROOM.get(id).fetch(request);
    }
    return new Response("Connect via WS to /ws");
  },
} satisfies ExportedHandler<Env>;

export class ChatRoom extends DurableObject {
  async fetch(request: Request) {
    const [client, server] = Object.values(new WebSocketPair());

    // 1. Get the city from the request headers
    const city = request.cf?.city || "Unknown City";

    // 2. SAVE the city to the socket so it survives hibernation
    server.serializeAttachment({ city });

    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

async webSocketMessage(ws: WebSocket, message: string) {
  const attachment = ws.deserializeAttachment();
  const city = attachment?.city || "Unknown City";

  // Check if message is a simple string or a JSON object
  let textContent = message;
  try {
    const parsed = JSON.parse(message);
    textContent = parsed.text || message;
  } catch (e) {
    // It's just a plain string from Python, which is fine!
  }

  const payload = JSON.stringify({
    text: textContent,
    from: city,
    time: new Date().toLocaleTimeString()
  });

  this.ctx.getWebSockets().forEach((client) => {
    if (client !== ws) client.send(payload);
  });
}

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    this.ctx.getWebSockets().forEach(client => {
      if (client !== ws) {
        client.send(JSON.stringify({ system: "User left the chat" }));
      }
    });
  }
}
