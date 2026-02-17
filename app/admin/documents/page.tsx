
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { getDocumentUrl } from "@/lib/document-utils"

export default async function AdminDocumentsPage() {
    const session = await auth()

    if (!session?.user || session.user.role !== "ADMIN") {
        redirect("/login")
    }

    // Fetch users with documents
    const users = await prisma.user.findMany({
        where: {
            role: "STUDENT",
            document: {
                isNot: null
            }
        },
        include: {
            profile: {
                select: {
                    firstName: true,
                    lastName: true,
                    usn: true,
                }
            },
            document: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    })

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "VERIFIED":
                return <Badge className="bg-green-500">Verified</Badge>
            case "REJECTED":
                return <Badge variant="destructive">Rejected</Badge>
            default:
                return <Badge variant="secondary">Pending</Badge>
        }
    }

    const renderLink = (url: string | null, label: string) => {
        if (!url) return <span className="text-gray-400 text-xs">-</span>

        const fileUrl = getDocumentUrl(url, process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN)

        return (
            <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold whitespace-nowrap transition-colors"
                title={label}
            >
                View <ExternalLink className="w-3.5 h-3.5" />
            </a>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Student Documents</h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Uploaded Documents ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>USN</TableHead>
                                    <TableHead>CGPA</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>10th</TableHead>
                                    <TableHead>12th</TableHead>
                                    <TableHead>Sem 1</TableHead>
                                    <TableHead>Sem 2</TableHead>
                                    <TableHead>Sem 3</TableHead>
                                    <TableHead>Sem 4</TableHead>
                                    <TableHead>Sem 5</TableHead>
                                    <TableHead>Sem 6</TableHead>
                                    <TableHead>Sem 7</TableHead>
                                    <TableHead>Sem 8</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => {
                                    const doc = user.document!

                                    return (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium text-blue-600">{doc.usn || user.profile?.usn || "-"}</TableCell>
                                            <TableCell className="font-semibold">{doc.cgpa?.toFixed(2) || "-"}</TableCell>
                                            <TableCell>{getStatusBadge(doc.kycStatus)}</TableCell>
                                            <TableCell>{renderLink(doc.tenthMarksCardLink, "10th Marks Card")}</TableCell>
                                            <TableCell>{renderLink(doc.twelfthMarksCardLink, "12th Marks Card")}</TableCell>
                                            <TableCell>{renderLink(doc.sem1Link, "Sem 1")}</TableCell>
                                            <TableCell>{renderLink(doc.sem2Link, "Sem 2")}</TableCell>
                                            <TableCell>{renderLink(doc.sem3Link, "Sem 3")}</TableCell>
                                            <TableCell>{renderLink(doc.sem4Link, "Sem 4")}</TableCell>
                                            <TableCell>{renderLink(doc.sem5Link, "Sem 5")}</TableCell>
                                            <TableCell>{renderLink(doc.sem6Link, "Sem 6")}</TableCell>
                                            <TableCell>{renderLink(doc.sem7Link, "Sem 7")}</TableCell>
                                            <TableCell>{renderLink(doc.sem8Link, "Sem 8")}</TableCell>
                                        </TableRow>
                                    )
                                })}
                                {users.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={13} className="h-24 text-center">
                                            No documents uploaded yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
