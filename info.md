# 1. Clone all repositories
git clone https://github.com/skypay/frontend-web
git clone https://github.com/skypay/frontend-mobile
git clone https://github.com/skypay/backend-api
git clone https://github.com/skypay/websocket-server
git clone https://github.com/skypay/smart-contracts

# 2. Set up infrastructure
docker-compose -f infrastructure/docker-compose.prod.yml up -d

# 3. Deploy smart contracts
cd smart-contracts
npx hardhat deploy --network polygon
npx hardhat deploy --network ethereum

# 4. Deploy backend
cd backend-api
npm run build
npm start

# 5. Deploy frontend
cd frontend-web
npm run build
npm start

# 6. Build mobile app
cd frontend-mobile
npm run build:ios
npm run build:android



.env

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=skypay
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secure_password

# Blockchain
POLYGON_RPC_URL=https://polygon-rpc.com
ETHEREUM_RPC_URL=https://eth.llamarpc.com
PRIVATE_KEY=your_wallet_private_key

# Compliance APIs
SUMSUB_API_KEY=your_sumsub_key
CHAINALYSIS_API_KEY=your_chainalysis_key
ELLIPTIC_API_KEY=your_elliptic_key

# Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
EXPO_ACCESS_TOKEN=your_expo_token

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRY=24h
