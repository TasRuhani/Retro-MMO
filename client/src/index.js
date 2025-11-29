import Phaser from "phaser";
import { Scene1 } from "./Scene1";
import { Scene2 } from "./Scene2";
import { login, logout } from "./SocketServer";

let game = null;

// Handle login form submission
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const usernameInput = document.getElementById('username-input');
    const loginButton = document.getElementById('login-button');
    const errorMessage = document.getElementById('error-message');
    const username = usernameInput.value.trim();

    if (!username) {
        errorMessage.textContent = 'Please enter a username';
        return;
    }

    // Disable form during login
    loginButton.disabled = true;
    errorMessage.textContent = '';

    // Attempt login
    const result = await login(username);

    if (result.success) {
        // Hide login screen
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('logout-button').classList.remove('hidden');

        // Start the game
        if (!game) {
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

            game = new Phaser.Game(Config);
        }
    } else {
        // Show error message
        errorMessage.textContent = result.error || 'Login failed';
        loginButton.disabled = false;
    }
});

// Handle logout button
document.getElementById('logout-button').addEventListener('click', async () => {
    await logout();
    
    // Reload page to reset everything
    window.location.reload();
});

// Handle window close/refresh
window.addEventListener('beforeunload', async (e) => {
    if (game) {
        await logout();
    }
});