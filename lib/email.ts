import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Create a singleton transporter for connection reuse
let cachedTransporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!cachedTransporter) {
    // Validate environment variables
    if (!process.env.AWS_SES_ACCESS_KEY_ID || !process.env.AWS_SES_SECRET_ACCESS_KEY) {
      throw new Error('Missing AWS SES SMTP credentials in environment variables')
    }

    console.log('🚀 Creating production-ready email transporter...')

    cachedTransporter = nodemailer.createTransport({
      pool: true, // Enable connection pooling for production
      host: 'email-smtp.ap-south-1.amazonaws.com',
      port: 587,
      secure: false, // STARTTLS
      auth: {
        user: process.env.AWS_SES_ACCESS_KEY_ID,
        pass: process.env.AWS_SES_SECRET_ACCESS_KEY,
      },
      maxConnections: 3, // Limit connections to 3
      maxMessages: 100, // Send 100 messages per connection
      rateLimit: 10, // Send 10 emails per second
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 5000,    // 5 seconds
      socketTimeout: 10000,     // 10 seconds
    } as nodemailer.TransportOptions)

    // Handle transporter errors
    cachedTransporter.on('error', (error) => {
      console.error('❌ Transporter error:', error)
      // Reset transporter on error
      if (cachedTransporter) {
        cachedTransporter.close() // Close the pool
      }
      cachedTransporter = null
    })
  }
  return cachedTransporter
}

// Modern email template matching website design system
function createVerificationEmailHTML(name: string, verificationUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - Campus Connect</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0b; color: #f0f0f0;">
      <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1b1e 0%, #222327 100%);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #8c5cff 0%, #6d28d9 100%); padding: 40px 30px; text-align: center; border-radius: 0;">
          <div style="background: rgba(255,255,255,0.1); display: inline-block; padding: 12px; border-radius: 16px; margin-bottom: 16px;">
            <div style="width: 48px; height: 48px; background: #ffffff; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #8c5cff;">🎓</div>
          </div>
          <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">SDMCET Campus Connect</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9); font-weight: 500;">SDMCET Placement Portal</p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 40px 30px;">
          <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #f0f0f0; line-height: 1.3;">Welcome, ${name}! 👋</h2>
          
          <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #a0a0a0;">
            Thank you for joining SDMCET - Campus Connect! We're excited to have you on board. To complete your registration and secure your account, please verify your email address.
          </p>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #8c5cff 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(140, 92, 255, 0.3); transition: all 0.2s ease;">
              ✨ Verify Email Address
            </a>
          </div>
          
          <!-- Info Card -->
          <div style="background: #2a2c33; border: 1px solid #33353a; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #f0f0f0; display: flex; align-items: center;">
              <span style="margin-right: 8px;">🔒</span> Quick & Secure
            </h3>
            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #a0a0a0;">
              This verification link expires in <strong style="color: #8c5cff;">24 hours</strong> for your security. Once verified, you'll have full access to placement opportunities, company updates, and career resources.
            </p>
          </div>
          
          <!-- Alternative Link -->
          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #33353a;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #a0a0a0;">
              Can't click the button? Copy and paste this link into your browser:
            </p>
            <p style="margin: 0; word-break: break-all; font-size: 12px; color: #8c5cff; background: #222327; padding: 12px; border-radius: 8px; font-family: 'IBM Plex Mono', monospace;">
              ${verificationUrl}
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #161618; padding: 30px; text-align: center; border-top: 1px solid #33353a;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #a0a0a0;">
            This email was sent by <strong style="color: #f0f0f0;">SDMCET Campus Connect</strong>
          </p>
          <p style="margin: 0; font-size: 12px; color: #666;">
            If you didn't create an account, you can safely ignore this email.
          </p>
          
          <!-- Social/Contact Info -->
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #2a2c33;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              📧 Contact: placement@sdmcet.ac.in | 🌐 sdmcetinsignia.com
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

export async function generateVerificationToken(email: string): Promise<string> {
  // Delete existing tokens efficiently
  await prisma.verificationToken.deleteMany({
    where: { identifier: email }
  })

  // Generate token
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)

  // Store in database
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  })

  return token
}

export async function sendVerificationEmail(email: string, name: string) {
  const startTime = Date.now()
  
  try {
    // Generate token
    const token = await generateVerificationToken(email)
    const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`
    
    // Get production-ready transporter
    const emailTransporter = getTransporter()
    
    if (!emailTransporter) {
      throw new Error('Failed to initialize email transporter')
    }
    
    console.log(`📧 Sending verification email to ${email}...`)
    
    // Send email with optimized settings (no connection verification for speed)
    const result = await emailTransporter.sendMail({
      from: `"SDMCET - Campus Connect" <${process.env.EMAIL_FROM}>`, // Branded sender name
      to: email,
      subject: '✨ Verify your email - Campus Connect',
      html: createVerificationEmailHTML(name, verificationUrl),
    })
    
    const sendTime = Date.now() - startTime
    console.log(`✅ Verification email sent to ${email} in ${sendTime}ms (MessageID: ${result.messageId})`)
    
    return { 
      success: true, 
      messageId: result.messageId, 
      sendTime,
      method: 'Production AWS SES SMTP (pooling, rate-limiting)'
    }
  } catch (error) {
    const sendTime = Date.now() - startTime
    console.error(`❌ Error sending verification email to ${email} in ${sendTime}ms:`, error)
    
    // Provide more specific error information for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to send verification email: ${errorMessage}`)
  }
}

export async function verifyEmailToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const verificationToken = await prisma.verificationToken.findFirst({
      where: { token }
    })

    if (!verificationToken) {
      return { success: false, error: 'Invalid or expired token' }
    }

    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { 
          identifier_token: {
            identifier: verificationToken.identifier,
            token: token
          }
        }
      })
      return { success: false, error: 'Token has expired' }
    }

    // Update user and delete token in a transaction for efficiency
    await prisma.$transaction([
      prisma.user.update({
        where: { email: verificationToken.identifier },
        data: { emailVerified: new Date() }
      }),
      prisma.verificationToken.delete({
        where: { 
          identifier_token: {
            identifier: verificationToken.identifier,
            token: token
          }
        }
      })
    ])

    return { success: true, email: verificationToken.identifier }
  } catch (error) {
    console.error('❌ Error verifying email token:', error)
    return { success: false, error: 'Internal server error' }
  }
}
