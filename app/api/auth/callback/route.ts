import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * Smart callback redirect that checks profile completion
 * and redirects users to the appropriate page
 */
export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    // Check if user has a profile and if it's complete
    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { isComplete: true }
    })

    // If profile exists and is complete, go to dashboard
    if (profile?.isComplete) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // Otherwise, go to profile completion page
    return NextResponse.redirect(new URL("/profile", request.url))
  } catch (error) {
    console.error("Auth callback error:", error)
    return NextResponse.redirect(new URL("/login", request.url))
  }
}
