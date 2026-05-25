# WorldClass Phase 1: Foundation & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js + PostgreSQL + Prismaで基盤を構築し、3種類のユーザー（日本校・海外校・管理者）の認証とDBスキーマを完成させる。

**Architecture:** Next.js 14 App Routerをモノリスで構築。認証はNextAuth.jsで3ロール管理。DBはPrisma + PostgreSQLで全テーブルを定義。

**Tech Stack:** Next.js 14, TypeScript, Prisma, PostgreSQL, NextAuth.js, Tailwind CSS, Resend, Stripe（後フェーズで使用）

---

## ファイル構成

```
worldclass/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/
│   │       ├── school/page.tsx      # 日本校登録
│   │       └── partner/page.tsx     # 海外校登録
│   ├── (dashboard)/
│   │   ├── school/page.tsx          # 日本校ダッシュボード
│   │   ├── partner/page.tsx         # 海外校ダッシュボード
│   │   └── admin/page.tsx           # 管理者ダッシュボード
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── schools/route.ts
│   │   └── partners/route.ts
│   └── layout.tsx
├── lib/
│   ├── auth.ts                      # NextAuth設定
│   ├── db.ts                        # Prismaクライアント
│   └── validations/
│       ├── school.ts
│       └── partner.ts
├── prisma/
│   └── schema.prisma
├── middleware.ts                    # ルート保護
└── types/
    └── next-auth.d.ts              # セッション型拡張
```

---

## Task 1: プロジェクトセットアップ

**Files:**
- Create: `package.json`, `tsconfig.json`, `.env.local`

- [ ] **Step 1: Next.jsプロジェクト作成**

```bash
npx create-next-app@latest worldclass \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd worldclass
```

- [ ] **Step 2: 依存パッケージインストール**

```bash
npm install \
  @prisma/client \
  next-auth \
  @auth/prisma-adapter \
  bcryptjs \
  zod \
  resend

npm install -D \
  prisma \
  @types/bcryptjs
```

- [ ] **Step 3: `.env.local` 作成**

```bash
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://postgres:password@localhost:5432/worldclass"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here-run-openssl-rand-base64-32"
RESEND_API_KEY="re_xxxx"
EOF
```

- [ ] **Step 4: 動作確認**

```bash
npm run dev
```

Expected: `http://localhost:3000` でNext.jsデフォルト画面が表示される

- [ ] **Step 5: コミット**

```bash
git add .
git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: DBスキーマ定義

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Prisma初期化**

```bash
npx prisma init
```

- [ ] **Step 2: `prisma/schema.prisma` を以下に書き換え**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SCHOOL    // 日本校
  PARTNER   // 海外パートナー校
  ADMIN     // 運営
}

enum PartnerStatus {
  PENDING   // 審査中
  APPROVED  // 承認済み・カタログ掲載
  SUSPENDED // 停止中
  REJECTED  // 不承認
}

enum SessionStatus {
  PENDING           // 予約確定待ち
  CONFIRMED         // 予約確定
  CHECKLIST_SENT    // 質問リスト送信済み
  READY             // 準備完了チェック済み
  COMPLETED         // 実施完了
  CANCELLED         // キャンセル
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String
  role          Role
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  school        School?
  partner       Partner?
}

model School {
  id            String    @id @default(cuid())
  userId        String    @unique
  user          User      @relation(fields: [userId], references: [id])

  name          String                // 学校名
  type          String                // 学校・公民館・図書館等
  prefecture    String                // 都道府県
  contactName   String                // 担当者名
  gradeRange    String                // 対象学年（例: "小4-小6"）

  sessions      Session[]
  coupons       Coupon[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Partner {
  id            String        @id @default(cuid())
  userId        String        @unique
  user          User          @relation(fields: [userId], references: [id])

  schoolName    String                // 学校名
  country       String                // 国
  region        String                // 地域
  contactName   String                // 担当教師名
  videoUrl      String?               // 自己紹介VTR URL
  status        PartnerStatus @default(PENDING)
  ratingScore   Float         @default(0)    // 評価スコア（★平均）
  penaltyCount  Int           @default(0)    // ペナルティカウント
  
  supportPool   Int           @default(0)    // 物資支援プール（円）

  themes        String[]                    // 対応テーマ一覧
  gradeRange    String                      // 対象学年
  availableSlots Json?                      // 空き時間（JSON）

  sessions      Session[]
  supportRequests SupportRequest[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Session {
  id            String        @id @default(cuid())
  schoolId      String
  school        School        @relation(fields: [schoolId], references: [id])
  partnerId     String
  partner       Partner       @relation(fields: [partnerId], references: [id])

  scheduledAt   DateTime                  // セッション日時
  durationMin   Int                       // 45 or 60
  theme         String                    // 選択テーマ
  questionList  String?                   // 質問リスト（テキスト）
  status        SessionStatus @default(PENDING)

  priceJpy      Int                       // 支払い金額（円）
  supportAmount Int                       // 物資支援積算額（円）
  stripePaymentId String?                 // Stripe決済ID

  ratingScore   Int?                      // 事後評価（1〜5）
  ratingComment String?

  questionListSentAt    DateTime?         // 質問リスト送信日時
  readyCheckedAt        DateTime?         // 準備完了チェック日時
  cancelledAt           DateTime?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model SupportRequest {
  id            String    @id @default(cuid())
  partnerId     String
  partner       Partner   @relation(fields: [partnerId], references: [id])

  requestedAt   DateTime  @default(now())
  itemList      Json                      // [{name: string, quantity: number}]
  totalAmountJpy Int
  status        String    @default("PENDING")  // PENDING / SHIPPED / DELIVERED

  receiptPhotoUrl String?
  deliveredAt   DateTime?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Coupon {
  id            String    @id @default(cuid())
  schoolId      String
  school        School    @relation(fields: [schoolId], references: [id])

  discountPct   Int                       // 割引率（例: 10 = 10%オフ）
  reason        String                    // 発行理由（例: "キャンセル補償"）
  usedAt        DateTime?
  expiresAt     DateTime

  createdAt     DateTime  @default(now())
}
```

- [ ] **Step 3: DBにマイグレーション適用**

```bash
npx prisma migrate dev --name init
```

Expected: `✔ Generated Prisma Client` が表示される

- [ ] **Step 4: Prisma Studioで確認**

```bash
npx prisma studio
```

Expected: ブラウザで全テーブルが表示される

- [ ] **Step 5: コミット**

```bash
git add prisma/
git commit -m "feat: define database schema for WorldClass"
```

---

## Task 3: Prismaクライアント・シングルトン

**Files:**
- Create: `lib/db.ts`

- [ ] **Step 1: `lib/db.ts` を作成**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 2: 動作テスト（Prismaが接続できるか確認）**

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.\$connect().then(() => { console.log('DB connected'); db.\$disconnect(); });
"
```

Expected: `DB connected`

- [ ] **Step 3: コミット**

```bash
git add lib/db.ts
git commit -m "feat: add Prisma singleton client"
```

---

## Task 4: NextAuth設定（3ロール認証）

**Files:**
- Create: `lib/auth.ts`
- Create: `types/next-auth.d.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: `types/next-auth.d.ts` を作成（セッション型拡張）**

```typescript
import { Role } from "@prisma/client";
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: Role;
    };
  }

  interface User {
    id: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
```

- [ ] **Step 2: `lib/auth.ts` を作成**

```typescript
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!passwordMatch) return null;

        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
};
```

- [ ] **Step 3: `app/api/auth/[...nextauth]/route.ts` を作成**

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 4: コミット**

```bash
git add lib/auth.ts types/next-auth.d.ts app/api/auth/
git commit -m "feat: add NextAuth with 3-role JWT auth"
```

---

## Task 5: ミドルウェア（ルート保護）

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: `middleware.ts` を作成**

```typescript
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // ロール別ルート保護
    if (pathname.startsWith("/school") && role !== "SCHOOL") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/partner") && role !== "PARTNER") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/school/:path*", "/partner/:path*", "/admin/:path*"],
};
```

- [ ] **Step 2: コミット**

```bash
git add middleware.ts
git commit -m "feat: add role-based route protection middleware"
```

---

## Task 6: 日本校登録API

**Files:**
- Create: `lib/validations/school.ts`
- Create: `app/api/schools/route.ts`

- [ ] **Step 1: `lib/validations/school.ts` を作成**

```typescript
import { z } from "zod";

export const schoolRegisterSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上必要です"),
  name: z.string().min(1, "学校名を入力してください"),
  type: z.enum(["学校", "公民館", "図書館", "その他"]),
  prefecture: z.string().min(1, "都道府県を入力してください"),
  contactName: z.string().min(1, "担当者名を入力してください"),
  gradeRange: z.string().min(1, "対象学年を入力してください"),
});

export type SchoolRegisterInput = z.infer<typeof schoolRegisterSchema>;
```

- [ ] **Step 2: `app/api/schools/route.ts` を作成**

```typescript
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { schoolRegisterSchema } from "@/lib/validations/school";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schoolRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, name, type, prefecture, contactName, gradeRange } =
      parsed.data;

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: { email: ["このメールアドレスは既に使用されています"] } },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        role: "SCHOOL",
        school: {
          create: { name, type, prefecture, contactName, gradeRange },
        },
      },
      include: { school: true },
    });

    return NextResponse.json(
      { id: user.id, email: user.email, role: user.role },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/schools]", error);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
```

- [ ] **Step 3: APIをcurlで動作確認**

```bash
curl -X POST http://localhost:3000/api/schools \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-school@example.com",
    "password": "password123",
    "name": "テスト小学校",
    "type": "学校",
    "prefecture": "東京都",
    "contactName": "山田太郎",
    "gradeRange": "小4-小6"
  }'
```

Expected: `{"id":"...","email":"test-school@example.com","role":"SCHOOL"}`

- [ ] **Step 4: コミット**

```bash
git add lib/validations/school.ts app/api/schools/
git commit -m "feat: add school registration API with validation"
```

---

## Task 7: 海外校登録API

**Files:**
- Create: `lib/validations/partner.ts`
- Create: `app/api/partners/route.ts`

- [ ] **Step 1: `lib/validations/partner.ts` を作成**

```typescript
import { z } from "zod";

export const partnerRegisterSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上必要です"),
  schoolName: z.string().min(1, "学校名を入力してください"),
  country: z.string().min(1, "国を入力してください"),
  region: z.string().min(1, "地域を入力してください"),
  contactName: z.string().min(1, "担当教師名を入力してください"),
  themes: z.array(z.string()).min(1, "対応テーマを1つ以上選択してください"),
  gradeRange: z.string().min(1, "対象学年を入力してください"),
});

export type PartnerRegisterInput = z.infer<typeof partnerRegisterSchema>;
```

- [ ] **Step 2: `app/api/partners/route.ts` を作成**

```typescript
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { partnerRegisterSchema } from "@/lib/validations/partner";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = partnerRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, schoolName, country, region, contactName, themes, gradeRange } =
      parsed.data;

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: { email: ["このメールアドレスは既に使用されています"] } },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        role: "PARTNER",
        partner: {
          create: {
            schoolName,
            country,
            region,
            contactName,
            themes,
            gradeRange,
            status: "PENDING",  // 審査待ち
          },
        },
      },
      include: { partner: true },
    });

    return NextResponse.json(
      { id: user.id, email: user.email, role: user.role, status: user.partner?.status },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/partners]", error);
    return NextResponse.json({ error: "サーバーエラー" }, { status: 500 });
  }
}
```

- [ ] **Step 3: APIをcurlで動作確認**

```bash
curl -X POST http://localhost:3000/api/partners \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-partner@example.com",
    "password": "password123",
    "schoolName": "Test Primary School",
    "country": "Philippines",
    "region": "Manila",
    "contactName": "Maria Santos",
    "themes": ["文化紹介", "SDGs"],
    "gradeRange": "Grade 4-6"
  }'
```

Expected: `{"id":"...","email":"test-partner@example.com","role":"PARTNER","status":"PENDING"}`

- [ ] **Step 4: コミット**

```bash
git add lib/validations/partner.ts app/api/partners/
git commit -m "feat: add partner registration API with PENDING status"
```

---

## Task 8: シードデータ（管理者アカウント）

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: `prisma/seed.ts` を作成**

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123456", 12);

  await db.user.upsert({
    where: { email: "admin@worldclass.jp" },
    update: {},
    create: {
      email: "admin@worldclass.jp",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("✅ Admin user created: admin@worldclass.jp / admin123456");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
```

- [ ] **Step 2: `package.json` にseedスクリプト追加**

`package.json` の `"scripts"` セクションに追加：

```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

- [ ] **Step 3: シード実行**

```bash
npm install -D ts-node
npx prisma db seed
```

Expected: `✅ Admin user created: admin@worldclass.jp / admin123456`

- [ ] **Step 4: コミット**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add admin seed user"
```

---

## Task 9: ログインページ（UI）

**Files:**
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: `app/(auth)/login/page.tsx` を作成**

```typescript
"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      return;
    }

    // ロール別リダイレクトはmiddlewareが処理
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">WorldClass ログイン</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            ログイン
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ブラウザで動作確認**

```
http://localhost:3000/login
```

Expected: ログインフォームが表示される。`admin@worldclass.jp` / `admin123456` でログイン→トップページへリダイレクト

- [ ] **Step 3: コミット**

```bash
git add app/
git commit -m "feat: add login page with NextAuth credentials"
```

---

## セルフレビュー

**スペックカバレッジ:**
- ✅ 3ロール（日本校・海外校・管理者）の認証
- ✅ 日本校登録（学校情報・担当者名・学年）
- ✅ 海外校登録（PENDING審査フロー）
- ✅ DBスキーマ（Session・SupportRequest・Coupon含む）
- ✅ ルート保護（ロール別）
- ⏭️ カタログ・予約・決済 → Plan 2
- ⏭️ 準備フロー・通知 → Plan 3
- ⏭️ 物資支援管理 → Plan 4
- ⏭️ 自治体ダッシュボード → Plan 5

**プレースホルダー:** なし（全ステップにコードあり）

**型一貫性:** `Role`, `PartnerStatus`, `SessionStatus` はすべてPrismaスキーマから生成。Task 4〜7で参照する型はTask 2で定義済み。
