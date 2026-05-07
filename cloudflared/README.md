This directory should contain your Cloudflare Tunnel credentials.

## Setup Steps

1. Install cloudflared locally:
   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

2. Login to Cloudflare:

   ```
   cloudflared tunnel login
   ```

3. Create a new tunnel:

   ```
   cloudflared tunnel create remindme
   ```

   This will output a Tunnel ID and create a credentials JSON file (usually in ~/.cloudflared/).

4. Copy the credentials file to this directory:

   ```
   cp ~/.cloudflared/<TUNNEL_ID>.json ./cloudflared/credentials.json
   ```

5. Update `config.yml`:
   - Replace `<YOUR_TUNNEL_ID>` with your actual Tunnel ID

6. Add a DNS record (one-time):
   ```
   cloudflared tunnel route dns remindme remindme.gentech.my.id
   ```

## Files Expected Here

- `config.yml` ← Tunnel routing config (already created)
- `credentials.json` ← Your tunnel credentials (DO NOT COMMIT!)
