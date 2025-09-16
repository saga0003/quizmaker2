import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export interface DecodedToken {
  userId: string
  email: string
  role: string
  organizationId?: string
  iat: number
  exp: number
}

export function verifyToken(request: NextRequest): DecodedToken | null {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken
    
    return decoded
  } catch (error) {
    console.error('Token verification error:', error)
    return null
  }
}

export function requireAuth(request: NextRequest): DecodedToken {
  const decoded = verifyToken(request)
  
  if (!decoded) {
    throw new Error('Unauthorized')
  }
  
  return decoded
}

export function requireRole(request: NextRequest, requiredRoles: string[]): DecodedToken {
  const decoded = requireAuth(request)
  
  if (!requiredRoles.includes(decoded.role)) {
    throw new Error('Insufficient permissions')
  }
  
  return decoded
}