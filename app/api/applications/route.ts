import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Helper to check tier eligibility (same logic as jobs API)
function canApplyToTier(studentTier: string | null, jobTier: string, isDreamOffer: boolean): { eligible: boolean; reason?: string } {
    if (isDreamOffer) return { eligible: true }
    if (!studentTier) return { eligible: true }

    if (studentTier === "TIER_1") {
        return { eligible: false, reason: "You are already placed in Tier 1 and blocked from further placements" }
    }
    if (studentTier === "TIER_2") {
        if (jobTier === "TIER_1") return { eligible: true }
        return { eligible: false, reason: "You are placed in Tier 2. You can only apply for Tier 1 jobs" }
    }
    if (studentTier === "TIER_3") {
        if (jobTier === "TIER_1" || jobTier === "TIER_2") return { eligible: true }
        return { eligible: false, reason: "You are placed in Tier 3. You can only apply for Tier 1 or Tier 2 jobs" }
    }
    return { eligible: true }
}

// GET - Get user's applications (simplified)
export async function GET(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "10")
        const skip = (page - 1) * limit

        const where = {
            userId: session.user.id,
            isRemoved: false
        }

        const [applications, total] = await Promise.all([
            prisma.application.findMany({
                where,
                orderBy: { appliedAt: "desc" },
                skip,
                take: limit,
                include: {
                    job: {
                        select: {
                            id: true,
                            title: true,
                            companyName: true,
                            companyLogo: true,
                            location: true,
                            category: true,
                            tier: true,
                            jobType: true,
                            workMode: true,
                            salary: true,
                            deadline: true,
                            status: true
                        }
                    }
                }
            }),
            prisma.application.count({ where })
        ])

        return NextResponse.json({
            applications,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        })

    } catch (error) {
        console.error("Error fetching applications:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST - Apply to a job (one-click)
export async function POST(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        console.log("Application POST body:", JSON.stringify(body, null, 2))
        const { jobId, responses } = body

        if (!jobId) {
            console.error("Job ID missing in body")
            return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
        }

        // Get job details
        const job = await prisma.job.findUnique({
            where: { id: jobId },
            select: {
                id: true,
                title: true,
                companyName: true,
                status: true,
                deadline: true,
                tier: true,
                isDreamOffer: true,
                minCGPA: true,
                maxBacklogs: true,
                allowedBranches: true,
                eligibleBatch: true,
                customFields: true
            }
        })

        // ... (lines 121-193 check job existence, status, deadline, existing app, profile, tier, cgpa)

        // Check branch
        if (job.allowedBranches.length > 0 && userProfile.branch) {
            if (!job.allowedBranches.includes(userProfile.branch)) {
                return NextResponse.json({
                    error: `Your branch (${userProfile.branch}) is not eligible for this job`
                }, { status: 400 })
            }
        }

        // Check batch
        if (job.eligibleBatch && userProfile.batch) {
            // Helper to extract batch year (e.g. from "2022 - 2026" get "2026")
            const getBatchYear = (b: string) => {
                if (!b) return ""
                const parts = b.split('-')
                return parts[parts.length - 1].trim()
            }

            const studentBatchYear = getBatchYear(userProfile.batch)
            const jobBatchYear = getBatchYear(job.eligibleBatch)

            if (studentBatchYear !== jobBatchYear) {
                return NextResponse.json({
                    error: `Only ${job.eligibleBatch} batch is eligible`
                }, { status: 400 })
            }
        }

        // Check backlogs
        const hasActiveBacklogs = userProfile.activeBacklogs || userProfile.hasBacklogs === "yes"
        if (job.maxBacklogs !== null && job.maxBacklogs === 0 && hasActiveBacklogs) {
            return NextResponse.json({ error: "No active backlogs allowed" }, { status: 400 })
        }

        // Validate custom fields
        if (job.customFields && job.customFields.length > 0) {
            for (const field of job.customFields) {
                const response = responses?.find((r: any) => r.fieldId === field.id)
                if (field.required && (!response || !response.value)) {
                    return NextResponse.json({
                        error: `Custom field "${field.label}" is required`
                    }, { status: 400 })
                }
            }
        }

        // Create application
        const application = await prisma.application.create({
            data: {
                jobId,
                userId: session.user.id,
                resumeUsed: userProfile.resumeUpload || userProfile.resume,
                responses: responses && Array.isArray(responses) ? {
                    create: responses.map((r: any) => ({
                        fieldId: r.fieldId,
                        value: r.value
                    }))
                } : undefined
            }
        })

        return NextResponse.json({
            success: true,
            application,
            message: `Successfully applied to ${job.title} at ${job.companyName}`
        }, { status: 201 })

    } catch (error) {
        console.error("Error applying to job:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
