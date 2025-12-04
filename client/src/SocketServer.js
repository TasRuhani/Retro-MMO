import * as Colyseus from "colyseus.js";

// For production, you'll replace this with your EC2 IP during build
const SERVER_IP = '54.252.183.151'; // Change this to your EC2 IP before building

/*================================================
| Array with current online players
*/
let onlinePlayers = [];

/*================================================
| Session and authentication state
*/
let sessionData = {
    sessionId: null,
    username: null,
    isLoggedIn: false
};

/*================================================
| Colyseus connection with server
*/
var client = new Colyseus.Client(`ws://${SERVER_IP}:3000`);
let room = null;

/*================================================
| Login function
*/
async function login(username) {
    try {
        const response = await fetch(`http://${SERVER_IP}:3000/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: username })
        });

        const data = await response.json();

        if (data.success) {
            sessionData.sessionId = data.sessionId;
            sessionData.username = data.username;
            sessionData.isLoggedIn = true;

            // Connect to game room with username
            room = await client.joinOrCreate("poke_world", { 
                username: data.username,
                sessionId: data.sessionId 
            });
            
            console.log(room.sessionId, "joined", room.name, "as", data.username);
            return { success: true, data };
        } else {
            return { success: false, error: data.error };
        }
    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: 'Failed to connect to server' };
    }
}

/*================================================
| Logout function
*/
async function logout() {
    try {
        if (sessionData.sessionId) {
            await fetch(`http://${SERVER_IP}:3000/api/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId: sessionData.sessionId })
            });
        }

        if (room) {
            await room.leave();
        }

        sessionData.sessionId = null;
        sessionData.username = null;
        sessionData.isLoggedIn = false;
        room = null;
        onlinePlayers = [];

    } catch (error) {
        console.error("Logout error:", error);
    }
}

/*================================================
| Get current session data
*/
function getSessionData() {
    return { ...sessionData };
}

export { onlinePlayers, room, login, logout, getSessionData };