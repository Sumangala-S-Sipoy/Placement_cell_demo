"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileText, User, GraduationCap, Briefcase, Upload, CheckCircle } from "lucide-react"
import { format } from "date-fns"

interface ProfileData {
    firstName?: string
    lastName?: string
    email?: string
    callingMobile?: string
    usn?: string
    branch?: string
    batch?: string
    cgpa?: number
    resume?: string
    resumeUpload?: string
}

interface JobData {
    id: string
    title: string
    companyName: string
    location: string
    jobType: string
    workMode: string
    salary?: string
    deadline?: string
    customFields?: {
        id: string
        label: string
        type: "TEXT" | "NUMBER" | "DROPDOWN" | "BOOLEAN" | "FILE_UPLOAD" | "TEXTAREA"
        required: boolean
        options?: any
    }[]
}

interface ApplicationReviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    job: JobData
    profile: ProfileData | null
    onConfirm: (resumeUrl?: string) => Promise<void>
    isApplying: boolean
}

export function ApplicationReviewDialog({
    open,
    onOpenChange,
    job,
    profile,
    onConfirm,
    isApplying
}: ApplicationReviewDialogProps) {
    const [resumeFile, setResumeFile] = useState<File | null>(null)
    const [resumeUrl, setResumeUrl] = useState<string | null>(profile?.resume || profile?.resumeUpload || null)
    const [isUploading, setIsUploading] = useState(false)
    const [customResponses, setCustomResponses] = useState<Record<string, any>>({})
    const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({})

    useEffect(() => {
        if (open && job.customFields) {
            const initialResponses: Record<string, any> = {}
            job.customFields.forEach(field => {
                if (field.type === "BOOLEAN") {
                    initialResponses[field.id] = false
                } else {
                    initialResponses[field.id] = ""
                }
            })
            setCustomResponses(initialResponses)
        }
    }, [open, job.customFields])

    const handleCustomFieldChange = (fieldId: string, value: any) => {
        setCustomResponses(prev => ({
            ...prev,
            [fieldId]: value
        }))
    }

    const handleCustomFileUpload = async (fieldId: string, file: File) => {
        setUploadingFields(prev => ({ ...prev, [fieldId]: true }))
        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("folder", "applications")

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) throw new Error("Upload failed")
            const data = await response.json()
            handleCustomFieldChange(fieldId, data.url)
        } catch (error) {
            console.error("Upload error:", error)
        } finally {
            setUploadingFields(prev => ({ ...prev, [fieldId]: false }))
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null
        if (!file) {
            setResumeFile(null)
            return
        }

        setResumeFile(file)
        setIsUploading(true)

        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("folder", "resumes")

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                throw new Error("Failed to upload file")
            }

            const data = await response.json()
            setResumeUrl(data.url)
        } catch (error) {
            console.error("Error uploading resume:", error)
        } finally {
            setIsUploading(false)
        }
    }

    const handleConfirm = async () => {
        // Simple check for required custom fields
        if (job.customFields) {
            for (const field of job.customFields) {
                if (field.required && !customResponses[field.id]) {
                    alert(`Please fill in the required field: ${field.label}`)
                    return
                }
            }
        }

        const formattedResponses = job.customFields?.map(field => ({
            fieldId: field.id,
            value: customResponses[field.id]?.toString()
        })) || []

        await onConfirm(resumeUrl || undefined, formattedResponses)
    }

    const getJobTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            FULL_TIME: "Full Time",
            PART_TIME: "Part Time",
            INTERNSHIP: "Internship",
            CONTRACT: "Contract",
        }
        return labels[type] || type
    }

    const getWorkModeLabel = (mode: string) => {
        const labels: Record<string, string> = {
            OFFICE: "On-campus",
            REMOTE: "Off-campus",
            HYBRID: "Hybrid",
        }
        return labels[mode] || mode
    }

    if (!profile) {
        return null
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Review Application Details</DialogTitle>
                    <DialogDescription>
                        Please review your information before submitting your application
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Personal Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <User className="w-5 h-5" />
                                Personal Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Name</p>
                                    <p className="font-medium">
                                        {profile.firstName} {profile.lastName}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Email</p>
                                    <p className="font-medium">{profile.email || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Mobile</p>
                                    <p className="font-medium">{profile.callingMobile || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">USN</p>
                                    <p className="font-medium">{profile.usn || "N/A"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Academic Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <GraduationCap className="w-5 h-5" />
                                Academic Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Branch</p>
                                    <p className="font-medium">{profile.branch || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Batch</p>
                                    <p className="font-medium">{profile.batch || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">CGPA</p>
                                    <p className="font-medium">{profile.cgpa?.toFixed(2) || "N/A"}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Resume Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <FileText className="w-5 h-5" />
                                Resume
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {resumeUrl ? (
                                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Resume from Profile</p>
                                        <a
                                            href={resumeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline"
                                        >
                                            View Resume
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                                    <p className="text-sm text-muted-foreground mb-2">
                                        No resume found in profile
                                    </p>
                                </div>
                            )}

                            <Separator />

                            <div>
                                <label className="text-sm font-medium mb-2 block">
                                    Upload New Resume (Optional)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="resume-upload"
                                        disabled={isUploading}
                                    />
                                    <label htmlFor="resume-upload">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={isUploading}
                                            asChild
                                        >
                                            <span>
                                                <Upload className="w-4 h-4 mr-2" />
                                                {isUploading ? "Uploading..." : "Upload New Resume"}
                                            </span>
                                        </Button>
                                    </label>
                                    {resumeFile && (
                                        <span className="text-sm text-muted-foreground">
                                            {resumeFile.name}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    If you upload a new resume, it will be used for this application instead of your profile resume.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Custom Application Fields */}
                    {job.customFields && job.customFields.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Briefcase className="w-5 h-5" />
                                    Additional Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {job.customFields.map((field) => (
                                    <div key={field.id} className="space-y-2">
                                        <label className="text-sm font-medium">
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </label>

                                        {field.type === "TEXT" && (
                                            <input
                                                type="text"
                                                className="w-full p-2 border rounded-md"
                                                value={customResponses[field.id] || ""}
                                                onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                required={field.required}
                                            />
                                        )}

                                        {field.type === "NUMBER" && (
                                            <input
                                                type="number"
                                                className="w-full p-2 border rounded-md"
                                                value={customResponses[field.id] || ""}
                                                onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                required={field.required}
                                            />
                                        )}

                                        {field.type === "TEXTAREA" && (
                                            <textarea
                                                className="w-full p-2 border rounded-md"
                                                rows={3}
                                                value={customResponses[field.id] || ""}
                                                onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                required={field.required}
                                            />
                                        )}

                                        {field.type === "BOOLEAN" && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={field.id}
                                                    checked={customResponses[field.id] || false}
                                                    onChange={(e) => handleCustomFieldChange(field.id, e.target.checked)}
                                                />
                                                <label htmlFor={field.id} className="text-sm">Yes</label>
                                            </div>
                                        )}

                                        {field.type === "DROPDOWN" && (
                                            <select
                                                className="w-full p-2 border rounded-md"
                                                value={customResponses[field.id] || ""}
                                                onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                required={field.required}
                                            >
                                                <option value="">Select an option</option>
                                                {Array.isArray(field.options) && field.options.map((opt: string) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        )}

                                        {field.type === "FILE_UPLOAD" && (
                                            <div className="space-y-2">
                                                {customResponses[field.id] ? (
                                                    <div className="flex items-center gap-2 text-green-600 text-sm">
                                                        <CheckCircle className="w-4 h-4" />
                                                        <span>File uploaded</span>
                                                        <Button
                                                            variant="link"
                                                            className="h-auto p-0 text-xs"
                                                            onClick={() => handleCustomFieldChange(field.id, "")}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="file"
                                                        className="text-sm"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0]
                                                            if (file) handleCustomFileUpload(field.id, file)
                                                        }}
                                                        disabled={uploadingFields[field.id]}
                                                    />
                                                )}
                                                {uploadingFields[field.id] && <p className="text-xs text-muted-foreground animate-pulse">Uploading...</p>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Job Details Summary */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Briefcase className="w-5 h-5" />
                                Job Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <p className="text-sm text-muted-foreground">Position</p>
                                <p className="font-medium text-lg">{job.title}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Company</p>
                                <p className="font-medium">{job.companyName}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Location</p>
                                    <p className="font-medium">{job.location}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Type</p>
                                    <Badge variant="outline">
                                        {getJobTypeLabel(job.jobType)} • {getWorkModeLabel(job.workMode)}
                                    </Badge>
                                </div>
                                {job.salary && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Package</p>
                                        <p className="font-medium">{job.salary}</p>
                                    </div>
                                )}
                                {job.deadline && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Deadline</p>
                                        <p className="font-medium">
                                            {format(new Date(job.deadline), "MMM dd, yyyy")}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isApplying}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isApplying || isUploading}
                    >
                        {isApplying ? "Applying..." : "Confirm & Apply"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
