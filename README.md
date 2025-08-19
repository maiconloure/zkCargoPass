# zkCargoPass

A decentralized application (dApp) designed to optimize customs clearance at the Brazil using blockchain technology and zero-knowledge proofs to verify cargo documentation without exposing sensitive data.

## 🚢 Project Overview

zkCargoPass addresses the critical inefficiencies in port logistics where cargo remains stationary in containers for extended periods, leading to additional costs for individuals and businesses due to port space rental fees. Our solution employs a secure, private, and efficient approach using cutting-edge cryptographic technologies.

## 🎯 Problem Statement

Currently, cargo clearance processes suffer from:
- **Long waiting times** for document verification
- **High storage costs** at port facilities
- **Security risks** with sensitive data exposure
- **Manual processes** prone to errors and delays
- **Lack of transparency** in the clearance pipeline

zkCargoPass solves these issues by providing instant, private document verification while maintaining regulatory compliance.

## 🛠 Technology Stack

### Backend
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Session Management**: Redis
- **Authentication**: JWT with Passport.js
- **ZK Proofs**: Noir language with Aztec's BB.js
- **API Documentation**: Swagger/OpenAPI

### Frontend
- **Framework**: Next.js 14+ (React)
- **UI Library**: Radix UI with Tailwind CSS
- **State Management**: React Hooks
- **Web3 Integration**: Polkadot extension support
- **Type Safety**: TypeScript
- **Package Manager**: pnpm

### Zero-Knowledge Circuits
- **Language**: Noir
- **Circuit Types**:
  - Cargo validation
  - Date validation  
  - Tax validation
- **Proof System**: Ultra PLONK

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 14
- **Cache**: Redis Alpine
- **Reverse Proxy**: Nginx (production)

## 📁 Project Structure

```
zkCargoPass/
├── backend/                 # NestJS API server
│   ├── circuits/           # ZK circuits (Noir)
│   ├── src/
│   │   ├── controllers/    # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── entities/       # Database models
│   │   └── middlewares/    # Custom middleware
│   └── prisma/            # Database schema & migrations
├── frontend/               # Next.js web application
│   ├── app/               # Next.js 13+ app directory
│   ├── components/        # Reusable UI components
│   ├── circuits/          # Client-side ZK circuits
│   └── lib/              # Utility functions
└── docker-compose.yml     # Development environment
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 22.0.0
- **Docker** and **Docker Compose**
- **pnpm** (for frontend)
- **Noir** toolchain (for ZK circuits)

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/maiconloure/zkCargoPass.git
   cd zkCargoPass
   ```

2. **Start infrastructure services**
   ```bash
   docker-compose up -d postgres redis
   ```

3. **Setup Backend**
   ```bash
   cd backend
   npm install
   
   # Setup database
   npm run prisma:migrate
   npm run prisma:seed
   
   # Start development server
   npm run dev
   ```

4. **Setup Frontend**
   ```bash
   cd frontend
   pnpm install
   
   # Start development server
   pnpm dev
   ```

5. **Compile ZK Circuits** (Optional)
   ```bash
   # Install Noir if not already installed
   curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
   
   # Compile circuits
   cd backend/circuits/cargo_validation
   nargo compile
   
   cd ../date_validation
   nargo compile
   
   cd ../tax_validation  
   nargo compile
   ```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs
- **Database**: localhost:5432 (postgres/postgres)
- **Redis**: localhost:6379

## 🔐 Zero-Knowledge Proofs

The application implements three main ZK circuits:

### 1. Cargo Validation Circuit
Validates cargo information without revealing:
- Exact cargo values
- Detailed descriptions
- Proprietary shipping data

### 2. Date Validation Circuit  
Proves temporal constraints like:
- Document submission deadlines
- Clearance timeframes
- Compliance windows

### 3. Tax Validation Circuit
Verifies tax calculations while keeping private:
- Exact tax amounts
- Financial details
- Commercial agreements

## 📊 Database Schema

The application uses PostgreSQL with the following main entities:

- **Users**: Customs officers, importers, and system administrators
- **Documents**: Import declarations and related paperwork
- **Sessions**: User authentication and authorization
- **Audit Logs**: Verification history and compliance records

## 🔧 Development

### Available Scripts

**Backend:**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run prisma:studio # Database GUI
```

**Frontend:**
```bash
pnpm dev            # Start development server
pnpm build          # Build for production
pnpm start          # Start production server
pnpm lint           # Run linter
```

### Environment Variables

Create `.env` files in both backend and frontend directories:

**Backend (.env):**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zk_cargo_pass"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-jwt-secret"
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## 🚢 Production Deployment

1. **Build all services**
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. **Deploy with environment-specific configurations**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Run database migrations**
   ```bash
   docker-compose exec backend npm run prisma:migrate
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Diego Bastos** - Business
- **Maicon Lourenço** - Development

## 🙏 Acknowledgments

- Port of Santos for logistics insights
- Aztec for Zero-Knowledge infrastructure
- The Noir community for cryptographic primitives

---

**zkCargoPass** - Revolutionizing cargo clearance through privacy-preserving technology 🚀
