let socket;
let role = '';

function initSocket(r) {
  role = r;
  socket = new WebSocket('ws://localhost:8080');

  socket.onopen = () => {
    console.log(`[WS] Conectado como ${role}`);
    socket.send(JSON.stringify({ role }));
  };

  socket.onmessage = e => {
    const data = JSON.parse(e.data);
    if (role === 'desktop') handleDesktopMessages(data);
  };
}

function sendMobileData(payload) {
  if (socket && role === 'mobile') {
    socket.send(JSON.stringify({ type: 'mobileData', payload }));
  }
}

function handleDesktopMessages(data) {
  if (data.type === 'microbitData') {
    window.microbitData = data.payload;
  } else if (data.type === 'mobileData') {
    window.mobileData = data.payload;
  }
}
