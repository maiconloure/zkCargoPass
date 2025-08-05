import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Get the backend URL from environment or use default
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
    
    // Forward the request to your NestJS backend
    const response = await fetch(`${backendUrl}/document/verify-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward cookies for session-based authentication
        ...(request.headers.get('cookie') && {
          'cookie': request.headers.get('cookie')!
        }),
        // Forward any authorization headers if present
        ...(request.headers.get('authorization') && {
          'authorization': request.headers.get('authorization')!
        })
      },
      body: JSON.stringify(body),
      // Include credentials for session-based auth
      credentials: 'include'
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: `Backend error: ${response.status} ${response.statusText}` 
      }))
      return NextResponse.json(errorData, { status: response.status })
    }

    const data = await response.json()
    
    // Forward any set-cookie headers from the backend
    const responseHeaders = new Headers()
    const setCookieHeader = response.headers.get('set-cookie')
    if (setCookieHeader) {
      responseHeaders.set('set-cookie', setCookieHeader)
    }
    
    return NextResponse.json(data, { headers: responseHeaders })
    
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { 
        message: 'Internal server error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
