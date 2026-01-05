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
    // CRITICAL: acceptWebSocket enables Hibernation (Free Tier friendly!)
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    // Get the city from the metadata Cloudflare attaches to the socket
    const city = ws.deserializeAttachment()?.city || "Unknown City";
    
    const payload = JSON.stringify({
      text: message,
      from: city,
      time: new Date().toLocaleTimeString()
    });
  
    this.ctx.getWebSockets().forEach((client) => {
      if (client !== ws) client.send(payload);
    });
  }
  
}
