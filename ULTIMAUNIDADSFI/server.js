import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "desktop.html"));
});

app.get("/mobile", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mobile.html"));
});

io.on("connection", (socket) => {
  console.log("[WS] Cliente conectado:", socket.id);

  socket.on("role", (role) => {
    socket.role = role;
    console.log("Rol asignado:", role);
  });

  socket.on("fromMobile", (data) => {
    io.emit("toDesktop", data);
  });
  
  socket.on("disconnect", () => {
    console.log("[WS] Desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Servidor en puerto", PORT));
