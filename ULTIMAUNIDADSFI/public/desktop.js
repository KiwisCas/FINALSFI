let song, font, amplitude, fft;
let socket;
let waveOffset = 0;
let control = { intensity: 1, colorR: 255, colorG: 0, colorB: 0, mode: "wave" };

// Variables para suavizar transiciones
let smoothIntensity = 1;
let smoothColorR = 255;
let smoothColorG = 0;
let smoothColorB = 0;

// Variables para suavizar el movimiento de letras
let smoothWaveY = {}; // Objeto para almacenar waveY suavizados por letra

let lyricsTimeline = [];
let currentPhrase = 0;
let started = false;
let beatScale = 1;

// Sistema de partículas
let particles = [];

// Variables para la malla
let cols = 30; // Número de columnas en la malla
let rows = 20; // Número de filas en la malla
let mesh = []; // Array 2D para almacenar las alturas de la malla

function preload() {
  song = loadSound("i_feel_it_coming.mp3");
  font = loadFont("assets/fonts/MyFont.ttf");
  loadStrings("lyrics.lrc", parseLyrics);
}

function parseLyrics(lines) {
  lyricsTimeline = [];
  for (let line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseFloat(match[2]);
      const time = min * 60 + sec;
      const text = match[3].trim();
      lyricsTimeline.push({ time, text });
    }
  }
  lyricsTimeline.sort((a, b) => a.time - b.time);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont(font);
  textSize(24);
  textAlign(CENTER, CENTER);

  amplitude = new p5.Amplitude();
  fft = new p5.FFT(0.8, 64);

  // Inicializar la malla
  for (let i = 0; i < cols; i++) {
    mesh[i] = [];
    for (let j = 0; j < rows; j++) {
      mesh[i][j] = 0; // Altura inicial
    }
  }

  socket = io();
  socket.emit("role", "desktop");
  socket.on("toDesktop", (data) => {
    control = data;
  });

  // Iniciar automáticamente (reducir interacciones)
  userStartAudio().then(() => {
    started = true;
    song.play();
  }).catch(() => {
    // Si falla, mostrar mensaje para interacción mínima
    background(0);
    fill(255);
    textSize(32);
    text("Haz clic para iniciar", width / 2, height / 2);
  });
}

function mousePressed() {
  // Solo si no inició automáticamente
  if (!started) {
    userStartAudio().then(() => {
      started = true;
      song.play();
    });
  }
}

function draw() {
  if (!started) return;

  background(0);
  waveOffset += 0.03;

  const spectrum = fft.analyze();
  const bassEnergy = fft.getEnergy("bass");
  const midEnergy = fft.getEnergy("mid");
  const trebleEnergy = fft.getEnergy("treble");

  // Suavizar pulso
  beatScale = lerp(beatScale, map(bassEnergy, 0, 255, 0.8, 1.5), 0.1);

  // Suavizar controles para transiciones suaves
  smoothIntensity = lerp(smoothIntensity, control.intensity, 0.05);
  smoothColorR = lerp(smoothColorR, control.colorR, 0.05);
  smoothColorG = lerp(smoothColorG, control.colorG, 0.05);
  smoothColorB = lerp(smoothColorB, control.colorB, 0.05);

  // --- Malla con efectos de onda y color basado en profundidad ---
  // Actualizar la malla con ondas basadas en el espectro FFT
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = map(i, 0, cols - 1, 0, width);
      let y = map(j, 0, rows - 1, 0, height);
      
      // Calcular la amplitud de la onda basada en el espectro
      let specIndex = floor(map(i, 0, cols - 1, 0, spectrum.length - 1));
      let waveAmp = map(spectrum[specIndex], 0, 255, 0, 100) * smoothIntensity * beatScale;
      
      // Efecto de onda: sinusoidal con offset
      let waveY = sin(x * 0.01 + waveOffset + j * 0.1) * waveAmp;
      
      // Suavizar la altura de la malla
      mesh[i][j] = lerp(mesh[i][j], waveY, 0.1);
    }
  }

  // Dibujar la malla como una superficie conectada
  strokeWeight(1);
  for (let i = 0; i < cols - 1; i++) {
    for (let j = 0; j < rows - 1; j++) {
      let x1 = map(i, 0, cols - 1, 0, width);
      let y1 = map(j, 0, rows - 1, 0, height) + mesh[i][j];
      let x2 = map(i + 1, 0, cols - 1, 0, width);
      let y2 = map(j, 0, rows - 1, 0, height) + mesh[i + 1][j];
      let x3 = map(i, 0, cols - 1, 0, width);
      let y3 = map(j + 1, 0, rows - 1, 0, height) + mesh[i][j + 1];
      let x4 = map(i + 1, 0, cols - 1, 0, width);
      let y4 = map(j + 1, 0, rows - 1, 0, height) + mesh[i + 1][j + 1];
      
      // Calcular profundidad promedio para el color (basado en la altura)
      let avgDepth = (mesh[i][j] + mesh[i + 1][j] + mesh[i][j + 1] + mesh[i + 1][j + 1]) / 4;
      let depthFactor = map(avgDepth, -100, 100, 0, 1); // Normalizar entre -100 y 100
      
      // Colores basados en profundidad: azul profundo para abajo, amarillo/rojo para arriba
      let r = lerp(0, smoothColorR, depthFactor); // Azul a rojo
      let g = lerp(0, smoothColorG, depthFactor); // Azul a verde
      let b = lerp(255, smoothColorB, 1 - depthFactor); // Azul a azul (pero ajustado)
      
      fill(r, g, b, 150); // Opacidad para efecto translúcido
      noStroke();
      
      // Dibujar triángulos para la malla
      triangle(x1, y1, x2, y2, x3, y3);
      triangle(x2, y2, x3, y3, x4, y4);
    }
  }

  // --- Generar partículas cuando bajos suben mucho ---
  if (bassEnergy > 200 && particles.length < 200) { // Umbral y límite de partículas
    for (let j = 0; j < 15; j++) { // Crear 15 partículas por frame
      let isGold = random() > 0.5; // Alternar entre dorado y plateado
      particles.push({
        x: width / 2,
        y: height / 2,
        vx: random(-5, 5), // Velocidad aleatoria
        vy: random(-5, 5),
        life: 60, // Vida en frames
        size: random(5, 15),
        color: isGold ? [255, 215, 0] : [192, 192, 192] // Dorado o plateado
      });
    }
  }

  // Actualizar y dibujar partículas
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) {
      particles.splice(i, 1); // Eliminar partículas muertas
    } else {
      fill(p.color[0], p.color[1], p.color[2], map(p.life, 0, 60, 0, 150)); // Desvanecer con opacidad máxima 150
      noStroke();
      ellipse(p.x, p.y, p.size);
    }
  }

  // --- Sincronización de texto ---
  if (lyricsTimeline.length === 0) return;

  const t = song.currentTime();
  if (currentPhrase < lyricsTimeline.length - 1 && t > lyricsTimeline[currentPhrase + 1].time) {
    currentPhrase++;
  }

  const level = amplitude.getLevel();
  const waveAmp = map(level, 0, 0.3, 5, 30) * smoothIntensity * beatScale;

  // Mostrar hasta 3 frases: actual, siguiente y siguiente siguiente, con tamaños y opacidades decrecientes
  const phrasesToShow = [];
  for (let i = 0; i < 3; i++) {
    if (currentPhrase + i < lyricsTimeline.length) {
      phrasesToShow.push({
        text: lyricsTimeline[currentPhrase + i].text,
        scale: 1 - i * 0.3, // Tamaño decreciente
        alpha: 255 - i * 80, // Opacidad decreciente
        yOffset: i * 60 // Separación vertical
      });
    }
  }

  for (let phrase of phrasesToShow) {
    const currentText = phrase.text || "";
    if (currentText === "") continue;

    fill(smoothColorR, smoothColorG, smoothColorB, phrase.alpha);
    noStroke();

    // Calcular el ancho total de la frase para centrarla
    textSize(24 * beatScale * phrase.scale);
    const totalWidth = textWidth(currentText);
    let startX = (width - totalWidth) / 2;
    const baseY = height / 2 + phrase.yOffset;

    // Dibujar cada letra de izquierda a derecha, con movimiento ondulatorio suave
    for (let i = 0; i < currentText.length; i++) {
      const char = currentText[i];
      const charWidth = textWidth(char);
      const x = startX + textWidth(currentText.substring(0, i));

      let waveY = 0;
      const key = `${phrase.text}-${i}`; // Clave única para cada letra
      if (!smoothWaveY[key]) smoothWaveY[key] = 0;

      switch (control.mode) {
        case "wave":
          waveY = sin((x * 0.05) + waveOffset) * waveAmp * phrase.scale * 0.5; // Reducido para suavidad
          break;
        case "pulse":
          waveY = sin(frameCount * 0.15) * waveAmp * 0.8 * phrase.scale * 0.5;
          break;
        case "spiral":
          waveY = sin((dist(x, baseY, width / 2, height / 2) * 0.03) - waveOffset) * waveAmp * 1.2 * phrase.scale * 0.5;
          break;
      }

      // Suavizar el movimiento con lerp
      smoothWaveY[key] = lerp(smoothWaveY[key], waveY, 0.1);

      push();
      translate(x + charWidth / 2, baseY + smoothWaveY[key]);
      text(char, 0, 0);
      pop();
    }
  }

  // Efecto visual extra: pulso de fondo (mantenerlo, pero ahora complementado con la malla)
  noStroke();
  fill(smoothColorR, smoothColorG, smoothColorB, 40);
  ellipse(width / 2, height / 2, bassEnergy * 2, bassEnergy * 2);
}
