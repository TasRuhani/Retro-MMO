import Phaser from "phaser";
import { Scene1 } from "./Scene1";
import { Scene2 } from "./Scene2";

const Config = {
    type: Phaser.AUTO,
    width: 2000,
    height: 1000,
    parent: "game-container",
    pixelArt: true,
    physics: {
        default: "arcade",
        arcade: {
            gravity: {y: 0}
        }
    },
    // This object is required to use HTML elements like the chat input
    dom: {
        createContainer: true
    },
    scene: [Scene1, Scene2],
};

export default new Phaser.Game(Config);