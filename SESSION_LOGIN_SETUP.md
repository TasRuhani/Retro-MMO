# Session-Based Login Implementation - Setup Guide

## Changes Summary

All changes have been implemented to add session-based login to your Retro MMO game. Here's what was added:

### Server-Side Changes

1. **database.js** (NEW)
   - PostgreSQL connection pool setup
   - User database operations (login, logout, heartbeat updates)
   - Session timeout and cleanup logic
   - Automatic stale session cleanup on server startup

2. **server.js** (MODIFIED)
   - Added `POST /api/login` endpoint for user authentication
   - Added `POST /api/logout` endpoint for session cleanup
   - Database initialization on server startup
   - Automatic cleanup of stale sessions

3. **rooms/PokeWorld.js** (MODIFIED)
   - Updated `onJoin()` to accept and store username
   - Updated `onLeave()` to mark user as offline in database
   - Added heartbeat handler to update `last_seen_at` timestamp
   - Modified chat handler to send username with messages

### Client-Side Changes

1. **index.html** (MODIFIED)
   - Added login screen UI with username input
   - Added logout button (appears after login)
   - Styled login form with green theme matching your game

2. **src/SocketServer.js** (MODIFIED)
   - Refactored to connect ONLY after successful login
   - Added `login()` function that authenticates with server
   - Added `logout()` function for clean disconnection
   - Added session data management
   - Removed auto-connect on import

3. **src/index.js** (MODIFIED)
   - Game initialization moved to after successful login
   - Added login form event handler
   - Added logout button event handler
   - Added beforeunload handler for cleanup

4. **src/Scene2.js** (MODIFIED)
   - Added heartbeat interval (30 seconds)
   - Updated to pass username to OnlinePlayer instances
   - Updated chat display to show usernames
   - Added heartbeat cleanup on scene shutdown

5. **src/Player.js** (MODIFIED)
   - Changed nickname display from "Me" to actual username

6. **src/OnlinePlayer.js** (MODIFIED)
   - Changed nickname display from session ID to username

## Setup Instructions

### 1. Database Setup

#### Create PostgreSQL Database on AWS RDS

1. Go to AWS RDS Console
2. Create a new PostgreSQL instance
3. Note down the endpoint, username, password, and database name
4. Make sure to allow inbound connections from your server's IP in the security group

#### Configure Environment Variables

1. Copy `.env.example` to `.env` in the server folder:
   ```bash
   cd server
   cp .env.example .env
   ```

2. Edit `.env` and update with your AWS RDS credentials:
   ```env
   DATABASE_URL=postgresql://your_username:your_password@your-rds-endpoint.region.rds.amazonaws.com:5432/your_database_name
   SESSION_TIMEOUT_MS=120000
   HEARTBEAT_INTERVAL_MS=30000
   PORT=3000
   NODE_ENV=development
   ```

### 2. Install Dependencies

The required packages (`pg` and `dotenv`) have already been installed. If you need to reinstall:

```bash
cd server
npm install pg dotenv
```

### 3. Start the Server

```bash
cd server
npm start
```

The server will automatically:
- Connect to PostgreSQL
- Create the `users` table if it doesn't exist
- Create indexes for performance
- Clean up any stale sessions from previous crashes

### 4. Start the Client

```bash
cd client
npm start
```

### 5. Test the Application

1. Open your browser to the client URL (usually `http://localhost:8080`)
2. You should see a login screen
3. Enter a username (max 50 characters)
4. Click "Enter Game"
5. If successful, you'll be taken to the game

## Database Schema

The `users` table structure:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    session_id VARCHAR(100),
    is_online BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_id ON users(session_id);
CREATE INDEX idx_is_online ON users(is_online);
```

## How It Works

### Login Flow

1. User enters username on login page
2. Client sends POST request to `/api/login`
3. Server checks if username exists:
   - **New user**: Creates new record, sets `is_online = true`
   - **Existing user (offline)**: Updates session, sets `is_online = true`
   - **Existing user (online)**: Checks if session is stale (> 2 minutes)
     - If stale: Allows takeover
     - If active: Rejects login with error
4. On success, client connects to Colyseus room with username
5. Game starts

### During Gameplay

1. Client sends heartbeat every 30 seconds
2. Server updates `last_seen_at` timestamp in database
3. Username is displayed above player sprites
4. Chat messages show username instead of session ID

### Logout Flow

1. User clicks logout button OR closes browser tab
2. Client sends POST request to `/api/logout`
3. Client disconnects from Colyseus room
4. Server's `onLeave()` marks user as offline in database
5. Page reloads to login screen

### Session Recovery

- If server crashes, on restart it cleans up stale sessions (where `last_seen_at` > timeout)
- If browser crashes without logout, session expires after 2 minutes of inactivity
- Another user can take over the name after timeout

## Features Implemented

✅ Session-based login (no passwords)
✅ Unique username requirement
✅ Session timeout handling (2 minutes)
✅ Heartbeat system (30 second intervals)
✅ Database persistence
✅ Clean logout functionality
✅ Stale session cleanup
✅ Username display in game
✅ Username display in chat
✅ Logout button
✅ Tab close handling (best effort)

## Testing Scenarios

1. **Normal Login**: Enter username, should enter game successfully
2. **Duplicate Username (Offline)**: Use same name as offline user, should work
3. **Duplicate Username (Online)**: Use same name as online user, should show error
4. **Logout Button**: Click logout, should return to login screen
5. **Session Timeout**: Login, wait 3+ minutes without interaction, try to login with same name from another browser
6. **Server Restart**: Restart server while users are connected, all should be marked offline

## Troubleshooting

### "User is already online" error
- The username is currently in use
- Wait 2 minutes for session timeout
- Or check database: `SELECT * FROM users WHERE name = 'username';`

### Can't connect to database
- Check `.env` file has correct credentials
- Verify AWS RDS security group allows your IP
- Test connection: `psql $DATABASE_URL`

### Players show session IDs instead of usernames
- Check that username is being passed in `onJoin()` options
- Verify database is storing username correctly
- Check browser console for errors

## Next Steps (Optional Enhancements)

These were NOT implemented to keep things simple, but you can add later:

- Password/authentication system
- Email verification
- User profiles with stats
- Multiple characters per account
- Friend lists
- Persistent player positions
- Admin tools for managing users
- Rate limiting on login attempts
