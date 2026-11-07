# Legacy UI demo companion

Run `npm run dev:demo` from frontend to view the inherited UI with in-memory Express data at http://127.0.0.1:3000. It embeds Vite in development only. Restart resets server data; some client mocks persist in localStorage.

Not a production API, JWT session, security monitor, AI result, or supported mobile/Wave/LPN/Serial workflow. Gemini access is disabled in F0, even if the shell has a key. No backend connection. Production `npm run build` excludes this server.
