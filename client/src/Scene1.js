import Phaser from 'phaser';

import TownJSON from "./assets/tilemaps/town.json";
import TilesTown from "./assets/tilesets/tuxmon-sample-32px-extruded.png";
import Route1JSON from "./assets/tilemaps/route1";
import AtlasJSON from "./assets/atlas/atlas";
import AtlasPNG from "./assets/atlas/atlas.png";
import PlayersAtlasJSON from "./assets/atlas/players";
import PlayersAtlasPNG from "./assets/images/players/players.png";

export class Scene1 extends Phaser.Scene {
    constructor() {
        super("bootGame");
    }

    preload() {
        this.load.image("TilesTown", TilesTown);
        this.load.tilemapTiledJSON("town", TownJSON);
        this.load.tilemapTiledJSON("route1", Route1JSON);
        this.load.atlas("currentPlayer", AtlasPNG, AtlasJSON);
        this.load.atlas("players", PlayersAtlasPNG, PlayersAtlasJSON);
    }

    create() {
        this.add.text(20, 20, "Loading game...");
        this.scene.start("playGame", {map: 'town', playerTexturePosition: 'front'});

        // Create player animations
        const anims = this.anims;
        anims.create({
            key: "misa-left-walk", frames: anims.generateFrameNames("currentPlayer", { prefix: "misa-left-walk.", start: 0, end: 3, zeroPad: 3 }),
            frameRate: 10, repeat: -1
        });
        anims.create({
            key: "misa-right-walk", frames: anims.generateFrameNames("currentPlayer", { prefix: "misa-right-walk.", start: 0, end: 3, zeroPad: 3 }),
            frameRate: 10, repeat: -1
        });
        anims.create({
            key: "misa-front-walk", frames: anims.generateFrameNames("currentPlayer", { prefix: "misa-front-walk.", start: 0, end: 3, zeroPad: 3 }),
            frameRate: 10, repeat: -1
        });
        anims.create({
            key: "misa-back-walk", frames: anims.generateFrameNames("currentPlayer", { prefix: "misa-back-walk.", start: 0, end: 3, zeroPad: 3 }),
            frameRate: 10, repeat: -1
        });

        // Create online player animations
        anims.create({
            key: "onlinePlayer-left-walk", frames: anims.generateFrameNames("players", { start: 0, end: 3, zeroPad: 3, prefix: "bob_left_walk.", suffix: ".png" }),
            frameRate: 10, repeat: -1
        });
        anims.create({
            key: "onlinePlayer-right-walk", frames: anims.generateFrameNames("players", { start: 0, end: 3, zeroPad: 3, prefix: "bob_right_walk.", suffix: ".png" }),
            frameRate: 10, repeat: -1
        });
        anims.create({
            key: "onlinePlayer-front-walk", frames: anims.generateFrameNames("players", { start: 0, end: 3, zeroPad: 3, prefix: "bob_front_walk.", suffix: ".png" }),
            frameRate: 10, repeat: -1
        });
        anims.create({
            key: "onlinePlayer-back-walk", frames: anims.generateFrameNames("players", { start: 0, end: 3, zeroPad: 3, prefix: "bob_back_walk.", suffix: ".png" }),
            frameRate: 10, repeat: -1
        });
    }
}