import Phaser from "phaser";
import { onlinePlayers, room } from './SocketServer';
import OnlinePlayer from "./OnlinePlayer";
import Player from "./Player";

let cursors;

export class Scene2 extends Phaser.Scene {
    constructor() {
        super("playGame");
        this.socketKey = false; // Moved from global scope
    }

    init(data) {
        this.mapName = data.map;
        this.playerTexturePosition = data.playerTexturePosition;
    }

    create() {
        // --- ✅ CORRECT MESSAGE HANDLING ---
        room.then(room => {
            if (!room) {
                console.error("Could not connect to the room!");
                return;
            }

            // Listen for the 'CURRENT_PLAYERS' message
            room.onMessage("CURRENT_PLAYERS", (data) => {
                console.log('CURRENT_PLAYERS');
                Object.keys(data.players).forEach(playerId => {
                    let player = data.players[playerId];
                    if (playerId !== room.sessionId && !onlinePlayers[player.sessionId]) {
                        onlinePlayers[player.sessionId] = new OnlinePlayer({
                            scene: this,
                            worldLayer: this.worldLayer, // Pass worldLayer for collisions
                            playerId: player.sessionId,
                            map: player.map,
                            x: player.x,
                            y: player.y
                        });
                    }
                });
            });

            // Listen for the 'PLAYER_JOINED' message
            room.onMessage("PLAYER_JOINED", (data) => {
                console.log('PLAYER_JOINED');
                if (data.sessionId && !onlinePlayers[data.sessionId]) {
                    onlinePlayers[data.sessionId] = new OnlinePlayer({
                        scene: this,
                        worldLayer: this.worldLayer, // Pass worldLayer for collisions
                        playerId: data.sessionId,
                        map: data.map,
                        x: data.x,
                        y: data.y
                    });
                }
            });

            // Listen for the 'PLAYER_LEFT' message
            room.onMessage("PLAYER_LEFT", (data) => {
                console.log('PLAYER_LEFT');
                if (data.sessionId && onlinePlayers[data.sessionId]) {
                    onlinePlayers[data.sessionId].destroy();
                    delete onlinePlayers[data.sessionId];
                }
            });

            // Listen for the 'PLAYER_MOVED' message
            room.onMessage("PLAYER_MOVED", (data) => {
                // Ensure the player exists and is on the same map
                if (onlinePlayers[data.sessionId] && this.mapName === data.map) {
                    onlinePlayers[data.sessionId].isWalking(data.position, data.x, data.y);
                }
            });

            // Listen for the 'PLAYER_MOVEMENT_ENDED' message
            room.onMessage("PLAYER_MOVEMENT_ENDED", (data) => {
                if (onlinePlayers[data.sessionId] && this.mapName === data.map) {
                    onlinePlayers[data.sessionId].stopWalking(data.position);
                }
            });

            // Listen for when another player changes map
            room.onMessage("PLAYER_CHANGED_MAP", (data) => {
                console.log('Another player changed map:', data.sessionId);
                if (onlinePlayers[data.sessionId]) {
                    // If they left our map, destroy them
                    if (data.map !== this.mapName) {
                        onlinePlayers[data.sessionId].destroy();
                        delete onlinePlayers[data.sessionId];
                    }
                }
            });
        });

        // --- Map and Player Setup ---
        this.map = this.make.tilemap({ key: this.mapName });
        const tileset = this.map.addTilesetImage("tuxmon-sample-32px-extruded", "TilesTown");

        this.belowLayer = this.map.createLayer("Below Player", tileset, 0, 0);
        this.worldLayer = this.map.createLayer("World", tileset, 0, 0);
        this.aboveLayer = this.map.createLayer("Above Player", tileset, 0, 0);

        this.worldLayer.setCollisionByProperty({ collides: true });
        this.aboveLayer.setDepth(10);

        const spawnPoint = this.map.findObject("SpawnPoints", obj => obj.name === "Spawn Point");
        
        this.player = new Player({
            scene: this,
            worldLayer: this.worldLayer,
            key: 'player',
            x: spawnPoint.x,
            y: spawnPoint.y
        });

        const camera = this.cameras.main;
        camera.startFollow(this.player);
        camera.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        cursors = this.input.keyboard.createCursorKeys();
        
        this.add.text(16, 16, "Arrow keys to move\nPress SPACE by doors", {
                font: "18px monospace", fill: "#000000", padding: { x: 20, y: 10 }, backgroundColor: "#ffffff"
            }).setScrollFactor(0).setDepth(30);

        this.debugGraphics();
        this.movementTimer();
    }

    update(time, delta) {
        if (!this.player) return;

        // Loop the player update method
        this.player.update(time, delta);
        
        let playerMoved = this.player.isMoved();
        let position = this.player.container.oldPosition.direction;

        // If the player is moving, and the socket key is available, send an update
        if (playerMoved && this.socketKey && position) {
            room.then((room) => {
                room.send("PLAYER_MOVED", {
                    position: position,
                    x: this.player.x,
                    y: this.player.y
                });
            });
            this.socketKey = false;
        }

        // Send movement ended messages
        if (Phaser.Input.Keyboard.JustUp(cursors.left)) {
            room.then(room => room.send("PLAYER_MOVEMENT_ENDED", { position: 'left' }));
        } else if (Phaser.Input.Keyboard.JustUp(cursors.right)) {
            room.then(room => room.send("PLAYER_MOVEMENT_ENDED", { position: 'right' }));
        } else if (Phaser.Input.Keyboard.JustUp(cursors.up)) {
            room.then(room => room.send("PLAYER_MOVEMENT_ENDED", { position: 'back' }));
        } else if (Phaser.Input.Keyboard.JustUp(cursors.down)) {
            room.then(room => room.send("PLAYER_MOVEMENT_ENDED", { position: 'front' }));
        }
    }

    movementTimer() {
        setInterval(() => {
            this.socketKey = true;
        }, 50);
    }

    debugGraphics() {
        this.input.keyboard.once("keydown_D", event => {
            this.physics.world.createDebugGraphic();
            const graphics = this.add.graphics().setAlpha(0.75).setDepth(20);
            this.worldLayer.renderDebug(graphics, {
                tileColor: null,
                collidingTileColor: new Phaser.Display.Color(243, 134, 48, 255),
                faceColor: new Phaser.Display.Color(40, 39, 37, 255)
            });
        });
    }
}