import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import type { NextAuthConfig } from "next-auth"

const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        // ✅ FULL TYPE-SAFE GUARDS
        if (
          !credentials ||
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string"
        ) {
          throw new Error("Invalid email or password")
        }

        // ✅ SAFE NORMALIZATION
        const email = credentials.email.toLowerCase().trim()
        const password = credentials.password

        // ✅ FETCH USER WITH PASSWORD
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true, // 🔴 REQUIRED
            role: true,
          },
        })

        if (!user || !user.password) {
          throw new Error("Invalid email or password")
        }

        // ✅ SAFE BCRYPT COMPARE
        const isValid = await bcrypt.compare(password, user.password)

        if (!isValid) {
          throw new Error("Invalid email or password")
        }

        // ✅ RETURN USER (NO PASSWORD)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig)
