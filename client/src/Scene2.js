import Phaser from "phaser";
import { onlinePlayers, room } from "./SocketServer";
import OnlinePlayer from "./OnlinePlayer";
import Player from "./Player";

let cursors;
const CHAT_TRIGGER_RADIUS = 40; // Distance in pixels to trigger chat UI

export class Scene2 extends Phaser.Scene {
  constructor() {
    super("playGame");
    this.socketKey = false;
    this.inputBlocked = false;
    this.chatBubbles = new Map();
    this.inChatRange = false;
    this.room = null;
  }

  init(data) {
    this.mapName = data.map;
    this.playerTexturePosition = data.playerTexturePosition;
  }

  create() {
    this.events.on("shutdown", () => {
      // Clear heartbeat interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      if (this.room) {
        this.room.removeAllListeners();
        console.log("Room listeners removed.");
      }
      for (const id in onlinePlayers) {
        if (onlinePlayers[id] && onlinePlayers[id].destroy) {
          onlinePlayers[id].destroy();
        }
      }
      Object.keys(onlinePlayers).forEach((key) => delete onlinePlayers[key]);
      console.log("Online players cleared for scene restart.");
    });

    this.chatContainer = this.add
      .dom(this.cameras.main.width / 2, this.cameras.main.height - 100)
      .createFromHTML(
        `
                <div id="chat-container" style="display: block; width: 200px; position: fixed; left: 0px; bottom: 0;">

  <div id="chat-log" style="width: 100%; height: 120px; background-color: rgba(0,0,0,0.6); color: white; padding: 10px; overflow-y: scroll; border: 1px solid #555; border-bottom: none; font-family: monospace; box-sizing: border-box;">
  </div>

  <input type="text" id="chat-input" placeholder="Type..." maxlength="100" style="width: 100%; padding: 10px; border: 1px solid #555; box-sizing: border-box;">

</div>
            `
      )
      .setScrollFactor(0);

    const inputElement = this.chatContainer.getChildByID("chat-input");

    inputElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const message = inputElement.value;
        if (message && room) {
          room.send("chat", message);
          inputElement.value = "";
        }
      }
    });

    if (!room) {
      console.error("Could not connect to room! Skipping message listeners.");
      return;
    }

    this.room = room;

    // Start heartbeat to update last_seen_at
    this.heartbeatInterval = setInterval(() => {
      if (this.room && this.room.connection.isOpen) {
        this.room.send("heartbeat");
      }
    }, 30000); // Every 30 seconds

    room.onMessage("show_chat_bubble", (data) =>
      this.displayChatMessage(data.senderId, data.message, data.username)
    );
    room.onMessage("CURRENT_PLAYERS", (data) => {
      Object.keys(data.players).forEach((playerId) => {
        let player = data.players[playerId];
        if (playerId !== room.sessionId && !onlinePlayers[player.sessionId]) {
          onlinePlayers[player.sessionId] = new OnlinePlayer({
            scene: this,
            worldLayer: this.worldLayer,
            playerId: player.sessionId,
            username: player.username,
            map: player.map,
            x: player.x,
            y: player.y,
          });
        }
      });
    });
    room.onMessage("PLAYER_JOINED", (data) => {
      if (
        data.sessionId &&
        data.sessionId !== room.sessionId &&
        !onlinePlayers[data.sessionId]
      ) {
        onlinePlayers[data.sessionId] = new OnlinePlayer({
          scene: this,
          worldLayer: this.worldLayer,
          playerId: data.sessionId,
          username: data.username,
          map: data.map,
          x: data.x,
          y: data.y,
        });
      }
    });
    room.onMessage("PLAYER_LEFT", (data) => {
      if (data.sessionId && onlinePlayers[data.sessionId]) {
        onlinePlayers[data.sessionId].destroy();
        delete onlinePlayers[data.sessionId];
      }
    });
    room.onMessage("PLAYER_MOVED", (data) => {
      if (onlinePlayers[data.sessionId] && this.mapName === data.map) {
        onlinePlayers[data.sessionId].isWalking(data.position, data.x, data.y);
      }
    });
    room.onMessage("PLAYER_MOVEMENT_ENDED", (data) => {
      if (onlinePlayers[data.sessionId] && this.mapName === data.map) {
        onlinePlayers[data.sessionId].stopWalking(data.position);
      }
    });
    room.onMessage("PLAYER_CHANGED_MAP", (data) => {
      if (
        data.sessionId &&
        onlinePlayers[data.sessionId] &&
        data.map !== this.mapName
      ) {
        onlinePlayers[data.sessionId].destroy();
        delete onlinePlayers[data.sessionId];
      }
    });
    room.send("GET_PLAYERS");

    this.map = this.make.tilemap({ key: this.mapName });
    const tileset = this.map.addTilesetImage("op-jec", "TilesTown");
    this.physics.world.setBounds(
      0,
      0,
      this.map.widthInPixels,
      this.map.heightInPixels
    );
    this.belowLayer = this.map.createLayer("Below Player", tileset, 0, 0);
    this.worldLayer = this.map.createLayer("World", tileset, 0, 0);
    this.belowLayer = this.map.createLayer("Between", tileset, 0, 0);
    this.aboveLayer = this.map.createLayer("Above Player", tileset, 0, 0);
    this.worldLayer.setCollisionByProperty({ collides: true });
    this.aboveLayer.setDepth(10);
    const spawnPoint = this.map.findObject(
      "SpawnPoints",
      (obj) => obj.name === "Spawn Point"
    );
    this.player = new Player({
      scene: this,
      worldLayer: this.worldLayer,
      key: "player",
      x: spawnPoint.x,
      y: spawnPoint.y,
    });
    const camera = this.cameras.main;
    camera.startFollow(this.player);
    camera.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    camera.zoom = 1.5;
    cursors = this.input.keyboard.createCursorKeys();
    this.createMobileDPad();
    this.debugGraphics();
    this.movementTimer();
  }

  
  createMobileDPad() {
    this.dpadContainer = this.add
      .dom(100, this.cameras.main.height - 120)
      .createFromHTML(
        `
            <div id="dpad" style="width:160px; height:160px; position:relative; touch-action:none; -webkit-tap-highlight-color: transparent;">
                <div id="dpad-up"    style="position:absolute; left:40px; top:0px; width:80px; height:50px; border-radius:8px; opacity:0.5;"></div>
                <div id="dpad-left"  style="position:absolute; left:0px; top:40px; width:50px; height:80px; border-radius:8px; opacity:0.5;"></div>
                <div id="dpad-right" style="position:absolute; right:0px; top:40px; width:50px; height:80px; border-radius:8px; opacity:0.5;"></div>
                <div id="dpad-down"  style="position:absolute; left:40px; bottom:0px; width:80px; height:50px; border-radius:8px; opacity:0.5;"></div>
            </div>
        `
      )
      .setScrollFactor(0)
      .setOrigin(0, 0);

    // references
    const dpadEl = this.dpadContainer.getChildByID("dpad");
    const up = this.dpadContainer.getChildByID("dpad-up");
    const left = this.dpadContainer.getChildByID("dpad-left");
    const right = this.dpadContainer.getChildByID("dpad-right");
    const down = this.dpadContainer.getChildByID("dpad-down");

    // initialize state
    this.mobileMoveActive = false;
    this.mobileDirection = null;

    const startDir = (dir) => {
      this.mobileMoveActive = true;
      this.mobileDirection = dir;
      if (dirElMap[dir]) dirElMap[dir].style.opacity = "0.9";
    };
    const stopMove = (dir) => {
      this.mobileMoveActive = false;
      this.mobileDirection = null;
      Object.values(dirElMap).forEach((el) => (el.style.opacity = "0.5"));
    };

    
    const dirElMap = { up, left, right, down };

    
    dpadEl.addEventListener("touchstart", (e) => e.preventDefault(), {
      passive: false,
    });

    
    [
      { el: up, dir: "up" },
      { el: left, dir: "left" },
      { el: right, dir: "right" },
      { el: down, dir: "down" },
    ].forEach((item) => {
      item.el.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        startDir(item.dir);
      });
      item.el.addEventListener("pointerup", (ev) => {
        ev.preventDefault();
        stopMove(item.dir);
      });
      item.el.addEventListener("pointerout", (ev) => {
        ev.preventDefault();
        stopMove(item.dir);
      });
      
      item.el.addEventListener(
        "touchend",
        (ev) => {
          ev.preventDefault();
          stopMove(item.dir);
        },
        { passive: false }
      );
      item.el.addEventListener(
        "touchcancel",
        (ev) => {
          ev.preventDefault();
          stopMove(item.dir);
        },
        { passive: false }
      );
    });

    // Hide dpad when chat input active 
    this.events.on("shutdown", () => {
      if (this.dpadContainer) this.dpadContainer.destroy();
    });
  }

  update(time, delta) {
    if (!this.player || !this.player.body) return;

    this.checkChatProximity();

    
    this.player.update(time, delta);

    
    if (!this.inputBlocked) {
      let playerMoved = this.player.isMoved();
      let position = this.player.container.oldPosition.direction;

      if (playerMoved && this.socketKey && position && room) {
        room.send("PLAYER_MOVED", {
          position,
          x: this.player.x,
          y: this.player.y,
        });
        this.socketKey = false;
      }

      if (room) {
        if (Phaser.Input.Keyboard.JustUp(cursors.left))
          room.send("PLAYER_MOVEMENT_ENDED", { position: "left" });
        else if (Phaser.Input.Keyboard.JustUp(cursors.right))
          room.send("PLAYER_MOVEMENT_ENDED", { position: "right" });
        else if (Phaser.Input.Keyboard.JustUp(cursors.up))
          room.send("PLAYER_MOVEMENT_ENDED", { position: "back" });
        else if (Phaser.Input.Keyboard.JustUp(cursors.down))
          room.send("PLAYER_MOVEMENT_ENDED", { position: "front" });
      }
    }

    this.chatBubbles.forEach((bubbleInfo, sessionId) => {
      if (!this.room) return;
      let targetSprite =
        sessionId === this.room.sessionId
          ? this.player
          : onlinePlayers[sessionId];
      if (targetSprite && targetSprite.body) {
        bubbleInfo.bubble.x = targetSprite.x;
        bubbleInfo.bubble.y = targetSprite.y - targetSprite.height + 5;
      }
    });
  }

  checkChatProximity() {
    let isNearPlayer = false;
    if (Object.keys(onlinePlayers).length === 0) {
      if (this.inChatRange) this.toggleChatUI(false); // Close chat if last player leaves
      return;
    }

    for (const id in onlinePlayers) {
      const onlinePlayer = onlinePlayers[id];
      if (onlinePlayer && onlinePlayer.body) {
        const distance = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          onlinePlayer.x,
          onlinePlayer.y
        );
        if (distance < CHAT_TRIGGER_RADIUS) {
          isNearPlayer = true;
          break;
        }
      }
    }

    if (isNearPlayer !== this.inChatRange) {
      this.toggleChatUI(isNearPlayer);
    }
  }

  toggleChatUI(show) {
    const chatContainer = this.chatContainer.getChildByID("chat-container");
    const inputElement = this.chatContainer.getChildByID("chat-input");
    this.inChatRange = show;
    this.inputBlocked = show;

    if (this.dpadContainer) this.dpadContainer.node.style.display = show ? 'none' : 'block';


    if (show) {
      chatContainer.style.display = "block";
      inputElement.focus();
      // Disable Phaser's keyboard capture so you can type spaces, etc.
      this.input.keyboard.disableGlobalCapture();
    } else {
      chatContainer.style.display = "none";
      // Re-enable Phaser's keyboard capture for game controls
      this.input.keyboard.enableGlobalCapture();
    }
  }

  displayChatMessage(senderId, message, username) {
    if (!this.room) return;
    let targetSprite =
      senderId === this.room.sessionId ? this.player : onlinePlayers[senderId];
    if (!targetSprite) return;

    if (this.chatBubbles.has(senderId)) {
      const existing = this.chatBubbles.get(senderId);
      existing.bubble.destroy();
      existing.timer.remove();
    }
    const bubble = this.add
      .text(0, 0, message, {
        fontSize: "12px",
        color: "#000000",
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        padding: { x: 8, y: 4 },
        wordWrap: { width: 150 },
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
    const timer = this.time.delayedCall(4000, () => {
      if (bubble) bubble.destroy();
      this.chatBubbles.delete(senderId);
    });
    this.chatBubbles.set(senderId, { bubble, timer });

    const chatLog = document.getElementById("chat-log");
    if (chatLog) {
      const messageElement = document.createElement("p");
      const displayName = username || senderId.substring(0, 6);
      messageElement.innerHTML = `<strong>${displayName}:</strong> ${message}`;
      messageElement.style.margin = "0 0 5px 0";
      chatLog.appendChild(messageElement);
      chatLog.scrollTop = chatLog.scrollHeight;
    }
  }

  movementTimer() {
    setInterval(() => {
      this.socketKey = true;
    }, 50);
  }
  debugGraphics() {
    this.input.keyboard.once("keydown_D", () => {
      this.physics.world.createDebugGraphic();
    });
  }
}
