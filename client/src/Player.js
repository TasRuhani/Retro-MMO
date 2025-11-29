import Phaser from "phaser";
import { room, getSessionData } from './SocketServer';

export default class Player extends Phaser.GameObjects.Sprite {
    constructor(config) {
        super(config.scene, config.x, config.y, config.key);

        this.scene.add.existing(this);
        this.scene.physics.world.enableBody(this);
        this.scene.physics.add.collider(this, config.worldLayer);

        this.setTexture("currentPlayer", `misa-${this.scene.playerTexturePosition}`);

        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.spacebar = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        this.body.setOffset(0, 24);
        this.body.setCollideWorldBounds(true);
        this.setDepth(5);

        this.container = { oldPosition: { x: 0, y: 0, direction: null } };
        this.speed = 150;

        // ✅ NEW: Add a flag to prevent immediate map changing
        this.readyToChangeMap = false;
        this.scene.time.delayedCall(500, () => {
            this.readyToChangeMap = true; // Allow map changing after half a second
        });

        const sessionData = getSessionData();
        const displayName = sessionData.username || 'Me';
        this.playerNickname = this.scene.add.text(this.x, this.y, displayName, {
            fontSize: '12px',
            color: '#00ff00',
            backgroundColor: '#00000080',
            padding: { x: 2, y: 1 }
        })
        .setOrigin(0.5, 1.5)
        .setDepth(20);
    }
    
    update() {
        const prevVelocity = this.body.velocity.clone();
        this.body.setVelocity(0);

        let currentDirection = null;
        if (this.cursors.left.isDown) { this.body.setVelocityX(-this.speed); currentDirection = 'left'; } 
        else if (this.cursors.right.isDown) { this.body.setVelocityX(this.speed); currentDirection = 'right'; }

        if (this.cursors.up.isDown) { this.body.setVelocityY(-this.speed); currentDirection = 'back'; } 
        else if (this.cursors.down.isDown) { this.body.setVelocityY(this.speed); currentDirection = 'front'; }

        this.body.velocity.normalize().scale(this.speed);
        this.container.oldPosition.direction = currentDirection;

        if (currentDirection) {
            this.anims.play(`misa-${currentDirection}-walk`, true);
        } else {
            this.anims.stop();
            if (prevVelocity.x < 0) this.setTexture("currentPlayer", "misa-left");
            else if (prevVelocity.x > 0) this.setTexture("currentPlayer", "misa-right");
            else if (prevVelocity.y < 0) this.setTexture("currentPlayer", "misa-back");
            else if (prevVelocity.y > 0) this.setTexture("currentPlayer", "misa-front");
        }

        this.playerNickname.x = this.x;
        this.playerNickname.y = this.y - (this.height / 2);

    //     this.doorInteraction();
    //     this.worldInteraction();
    }

    isMoved() {
        if (this.container.oldPosition.x !== this.x || this.container.oldPosition.y !== this.y) {
            this.container.oldPosition.x = this.x;
            this.container.oldPosition.y = this.y;
            return true;
        }
        return false;
    }

    doorInteraction() {
        if (Phaser.Input.Keyboard.JustDown(this.spacebar)) {
             this.scene.map.findObject("Doors", obj => {
                const interactionRect = new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height);
                if (Phaser.Geom.Intersects.RectangleToRectangle(this.getBounds(), interactionRect)) {
                    console.log('Interacting with door: ' + obj.name);
                }
            });
        }
    }

    worldInteraction() {
        // ✅ NEW: Check if the player is ready to change maps
        if (!this.readyToChangeMap) {
            return;
        }

        this.scene.map.findObject("Worlds", world => {
            const worldRect = new Phaser.Geom.Rectangle(world.x, world.y, world.width, world.height);
            if (Phaser.Geom.Intersects.RectangleToRectangle(this.getBounds(), worldRect)) {
                this.readyToChangeMap = false; // Prevent this from firing multiple times
                console.log('Player is entering world: ' + world.name);
                let playerTexturePosition = 'front';
                if (world.properties) {
                    const prop = world.properties.find(p => p.name === 'playerTexturePosition');
                    if (prop) playerTexturePosition = prop.value;
                }
                room.then(r => r && r.send("PLAYER_CHANGED_MAP", { map: world.name }));
                this.scene.scene.restart({ map: world.name, playerTexturePosition });
            }
        });
    }
}