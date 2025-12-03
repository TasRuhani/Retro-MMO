const colyseus = require('colyseus');
const { userDb } = require('../database');

// The distance in pixels for chat to be visible.
const PROXIMITY_RADIUS = 250; 

exports.PokeWorld = class extends colyseus.Room {

    onCreate(options) {
        console.log('ON CREATE');
        
        // Initialize players state for THIS room instance
        this.players = {};

        // Handler for when a client is ready to receive players
        this.onMessage("GET_PLAYERS", (client) => {
            console.log("GET_PLAYERS request received from", client.sessionId);
            client.send("CURRENT_PLAYERS", { players: this.players });
        });

        // Handler for chat messages
        this.onMessage("chat", (client, message) => {
            const sender = this.players[client.sessionId];
            if (!sender || !message || message.length > 100) return;

            const nearbyClients = this.clients.filter(c => {
                const receiver = this.players[c.sessionId];
                if (!receiver) return false;
                
                const distance = Math.hypot(sender.x - receiver.x, sender.y - receiver.y);
                return distance <= PROXIMITY_RADIUS;
            });

            // Loop through nearby clients and send the message to each one
            nearbyClients.forEach(c => {
                c.send("show_chat_bubble", {
                    senderId: client.sessionId,
                    username: sender.username,
                    message: message.trim()
                });
            });
        });

        // --- Existing Movement Handlers ---
        this.onMessage("PLAYER_MOVED", (client, data) => {
            if (this.players[client.sessionId]) {
                this.players[client.sessionId].x = data.x;
                this.players[client.sessionId].y = data.y;
                this.broadcast("PLAYER_MOVED", {
                    ...this.players[client.sessionId],
                    position: data.position
                }, { except: client });
            }
        });

        this.onMessage("PLAYER_MOVEMENT_ENDED", (client, data) => {
            if (this.players[client.sessionId]) {
                this.broadcast("PLAYER_MOVEMENT_ENDED", {
                    sessionId: client.sessionId,
                    map: this.players[client.sessionId].map,
                    position: data.position
                }, { except: client });
            }
        });

        this.onMessage("PLAYER_CHANGED_MAP", (client, data) => {
            if (this.players[client.sessionId]) {
                this.players[client.sessionId].map = data.map;
                client.send("CURRENT_PLAYERS", { players: this.players });
                this.broadcast("PLAYER_CHANGED_MAP", {
                    sessionId: client.sessionId, map: this.players[client.sessionId].map, x: 300, y: 75, players: this.players
                }, { except: client });
            }
        });

        // Heartbeat handler to update last_seen_at
        this.onMessage("heartbeat", async (client) => {
            try {
                await userDb.updateLastSeen(client.sessionId);
            } catch (error) {
                console.error('Error updating heartbeat:', error);
            }
        });
    }

    onJoin(client, options) {
        console.log('ON JOIN', client.sessionId);
        // Store username from options if provided
        const username = options.username || client.sessionId;
        this.players[client.sessionId] = {
            sessionId: client.sessionId,
            username: username,
            map: 'town',
            x: 352,
            y: 1216
        };
        // Announce the new player to all other clients
        this.broadcast("PLAYER_JOINED", { ...this.players[client.sessionId] }, { except: client });
    }

    async onLeave(client, consented) {
        console.log('ON LEAVE', client.sessionId);
        
        // Update database to mark user as offline
        try {
            await userDb.logout(client.sessionId);
        } catch (error) {
            console.error('Error logging out user:', error);
        }
        
        if (this.players[client.sessionId]) {
            this.broadcast("PLAYER_LEFT", { 
                sessionId: client.sessionId, 
                map: this.players[client.sessionId].map 
            });
            delete this.players[client.sessionId];
        }
    }

    onDispose() {
        console.log('ON DISPOSE');
    }
};