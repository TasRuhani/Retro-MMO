import Phaser from "phaser";

export default class OnlinePlayer extends Phaser.GameObjects.Sprite {
    constructor(config) {
        super(config.scene, config.x, config.y, config.playerId);

        this.scene.add.existing(this);
        this.scene.physics.world.enableBody(this);
        this.scene.physics.add.collider(this, config.worldLayer);

        this.setTexture("players", "bob_front.png").setScale(1.9, 2.1);
        this.setDepth(5); // Set player depth

        this.map = config.map;
        console.log(`Map of ${config.playerId} is ${this.map}`);

        this.body.setOffset(0, 24);

        // Display playerId above player
        this.playerNickname = this.scene.add.text(this.x, this.y, config.playerId, {
            fontSize: '12px',
            color: '#ffffff',
            backgroundColor: '#00000080',
            padding: { x: 2, y: 1 }
        })
        .setOrigin(0.5, 1.5)
        .setDepth(20); // Set depth to be on top
    }

    isWalking(position, x, y) {
        this.anims.play(`onlinePlayer-${position}-walk`, true);
        this.setPosition(x, y);

        // Update nickname position
        this.playerNickname.x = this.x;
        this.playerNickname.y = this.y - (this.height / 2);
    }

    stopWalking(position) {
        this.anims.stop();
        this.setTexture("players", `bob_${position}.png`);
    }

    destroy() {
        // Make sure to destroy the nickname text object when the player sprite is destroyed
        if (this.playerNickname) {
            this.playerNickname.destroy();
        }
        super.destroy();
    }
}