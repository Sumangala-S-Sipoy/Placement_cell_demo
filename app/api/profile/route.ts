import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, sanitizeInput, logSecurityEvent } from "@/lib/auth-helpers"

export async function GET() {
  try {
    // Check authentication
    const { error, session } = await requireAuth()

    if (error || !session) {
      return error
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id }
    })

    return NextResponse.json(profile)
  } catch (error: any) {
    console.error("Profile Save API Error:", error)
    return NextResponse.json({ error: error.message || "Failed to update profile", details: error }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const { error, session } = await requireAuth()

    if (error || !session) {
      return error
    }

    const body = await request.json()
    console.log("Profile PUT Body:", JSON.stringify(body, null, 2))

    // Prevent userId tampering - always use session userId
    const sanitizedData = { ...body }
    delete sanitizedData.userId // Remove if present in payload
    delete sanitizedData.id // Prevent ID manipulation

    console.log("Received profile update payload:", JSON.stringify(sanitizedData, null, 2))

    // Sanitize string fields and filter out File objects (which serialize as empty objects)
    Object.keys(sanitizedData).forEach(key => {
      const value = sanitizedData[key]

      // Remove null/undefined
      if (value === null || value === undefined) {
        delete sanitizedData[key]
        return
      }

      // Sanitize strings
      if (typeof value === 'string') {
        sanitizedData[key] = sanitizeInput(value)
        return
      }

      // Filter out empty objects (File objects serialize as {} when sent as JSON)
      // Keep arrays and objects with actual data
      if (typeof value === 'object') {
        // Allow arrays (even empty ones for clearing)
        if (Array.isArray(value)) {
          return
        }
        // Remove empty objects (likely File objects that couldn't be serialized)
        if (Object.keys(value).length === 0) {
          delete sanitizedData[key]
          return
        }
      }
    })

    // Validate critical fields
    if (sanitizedData.usn && sanitizedData.usn.length > 20) {
      return NextResponse.json(
        { error: "USN too long" },
        { status: 400 }
      )
    }

    if (sanitizedData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedData.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Prevent users from manually setting KYC status to VERIFIED or REJECTED
    // Only admins can set these statuses via the admin API
    if (sanitizedData.kycStatus && ['VERIFIED', 'REJECTED'].includes(sanitizedData.kycStatus)) {
      delete sanitizedData.kycStatus
    }

    // Check if profile exists
    const existingProfile = await prisma.profile.findUnique({
      where: { userId: session.user.id }
    })

    // Merge existing profile data with new data to check completeness
    const mergedData = existingProfile ? { ...existingProfile, ...sanitizedData } : sanitizedData

    // Function to check if profile is complete enough for KYC review
    const isProfileComplete = (profileData: any): boolean => {
      // Check essential fields
      const hasPersonalInfo = !!(
        profileData.firstName &&
        profileData.lastName &&
        profileData.dateOfBirth &&
        profileData.gender &&
        profileData.usn
      )

      const hasContactInfo = !!(
        profileData.callingMobile &&
        profileData.email
      )

      const hasAcademicInfo = !!(
        profileData.tenthPercentage !== null &&
        profileData.tenthPercentage !== undefined &&
        profileData.tenthPassingYear
      )

      const hasEngineeringInfo = !!(
        profileData.branch &&
        profileData.batch &&
        profileData.cgpa !== null &&
        profileData.cgpa !== undefined
      )

      // Check if resume is uploaded (important for KYC)
      const hasResume = !!(profileData.resume || profileData.resumeUpload)

      return hasPersonalInfo && hasContactInfo && hasAcademicInfo && hasEngineeringInfo && hasResume
    }

    // Determine KYC status update
    let kycStatusUpdate: { kycStatus?: 'PENDING' | 'UNDER_REVIEW' | 'INCOMPLETE' | 'VERIFIED' } = {}

    // Only auto-update KYC status if it hasn't been set by an admin (VERIFIED/REJECTED)
    const currentKycStatus = existingProfile?.kycStatus || 'PENDING'
    const isAdminSetStatus = currentKycStatus === 'VERIFIED' || currentKycStatus === 'REJECTED'

    // Check if College ID card is being uploaded or already exists
    const hasCollegeId = !!(sanitizedData.collegeIdCard || mergedData.collegeIdCard || existingProfile?.collegeIdCard)

    if (!isAdminSetStatus) {
      // Users cannot directly mark profiles as VERIFIED/REJECTED. Instead,
      // once all required fields are filled in we move the status to
      // UNDER_REVIEW. An admin must then explicitly approve to flip to
      // VERIFIED.
      if (isProfileComplete(mergedData)) {
        if (currentKycStatus !== 'UNDER_REVIEW') {
          kycStatusUpdate.kycStatus = 'UNDER_REVIEW'
        }
      } else {
        // If the profile was previously under review but becomes incomplete,
        // revert back to pending so the student can fix issues.
        if (currentKycStatus === 'UNDER_REVIEW') {
          kycStatusUpdate.kycStatus = 'PENDING'
        }
      }
    }

    // Whitelist of all valid Prisma Profile schema fields (strip anything else to prevent "Unknown argument" errors)
    const validProfileFields = new Set([
      'isComplete', 'completionStep',
      'firstName', 'middleName', 'lastName', 'dateOfBirth', 'dobDay', 'dobMonth', 'dobYear',
      'gender', 'bloodGroup', 'state', 'stateOfDomicile', 'nationality', 'category', 'casteCategory',
      'profilePhoto', 'email', 'studentEmail',
      'callingMobile', 'callingNumber', 'whatsappMobile', 'whatsappNumber', 'alternativeMobile', 'altNumber',
      'fatherFirstName', 'fatherMiddleName', 'fatherLastName', 'fatherName', 'fatherDeceased',
      'fatherMobile', 'fatherEmail', 'fatherOccupation',
      'motherFirstName', 'motherMiddleName', 'motherLastName', 'motherName', 'motherDeceased',
      'motherMobile', 'motherEmail', 'motherOccupation',
      'currentHouse', 'currentCross', 'currentArea', 'currentDistrict', 'currentCity',
      'currentState', 'currentPincode', 'currentAddress', 'sameAsCurrent',
      'permanentHouse', 'permanentCross', 'permanentArea', 'permanentDistrict', 'permanentCity',
      'permanentState', 'permanentPincode', 'permanentAddress', 'country',
      'tenthSchool', 'tenthSchoolName', 'tenthArea', 'tenthAreaDistrictCity', 'tenthDistrict',
      'tenthCity', 'tenthPincode', 'tenthState', 'tenthBoard', 'tenthPassingYear', 'tenthPassingMonth',
      'tenthMarksType', 'tenthPercentage', 'tenthSubjects', 'tenthTotalMarks', 'tenthMarksOutOf1000',
      'tenthMarksCard',
      'academicLevel', 'hasCompletedTwelfth',
      'twelfthSchool', 'twelfthSchoolName', 'twelfthArea', 'twelfthAreaDistrictCity', 'twelfthDistrict',
      'twelfthCity', 'twelfthPincode', 'twelfthState', 'twelfthBoard', 'twelfthPassingYear', 'twelfthPassingMonth',
      'twelfthMarksType', 'twelfthPercentage', 'twelfthSubjects', 'twelfthTotalMarks', 'twelfthMarksOutOf1000',
      'twelfthMarksCard', 'twelfthCbseSubjects', 'twelfthCbseMarks', 'twelfthIcseMarks',
      'hasCompletedDiploma', 'diplomaCollege', 'diplomaCollegeName', 'diplomaArea', 'diplomaAreaLocation',
      'diplomaDistrict', 'diplomaCity', 'diplomaPincode', 'diplomaState',
      'diplomaCertificate', 'diplomaCertificates', 'diplomaSemesterSgpa', 'diplomaSemesters',
      'diplomaYearMarks', 'diplomaFirstYear', 'diplomaSecondYear', 'diplomaThirdYear', 'diplomaPercentage',
      'collegeName', 'collegeDistrict', 'district', 'collegePincode', 'pincode',
      'branch', 'entryType', 'seatCategory', 'usn', 'libraryId',
      'residencyStatus', 'hostelName', 'hostelRoom', 'roomNumber', 'hostelFloor', 'floorNumber',
      'city', 'localCity', 'transportMode', 'busRoute',
      'batch', 'branchMentor', 'linkedinLink', 'githubLink', 'leetcodeLink',
      'resumeUpload', 'semesters', 'semesterRecords', 'semesterMarksCards',
      'failedSubjects', 'clearedAfterFailure', 'finalCgpa', 'hasBacklogs', 'activeBacklogs',
      'backlogs', 'backlogSubjects',
      'linkedin', 'github', 'leetcode', 'portfolio', 'codechef', 'codeforces', 'hackerrank',
      'resume', 'phone', 'alternatePhone', 'department', 'course', 'specialization',
      'semester', 'year', 'cgpa', 'percentage',
      'guardianName', 'guardianPhone', 'guardianRelation',
      'skills', 'certifications', 'projects', 'internships', 'achievements', 'hobbies', 'languages',
      'expectedSalary', 'preferredLocations', 'jobType', 'workMode',
      'kycStatus', 'verifiedBy', 'verifiedAt', 'remarks',
      'createdAt', 'collegeIdCard', 'academicDocument',
    ])

    // Strip any fields not in the Prisma schema whitelist
    Object.keys(sanitizedData).forEach(key => {
      if (!validProfileFields.has(key)) {
        delete sanitizedData[key]
      }
    })

    // Convert empty strings to null and perform type casting for specific fields
    const numericFields = ['tenthPassingYear', 'tenthPercentage', 'twelfthPassingYear', 'twelfthPercentage', 'diplomaPercentage', 'finalCgpa', 'completionStep']
    const dateFields = ['dateOfBirth']
    const enumFields = ['gender', 'bloodGroup', 'tenthBoard', 'twelfthBoard', 'branch', 'entryType', 'seatCategory', 'kycStatus']

    Object.keys(sanitizedData).forEach(key => {
      const value = sanitizedData[key]

      // Handle empty strings for optional fields
      if (value === "") {
        sanitizedData[key] = null
        return
      }

      // Convert to Number
      if (numericFields.includes(key) && value !== null) {
        const num = parseFloat(value)
        sanitizedData[key] = isNaN(num) ? null : num
        return
      }

      // Convert to Date
      if (dateFields.includes(key) && value !== null) {
        try {
          const date = new Date(value)
          sanitizedData[key] = isNaN(date.getTime()) ? null : date
        } catch {
          sanitizedData[key] = null
        }
        return
      }

      // Handle Enums (ensure null if invalid/empty)
      if (enumFields.includes(key) && value === null) {
        // Keep as null
        return
      }
    })

    console.log("Updating profile with data:", JSON.stringify(sanitizedData, null, 2))

    let profile
    if (existingProfile) {
      // Update existing profile - ensure user can only update their own profile
      profile = await prisma.profile.update({
        where: {
          userId: session.user.id
        },
        data: {
          ...sanitizedData,
          ...kycStatusUpdate,
          updatedAt: new Date()
        }
      })

      logSecurityEvent("profile_updated", {
        userId: session.user.id,
        timestamp: new Date().toISOString(),
        kycStatusChanged: !!kycStatusUpdate.kycStatus,
        newKycStatus: kycStatusUpdate.kycStatus
      })
    } else {
      // Create new profile
      profile = await prisma.profile.create({
        data: {
          ...sanitizedData,
          userId: session.user.id, // Always use session userId
          ...kycStatusUpdate,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      logSecurityEvent("profile_created", {
        userId: session.user.id,
        timestamp: new Date().toISOString()
      })
    }

    // Sync documents to Document model for Admin view
    try {
      // Extract semester marks cards from the semantics array
      const semesterMarks: Record<string, string | null> = {}
      if (Array.isArray(sanitizedData.semesters)) {
        sanitizedData.semesters.forEach((sem: any) => {
          if (sem && sem.semester && sem.marksCard) {
            semesterMarks[`sem${sem.semester}Link`] = sem.marksCard
          }
        })
      }

      // Upsert Document record
      await prisma.document.upsert({
        where: { userId: session.user.id },
        update: {
          usn: sanitizedData.usn || undefined,
          cgpa: sanitizedData.finalCgpa ? parseFloat(sanitizedData.finalCgpa) : undefined,
          tenthMarksCardLink: sanitizedData.tenthMarksCard || undefined,
          twelfthMarksCardLink: sanitizedData.twelfthMarksCard || undefined,
          ...semesterMarks,
          kycStatus: "PENDING"
        },
        create: {
          userId: session.user.id,
          usn: sanitizedData.usn,
          cgpa: sanitizedData.finalCgpa ? parseFloat(sanitizedData.finalCgpa) : undefined,
          tenthMarksCardLink: sanitizedData.tenthMarksCard,
          twelfthMarksCardLink: sanitizedData.twelfthMarksCard,
          ...semesterMarks as any, // Type cast as we know the structure matches
          kycStatus: "PENDING"
        }
      })
      console.log("Synced documents to Admin Document model")
    } catch (docError) {
      console.error("Error syncing documents:", docError)
      // Don't fail the whole request if document sync fails, but log it
    }

    return NextResponse.json({
      success: true,
      profile,
      message: "Profile updated successfully"
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }

    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint")) {
        return NextResponse.json(
          { error: "USN already exists. Please use a different USN." },
          { status: 400 }
        )
      }
    }

    logSecurityEvent("profile_update_error", {
      error: error instanceof Error ? error.message : "Unknown error"
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
