import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    // Normalize email to prevent case/whitespace mismatches between
    // registration and sign-in lookups.
    const normalizedEmail = (email || "").toLowerCase().trim()

    console.log("📝 SIGNUP DEBUG:", {
      nameProvided: !!name,
      emailProvided: !!email,
      emailNormalized: normalizedEmail,
      passwordLength: password?.length,
      passwordProvided: !!password,
    })

    if (!name || !normalizedEmail || !password) {
      console.error("❌ SIGNUP VALIDATION FAILED:", { name, email: normalizedEmail, password })
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)
    
    console.log("🔐 PASSWORD HASHING DEBUG:", {
      passwordLength: password.length,
      hashedPasswordLength: hashedPassword.length,
      hashedPasswordStart: hashedPassword.substring(0, 20),
      isBcryptHash: hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$'),
    })

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: "STUDENT"
      }
    })
    
    console.log("✅ USER CREATED:", {
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      hasPassword: !!user.password,
      passwordStoredLength: user.password?.length,
    })

    // Send verification email
    try {
      await sendVerificationEmail(normalizedEmail, name)
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      // Don't fail registration if email fails
    }

    return NextResponse.json(
      { 
        message: "User created successfully. Please check your email to verify your account.",
        userId: user.id 
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
