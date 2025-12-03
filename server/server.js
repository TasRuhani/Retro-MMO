const http = require('http');
const express = require('express');
const cors = require('cors');
const colyseus = require('colyseus');
const monitor = require("@colyseus/monitor").monitor;
const { initializeDatabase, userDb } = require('./database');
// const socialRoutes = require("@colyseus/social/express").default;

const PokeWorld = require('./rooms/PokeWorld').PokeWorld;

const port = process.env.PORT || 3000;
const app = express()

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new colyseus.Server({
    server: server,
});

// register your room handlers
gameServer.define("poke_world", PokeWorld)
    .on("create", (room) => console.log("room created:", room.roomId))
    .on("dispose", (room) => console.log("room disposed:", room.roomId))
    .on("join", (room, client) => console.log(client.id, "joined", room.roomId))
    .on("leave", (room, client) => console.log(client.id, "left", room.roomId));

// ToDo: Create a 'chat' room for realtime chatting

// Authentication API endpoints
app.post('/api/login', async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || name.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }

        if (name.trim().length > 50) {
            return res.status(400).json({ success: false, error: 'Name must be 50 characters or less' });
        }

        // Generate a temporary session ID for the login request
        const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const result = await userDb.login(name.trim(), tempSessionId);
        
        if (result.success) {
            res.json({
                success: true,
                sessionId: tempSessionId,
                username: result.user.name,
                newUser: result.newUser || false
            });
        } else {
            res.status(409).json(result);
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Server error during login' });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'Session ID is required' });
        }

        await userDb.logout(sessionId);
        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, error: 'Server error during logout' });
    }
});

/**
 * Register @colyseus/social routes
 *
 * - uncomment if you want to use default authentication (https://docs.colyseus.io/authentication/)
 * - also uncomment the require statement
 */
// app.use("/", socialRoutes);

// register colyseus monitor AFTER registering your room handlers
app.use("/colyseus", monitor(gameServer));

// Initialize database and start server
(async () => {
    try {
        await initializeDatabase();
        await userDb.cleanupStaleSessions();
        gameServer.listen(port);
        console.log(`Listening on ws://localhost:${port}`);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
})();
