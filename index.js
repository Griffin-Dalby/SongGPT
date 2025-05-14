/*

    SongGPT Index File

    Griffin E. Dalby
    5/11/25

    This application will provide the user with new song choices based off
    of their taste / playlist, and allow them to choose songs to add!

*/

// Requires
const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const querystring = require('querystring');
const colors = require('colors');
const fs = require('fs');
require('dotenv').config()

// Settings
const port = 3000
const scopes = [
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-library-read',
    'user-top-read',
    'user-read-private',
    'user-read-email'
].join(' ')

// Constants
// Variables
// Functions
// Create App
const app = express()
app.use(express.static('public'))
app.set('view engine', 'ejs');

app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }));


// Authentication endpoints
app.get('/', (req, res) => {
    const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
        client_id: process.env.SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
        scope: scopes
    }).toString();

    res.send(`<a href="${authUrl}">Log in with Spotify</a>`)
})

app.get('/callback', async (req, res) => {
    const code = req.query.code;

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token',
            querystring.stringify({
              grant_type: 'authorization_code',
              code,
              redirect_uri: process.env.SPOTIFY_REDIRECT_URI
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
              }
            }
        );
    
        const { access_token, refresh_token } = response.data;
        
        res.cookie('spotify_access_token', access_token, {
            httpOnly: true,
            maxAge: 3600000,
            sameSite: 'lax',
            path: '/'
            // secure: true,
        });

        res.cookie('spotify_refresh_token', refresh_token, {
            httpOnly: true,
            maxAge: 604800000,
            sameSite: 'lax',
            path: '/'
            // secure: true,
        });
        
        res.redirect('/dashboard')
    } catch (err) {
        console.error(`${colors.green(colors.bgRed('[Server]'))} An issue occured gathering tokens from Spotify!`)
        console.error(`${colors.green(colors.bgRed('[Server]'))} ${err}`)

        res.status(500).send('Authentication failed!')
    }
})

// Visual endpoints
app.get('/dashboard', async (req, res) => {
    try {
        
        const access_token = req.cookies.spotify_access_token
        if (!access_token) { return res.status(401).send('Please try logging in again, your token is missing.') }

        const meResponse = await axios.get('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${access_token}` } })

        const myPlaylists = await axios.get('https://api.spotify.com/v1/me/playlists', {
            params: { limit: 10 },
            headers: { 'Authorization': `Bearer ${access_token}` } })

        const user = {
            name: meResponse.data.display_name,
            photo: meResponse.data.images[0].url,
        }

        const playlists = {
            items: myPlaylists.data.items,
            previousList: myPlaylists.data.previous,
            nextList: myPlaylists.data.next
        }
    
        res.render('dashboard', { user, playlists });
    } catch (err) {
        console.error(`${colors.green(colors.bgRed('[Server]'))} Issue fetching user data from spotify!`)
        console.error(`${colors.green(colors.bgRed('[Server]'))} ${err}`)

        res.status(500).send('Dashboard loading failed!')
    }
})

// Finalize
app.listen(port, () => {
    console.log(`${colors.green('[Server]')} Started on localhost:${port}!`);
});