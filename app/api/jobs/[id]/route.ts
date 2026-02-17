import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import QRCode from "qrcode"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const job = await prisma.job.findUnique({
            where: {
                id,
                status: "ACTIVE",
                isVisible: true
            },
            include: {
                _count: {
                    select: {
                        applications: true
                    }
                },
                customFields: true
            }
        })

        if (!job) {
            return NextResponse.json(
                { error: "Job not found" },
                { status: 404 }
            )
        }

        // Check if user has applied
        const application = await prisma.application.findUnique({
            where: {
                jobId_userId: {
                    jobId: id,
                    userId: session.user.id
                }
            }
        })

        return NextResponse.json({
            job,
            hasApplied: !!application && !application.isRemoved,
        })

    } catch (error) {
        console.error("Error fetching job:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// POST - Apply to a job
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        // Handle file upload (resume)
        let resumeFile: File | null = null
        let resumeUrl: string | null = null

        const contentType = request.headers.get("content-type")
        if (contentType?.includes("multipart/form-data")) {
            const formData = await request.formData()
            const file = formData.get("resume") as File | null
            if (file) {
                resumeFile = file
                // Upload resume to storage
                const uploadFormData = new FormData()
                uploadFormData.append("file", file)
                uploadFormData.append("folder", "application-resumes")

                const uploadResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3500'}/api/upload`, {
                    method: "POST",
                    body: uploadFormData,
                })

                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json()
                    resumeUrl = uploadData.url
                }
            }
        } else {
            const body = await request.json()
            resumeUrl = body.resumeUrl || null
        }

        // Check if job exists and is active
        const job = await prisma.job.findUnique({
            where: {
                id,
                status: "ACTIVE",
                isVisible: true
            }
        })

        if (!job) {
            return NextResponse.json(
                { error: "Job not found or no longer accepting applications" },
                { status: 404 }
            )
        }

        // Check deadline
        if (job.deadline && new Date(job.deadline) < new Date()) {
            return NextResponse.json(
                { error: "Application deadline has passed" },
                { status: 400 }
            )
        }

        // Check if user already applied
        const existingApplication = await prisma.application.findUnique({
            where: {
                jobId_userId: {
                    jobId: id,
                    userId: session.user.id
                }
            }
        })

        if (existingApplication) {
            return NextResponse.json(
                { error: "You have already applied to this job" },
                { status: 400 }
            )
        }

        // Get user's profile
        const profile = await prisma.profile.findUnique({
            where: { userId: session.user.id },
            select: {
                id: true,
                resume: true,
                cgpa: true,
                branch: true,
                batch: true,
                activeBacklogs: true,
                kycStatus: true,
                resumeUpload: true
            }
        })

        if (!profile) {
            return NextResponse.json(
                { error: "Please complete your profile before applying" },
                { status: 400 }
            )
        }

        // Check KYC status - must be VERIFIED to apply
        if (profile.kycStatus !== "VERIFIED") {
            return NextResponse.json(
                {
                    error: "Your profile must be verified before applying to jobs. Please complete your profile and upload your College ID card.",
                    kycStatus: profile.kycStatus
                },
                { status: 400 }
            )
        }

        // Check eligibility - Optional criteria are only checked if they are set (not null) in the job
        if (job.minCGPA !== null && profile.cgpa && profile.cgpa < job.minCGPA) {
            return NextResponse.json(
                { error: `Minimum CGPA of ${job.minCGPA} required` },
                { status: 400 }
            )
        }

        // Allowed branches: If null or empty, all branches are allowed (handled by schema change to nullable, but check here)
        if (job.allowedBranches && job.allowedBranches.length > 0 && profile.branch) {
            if (!job.allowedBranches.includes(profile.branch)) {
                return NextResponse.json(
                    { error: "Your branch is not eligible for this job" },
                    { status: 400 }
                )
            }
        }

        if (job.eligibleBatch !== null && profile.batch) {
            const studentBatchYear = profile.batch.split('-').pop()?.trim()
            const jobBatchYear = job.eligibleBatch.split('-').pop()?.trim()

            if (studentBatchYear !== jobBatchYear) {
                return NextResponse.json(
                    { error: `Only ${job.eligibleBatch} batch is eligible` },
                    { status: 400 }
                )
            }
        }

        // Max backlogs: Check if constraint is set
        if (job.maxBacklogs !== null && profile.activeBacklogs) {
            if (job.maxBacklogs === 0) {
                return NextResponse.json(
                    { error: "No active backlogs allowed for this job" },
                    { status: 400 }
                )
            }
            // For maxBacklogs > 0, we assume eligibility since we can't count them precisely
        }

        // Create application
        const application = await prisma.application.create({
            data: {
                jobId: id,
                userId: session.user.id,
                resumeUsed: resumeUrl || profile.resume || profile.resumeUpload || null
            }
        })

        // Generate QR code with Google Form URL for attendance tracking
        const googleFormUrl = job.googleFormUrl || "https://forms.gle/placement-attendance-form"
        const qrCode = await QRCode.toDataURL(googleFormUrl)

        // Create attendance record with QR code
        await prisma.attendance.create({
            data: {
                studentId: session.user.id,
                jobId: id,
                qrCode: application.id // Using application ID as unique QR identifier
            }
        })

        // Create notification
        await prisma.notification.create({
            data: {
                userId: session.user.id,
                title: "Application Submitted",
                message: `You have successfully applied for ${job.title} at ${job.companyName}`,
                type: "APPLICATION_STATUS",
                data: {
                    applicationId: application.id,
                    jobId: id
                }
            }
        })

        return NextResponse.json({
            success: true,
            application,
            qrCode // Return QR code for display
        }, { status: 201 })

    } catch (error) {
        console.error("Error applying to job:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
