import { WebSocketServer } from 'ws';

import { setupWSConnection } from 'y-websocket/bin/utils.js';

export function initWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (conn, req) => {

    const docName = req.url.split('/').pop() || 'nexus-room';
    setupWSConnection(conn, req, { docName });
  });

  console.log('[WebSocket] Yjs Multiplayer server initialized');
  return wss;
}