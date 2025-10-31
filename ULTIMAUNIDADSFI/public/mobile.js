// Código del mobile (modificado para enviar posición del toque)
let socket;
let r = 255, g = 0, b = 0;
let intensity = 1;
let mode = "wave";
let lastTap = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  socket = io();
  socket.emit("role", "mobile");
}

function draw() {
  background(r, g, b, 180); // Fondo simple con color actual
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(20);
  text(
    `Modo: ${mode}\nColor: (${int(r)}, ${int(g)}, ${int(b)})\nIntensidad: ${intensity.toFixed(2)}`,
    width / 2,
    height / 2
  );
}

function touchMoved() {
  if (touches.length === 0) return false;

  const tx = touches[0].x / width;
  const ty = touches[0].y / height;

  // Cambiar colores e intensidad con el toque
  r = map(tx, 0, 1, 100, 255);
  g = map(ty, 0, 1, 0, 255);
  b = 255 - g * 0.5;
  intensity = map(ty, 0, 1, 0.5, 2);

  sendUpdate(tx, ty); // Enviar también la posición normalizada del toque
  return false;
}

function touchStarted() {
  const now = millis();
  if (now - lastTap < 400) {
    cycleMode();
  }
  lastTap = now;
  return false;
}

function touchEnded() {
  // Cuando se suelta el toque, enviar sin posición para desactivar el imán
  sendUpdate(undefined, undefined);
  return false;
}

function cycleMode() {
  const modes = ["wave", "pulse", "spiral"];
  const nextIndex = (modes.indexOf(mode) + 1) % modes.length;
  mode = modes[nextIndex];
  sendUpdate(undefined, undefined); // Enviar actualización sin cambiar posición
}

function sendUpdate(touchX, touchY) {
  socket.emit("fromMobile", {
    colorR: r,
    colorG: g,
    colorB: b,
    intensity: intensity,
    mode: mode,
    touchX: touchX, // Posición X normalizada (0-1) o undefined
    touchY: touchY  // Posición Y normalizada (0-1) o undefined
  });
}