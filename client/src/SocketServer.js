import * as Colyseus from "colyseus.js";

/*================================================
| Determine if running locally or on production
*/
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Use relative URLs - works everywhere!
const BASE_URL = isLocalhost ? 'http://localhost' : window.location.origin;
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = isLocalhost ? 'ws://localhost:3000' : `${WS_PROTOCOL}//${window.location.host}`;

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
var client = new Colyseus.Client(WS_URL);
let room = null;

/*================================================
| Login function
*/
async function login(username) {
    try {
        const apiUrl = isLocalhost ? 'http://localhost:3000/api/login' : '/api/login';
        
        const response = await fetch(apiUrl, {
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
            const apiUrl = isLocalhost ? 'http://localhost:3000/api/logout' : '/api/logout';
            
            await fetch(apiUrl, {
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