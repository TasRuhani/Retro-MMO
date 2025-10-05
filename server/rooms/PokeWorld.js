const colyseus = require('colyseus');

exports.PokeWorld = class extends colyseus.Room {

    onCreate(options) {
        console.log('ON CREATE');
        
        // ✅ Initialize players state for THIS room instance
        this.players = {};

        this.onMessage("PLAYER_MOVED", (client, data) => {
            // Update the player's state
            this.players[client.sessionId].x = data.x;
            this.players[client.sessionId].y = data.y;

            // Broadcast the updated state to other clients
            this.broadcast("PLAYER_MOVED", {
                ...this.players[client.sessionId],
                position: data.position
            }, { except: client });
        });

        this.onMessage("PLAYER_MOVEMENT_ENDED", (client, data) => {
            this.broadcast("PLAYER_MOVEMENT_ENDED", {
                sessionId: client.sessionId,
                map: this.players[client.sessionId].map,
                position: data.position
            }, { except: client });
        });

        this.onMessage("PLAYER_CHANGED_MAP", (client, data) => {
            if (this.players[client.sessionId]) {
                this.players[client.sessionId].map = data.map;
        
                // Send the full list of players to the client that changed maps
                client.send("CURRENT_PLAYERS", { players: this.players });

                // Inform other clients about the map change
                this.broadcast("PLAYER_CHANGED_MAP", {
                    sessionId: client.sessionId,
                    map: this.players[client.sessionId].map,
                    x: 300,
                    y: 75,
                    players: this.players
                }, { except: client });
            }
        });
    }

    onJoin(client, options) {
        console.log('ON JOIN', client.sessionId);

        // Create a new player object
        this.players[client.sessionId] = {
            sessionId: client.sessionId,
            map: 'town',
            x: 352,
            y: 1216
        };

        // Send the current list of all players to the newly joined client
        client.send("CURRENT_PLAYERS", { players: this.players });

        // Announce the new player to all other clients
        this.broadcast("PLAYER_JOINED", { ...this.players[client.sessionId] }, { except: client });
    }

    onLeave(client, consented) {
        console.log('ON LEAVE', client.sessionId);
        
        if (this.players[client.sessionId]) {
            // Announce that a player has left
            this.broadcast("PLAYER_LEFT", { 
                sessionId: client.sessionId, 
                map: this.players[client.sessionId].map 
            });
            
            // Remove the player from the state
            delete this.players[client.sessionId];
        }
    }

    onDispose() {
        console.log('ON DISPOSE');
    }
};