"use client"

import { useState } from "react"
import { PersonalInfoStep } from "@/components/steps/personal-info-step"
import { ContactDetailsStep } from "@/components/steps/contact-details-step"
import { AcademicDetailsStep } from "@/components/steps/academic-details-step"
import { EngineeringDetailsStep } from "@/components/steps/engineering-details-step"
import { CollegeIdStep } from "@/components/steps/college-id-step"
import { ReviewStep } from "@/components/steps/review-step"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { toast } from "sonner"

enum Step {
    PERSONAL_INFO = 1,
    CONTACT_DETAILS = 2,
    ACADEMIC_DETAILS = 3,
    ENGINEERING_DETAILS = 4,
    COLLEGE_ID = 5,
    REVIEW = 6,
}

export function ProfileCompletion({ profile, userEmail }: { profile: any, userEmail: string }) {
    const [currentStep, setCurrentStep] = useState<Step>(profile?.completionStep || Step.PERSONAL_INFO)
    const [isSaving, setIsSaving] = useState(false)
    // Extract document data from profile.user.document
    const documentData = profile?.user?.document || {}

    const [formData, setFormData] = useState<any>({
        personalInfo: {
            firstName: profile?.firstName ?? "",
            middleName: profile?.middleName ?? "",
            lastName: profile?.lastName ?? "",
            gender: profile?.gender ?? "",
            dateOfBirth: profile?.dateOfBirth ?? "",
            bloodGroup: profile?.bloodGroup ?? "",
            state: profile?.state || profile?.stateOfDomicile || "KARNATAKA",
            nationality: profile?.nationality || "Indian",
            category: profile?.category || profile?.casteCategory || "",
            profilePhoto: profile?.profilePhoto || null,
        },

        contactDetails: {
            studentEmail: profile?.studentEmail || profile?.email || userEmail || "",
            callingNumber: profile?.callingNumber || profile?.callingMobile || "",
            whatsappNumber: profile?.whatsappNumber || profile?.whatsappMobile || "",
            altNumber: profile?.altNumber || profile?.alternativeMobile || "",
            fatherFirstName: profile?.fatherFirstName || "",
            fatherMiddleName: profile?.fatherMiddleName || ".",
            fatherLastName: profile?.fatherLastName || "",
            fatherName: profile?.fatherName || "",
            fatherDeceased: profile?.fatherDeceased || false,
            fatherMobile: profile?.fatherMobile || "",
            fatherEmail: profile?.fatherEmail || "",
            fatherOccupation: profile?.fatherOccupation || "",
            motherFirstName: profile?.motherFirstName || "",
            motherMiddleName: profile?.motherMiddleName || ".",
            motherLastName: profile?.motherLastName || "",
            motherName: profile?.motherName || "",
            motherDeceased: profile?.motherDeceased || false,
            motherMobile: profile?.motherMobile || "",
            motherEmail: profile?.motherEmail || "",
            motherOccupation: profile?.motherOccupation || "",
        },

        addressDetails: {
            currentHouse: profile?.currentHouse || "",
            currentCross: profile?.currentCross || "",
            currentArea: profile?.currentArea || "",
            currentDistrict: profile?.currentDistrict || "",
            currentCity: profile?.currentCity || "",
            currentPincode: profile?.currentPincode || "",
            currentState: profile?.currentState || "KARNATAKA",
            sameAsCurrent: profile?.sameAsCurrent || false,
            permanentHouse: profile?.permanentHouse || "",
            permanentCross: profile?.permanentCross || "",
            permanentArea: profile?.permanentArea || "",
            permanentDistrict: profile?.permanentDistrict || "",
            permanentCity: profile?.permanentCity || "",
            permanentPincode: profile?.permanentPincode || "",
            permanentState: profile?.permanentState || "KARNATAKA",
        },

        tenthDetails: {
            tenthSchool: profile?.tenthSchoolName ?? "",
            tenthBoard: profile?.tenthBoard ?? "",
            tenthPercentage: profile?.tenthPercentage ?? "",
            tenthPassingYear: profile?.tenthPassingYear ?? "",
            tenthMarksCard: documentData.tenthMarksCardLink || profile?.tenthMarksCard || null, // Prioritize Document model
        },

        twelfthDiplomaDetails: {
            twelfthSchool: profile?.twelfthSchoolName ?? "",
            twelfthPercentage: profile?.twelfthStatePercentage ?? "",
            diplomaCollege: profile?.diplomaCollege ?? "",
            diplomaPercentage: profile?.diplomaPercentage ?? "",
            twelfthMarksCard: documentData.twelfthMarksCardLink || profile?.twelfthMarksCard || null, // Prioritize Document model
        },

        engineeringDetails: {
            collegeName: profile?.collegeName ?? "",
            usn: documentData.usn || profile?.usn || "", // Prioritize Document model
            branch: profile?.branch ?? "",
            entryType: profile?.entryType ?? "",
            seatCategory: profile?.seatCategory ?? "",
            libraryId: profile?.libraryId ?? "",
            batch: profile?.batch ?? "",
            branchMentor: profile?.branchMentor ?? "",
            linkedinLink: profile?.linkedinLink || profile?.linkedin || "",
            githubLink: profile?.githubLink || profile?.github || "",
            leetcodeLink: profile?.leetcodeLink || profile?.leetcode || "",
        },

        engineeringAcademicDetails: {
            finalCgpa: documentData.cgpa?.toString() || profile?.finalCgpa || "", // Prioritize Document model
            activeBacklogs: profile?.activeBacklogs ?? false,
        },

        collegeIdDetails: {
            collegeIdCard: profile?.collegeIdCard ?? null,
        },
    })


    const steps = [
        { id: Step.PERSONAL_INFO, label: "Personal Info" },
        { id: Step.CONTACT_DETAILS, label: "Contact" },
        { id: Step.ACADEMIC_DETAILS, label: "Academic" },
        { id: Step.ENGINEERING_DETAILS, label: "Engineering" },
        { id: Step.COLLEGE_ID, label: "College ID" },
        { id: Step.REVIEW, label: "Review" },
    ]

    const handleNext = async (data: any) => {
        // First save the current data and advance the step in DB
        await saveProfile(data, true)
    }

    const kycStatus = profile?.kycStatus

    const saveProfile = async (data: any = null, advanceStep = false) => {
        setIsSaving(true)
        try {
            // If data is provided, it's the latest from a step, so we update formData FIRST
            let dataToSave = formData
            if (data) {
                // Determine which section to update based on current step
                const updated = { ...formData }
                switch (currentStep) {
                    case Step.PERSONAL_INFO:
                        updated.personalInfo = data
                        break
                    case Step.CONTACT_DETAILS:
                        updated.contactDetails = {
                            ...data,
                            email: data.studentEmail,
                            callingMobile: data.callingNumber,
                            whatsappMobile: data.whatsappNumber,
                            alternativeMobile: data.altNumber,
                            fatherName: `${data.fatherFirstName || ""} ${data.fatherMiddleName || ""} ${data.fatherLastName || ""}`.replace(/\s+/g, " ").trim(),
                            motherName: `${data.motherFirstName || ""} ${data.motherMiddleName || ""} ${data.motherLastName || ""}`.replace(/\s+/g, " ").trim(),
                        }
                        updated.addressDetails = {
                            currentHouse: data.currentHouse,
                            currentCross: data.currentCross,
                            currentArea: data.currentArea,
                            currentDistrict: data.currentDistrict,
                            currentCity: data.currentCity,
                            currentPincode: data.currentPincode,
                            currentState: data.currentState,
                            sameAsCurrent: data.sameAsCurrent,
                            permanentHouse: data.permanentHouse,
                            permanentCross: data.permanentCross,
                            permanentArea: data.permanentArea,
                            permanentDistrict: data.permanentDistrict,
                            permanentCity: data.permanentCity,
                            permanentPincode: data.permanentPincode,
                            permanentState: data.permanentState,
                        }
                        break
                    case Step.ACADEMIC_DETAILS:
                        updated.rawAcademicDetails = data
                        updated.tenthDetails = {
                            tenthSchoolName: data.tenthSchool,
                            tenthBoard: data.tenthBoard,
                            tenthPassingYear: data.tenthPassingYear,
                            tenthPercentage: data.tenthPercentage,
                            tenthMarksCard: data.tenthMarksCard,
                            ...data
                        }
                        updated.twelfthDiplomaDetails = {
                            twelfthOrDiploma: data.academicLevel,
                            twelfthSchoolName: data.twelfthSchool,
                            twelfthStatePercentage: data.twelfthPercentage,
                            twelfthMarksCard: data.twelfthMarksCard,
                            diplomaCollege: data.diplomaCollege,
                            diplomaPercentage: data.diplomaPercentage,
                            ...data
                        }
                        break
                    case Step.ENGINEERING_DETAILS:
                        updated.engineeringDetails = data
                        updated.engineeringAcademicDetails = {
                            ...data,
                            activeBacklogs: data.hasBacklogs === "yes",
                            finalCgpa: data.finalCgpa,
                        }
                        break
                    case Step.COLLEGE_ID:
                        updated.collegeIdDetails = data
                        break
                }
                setFormData(updated)
                dataToSave = updated
            }

            // Flatten data for API
            const payload = {
                ...dataToSave.personalInfo,
                ...dataToSave.contactDetails,
                ...dataToSave.addressDetails,
                ...dataToSave.tenthDetails,
                ...dataToSave.twelfthDiplomaDetails,
                ...dataToSave.engineeringDetails,
                ...dataToSave.engineeringAcademicDetails,
                ...dataToSave.collegeIdDetails,
                // Include current progress step
                completionStep: advanceStep ? Math.min(Step.REVIEW, currentStep + 1) : currentStep
            }

            // Remove frontend-only fields that are not in Prisma schema
            delete payload.twelfthOrDiploma
            delete payload.rawAcademicDetails

            // Extract DOB components if dateOfBirth exists
            if (payload.dateOfBirth) {
                const dob = new Date(payload.dateOfBirth)
                if (!isNaN(dob.getTime())) {
                    payload.dobDay = dob.getDate().toString().padStart(2, "0")
                    payload.dobMonth = (dob.getMonth() + 1).toString().padStart(2, "0")
                    payload.dobYear = dob.getFullYear().toString()
                }
            }

            const response = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || "Failed to save profile")
            }

            toast.success("Progress saved successfully")

            // Advance the step in UI if requested
            if (advanceStep) {
                setCurrentStep((prev) => Math.min(Step.REVIEW, prev + 1))
            }
        } catch (error: any) {
            console.error("Save error:", error)
            toast.error(error.message || "Failed to save progress")
        } finally {
            setIsSaving(false)
        }
    }

    const handleStepClick = (stepId: number) => {
        setCurrentStep(stepId as Step)
    }

    const handlePrevious = () => {
        setCurrentStep((prev) => Math.max(1, prev - 1))
    }

    // Banner messages based on current KYC status
    const renderKycBanner = () => {
        if (kycStatus === 'UNDER_REVIEW') {
            return (
                <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 mb-4">
                    <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                                    KYC Verification Pending
                                </h3>
                                <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                                    Your profile has been submitted and is awaiting admin approval. You will be notified once verified.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )
        }
        if (kycStatus === 'VERIFIED') {
            return (
                <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 mb-4">
                    <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-green-900 dark:text-green-200">
                                    KYC Verified
                                </h3>
                                <p className="text-sm text-green-800 dark:text-green-300 mt-1">
                                    Your profile has been approved by an admin. You may now browse and apply for jobs.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )
        }
        return null
    }

    const renderStep = () => {
        switch (currentStep) {
            case Step.PERSONAL_INFO:
                return (
                    <PersonalInfoStep
                        onNext={handleNext}
                        onSave={(data) => saveProfile(data, true)}
                        isSaving={isSaving}
                        initialData={formData.personalInfo}
                    />
                )
            case Step.CONTACT_DETAILS:
                return (
                    <ContactDetailsStep
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        onSave={(data) => saveProfile(data, true)}
                        isSaving={isSaving}
                        initialData={{ ...formData.contactDetails, ...formData.addressDetails }}
                    />
                )
            case Step.ACADEMIC_DETAILS:
                return (
                    <AcademicDetailsStep
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        onSave={(data) => saveProfile(data, true)}
                        isSaving={isSaving}
                        initialData={formData.rawAcademicDetails || {}}
                    />
                )
            case Step.ENGINEERING_DETAILS:
                return (
                    <EngineeringDetailsStep
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        onSave={(data) => saveProfile(data, true)}
                        isSaving={isSaving}
                        initialData={formData.engineeringDetails}
                    />
                )
            case Step.COLLEGE_ID:
                return (
                    <CollegeIdStep
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        onSave={(data) => saveProfile(data, true)}
                        isSaving={isSaving}
                        initialData={formData.collegeIdDetails}
                    />
                )
            case Step.REVIEW:
                return (
                    <ReviewStep
                        onPrevious={handlePrevious}
                        formData={formData}
                    />
                )
            default:
                return null
        }
    }

    return (
        <div className="space-y-8">
            {/* Stepper */}
            <div className="relative">
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10" />
                <div className="flex justify-between max-w-4xl mx-auto px-4">
                    {steps.map((step) => {
                        const isCompleted = currentStep > step.id
                        const isCurrent = currentStep === step.id

                        return (
                            <div
                                key={step.id}
                                className={`flex flex-col items-center gap-2 bg-background px-2 group`}
                            >
                                <div
                                    className={`
                                        w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200
                                        ${isCompleted ? "bg-green-600 border-green-600 text-white" :
                                            isCurrent ? "bg-blue-600 border-blue-600 text-white" :
                                                "bg-background border-gray-300 text-gray-400"}
                                        group-hover:scale-110
                                    `}
                                >
                                    {isCompleted ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : (
                                        <span className="text-xs font-semibold">{step.id}</span>
                                    )}
                                </div>
                                <span className={`text-xs font-medium transition-colors ${isCurrent ? "text-blue-600" : "text-muted-foreground group-hover:text-blue-400"} hidden sm:block`}>
                                    {step.label}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Step Content */}
            <div className="mt-8">
                {renderStep()}
            </div>
        </div>
    )
}
