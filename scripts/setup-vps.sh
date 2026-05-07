## Setup Script untuk VPS (Ubuntu/Debian)
## Jalankan ini sekali saja di server baru

set -e

echo "==> Installing Docker..."
apt-get update
apt-get install -y docker.io docker-compose-plugin git curl

echo "==> Adding current user to docker group..."
usermod -aG docker $USER

echo "==> Cloning the project..."
# Ganti dengan URL repo kamu
# git clone https://github.com/USERNAME/remindme.git /opt/remindme

echo ""
echo "==> Setup selesai!"
echo ""
echo "Langkah selanjutnya:"
echo "1. Clone repo ke /opt/remindme (atau path lain)"
echo "2. Salin .env.example ke backend/.env dan isi semua variabelnya"
echo "3. Setup Cloudflared tunnel (lihat cloudflared/README.md)"
echo "4. Salin credentials.json ke cloudflared/credentials.json"
echo "5. Update cloudflared/config.yml dengan Tunnel ID kamu"
echo "6. Jalankan: docker compose up -d"
echo ""
echo "Untuk GitHub Actions auto-deploy:"
echo "Tambahkan secrets berikut di repository Settings > Secrets:"
echo "  - SSH_PRIVATE_KEY : Private key untuk akses VPS"
echo "  - VPS_HOST        : IP atau hostname VPS"
echo "  - VPS_USER        : Username SSH (biasanya 'root' atau 'ubuntu')"
echo "  - VPS_PROJECT_PATH: Path ke folder project di VPS (contoh: /opt/remindme)"
