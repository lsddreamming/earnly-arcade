# Render deployment

The repository-root `render.yaml` builds the existing Node 24 Docker image. It
uses port 10000, `/health`, exact website origins and deploys `main` only after
its checks pass. The website continues to run on GitHub Pages.

The Blueprint's Free instance is for deployment verification. Render advises
against using Free instances for production, and idle services spin down. Before
opening public multiplayer, select an always-on paid instance in the confirmed
workspace. Keep exactly one instance: room presence is held in one worker.

During Blueprint creation, provide `SUPABASE_SERVICE_ROLE_KEY` through Render's
private environment field. Do not paste it into chat, GitHub, source files or
frontend configuration. `SUPABASE_URL` points to the existing production project;
use that project's matching server key. For staging, replace both values together.
The World migrations are already applied to the existing staging and production
projects. No additional database or storage service is needed.

After the deployment is live, verify HTTPS `/health`, authenticated WSS admission,
two-account room/chat/trade behavior, reconnects and persistence after restart.
Assign a moderator to handle the report queue before opening public chat. Only
then set the public `world-config.js` endpoint to `wss://<service-host>/world` and
publish through the normal reviewed checks. A successful health response alone
does not prove the database credentials or purchase delivery work.

References: [Blueprint configuration](https://render.com/docs/blueprint-spec),
[WebSockets](https://render.com/docs/websocket),
[Free instance limits](https://render.com/docs/free).
