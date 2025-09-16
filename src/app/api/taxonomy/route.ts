import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const subjectId = searchParams.get('subjectId')
    const chapterId = searchParams.get('chapterId')
    const type = searchParams.get('type') // 'subjects', 'chapters', 'topics', 'subtopics'

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    let data: any = []

    switch (type) {
      case 'subjects':
        data = await db.subject.findMany({
          where: { organization_id: organizationId },
          include: {
            _count: {
              select: {
                chapters: true,
                questions: true
              }
            }
          },
          orderBy: { name: 'asc' }
        })
        break

      case 'chapters':
        if (!subjectId) {
          return NextResponse.json(
            { error: 'Subject ID is required for chapters' },
            { status: 400 }
          )
        }
        data = await db.chapter.findMany({
          where: { subject_id: subjectId },
          include: {
            _count: {
              select: {
                topics: true,
                questions: true
              }
            }
          },
          orderBy: { order: 'asc' }
        })
        break

      case 'topics':
        if (!chapterId) {
          return NextResponse.json(
            { error: 'Chapter ID is required for topics' },
            { status: 400 }
          )
        }
        data = await db.topic.findMany({
          where: { chapter_id: chapterId },
          include: {
            _count: {
              select: {
                subtopics: true,
                questions: true
              }
            }
          },
          orderBy: { order: 'asc' }
        })
        break

      case 'subtopics':
        if (!chapterId) {
          return NextResponse.json(
            { error: 'Chapter ID is required for subtopics' },
            { status: 400 }
          )
        }
        data = await db.subTopic.findMany({
          where: { topic_id: chapterId },
          include: {
            _count: {
              select: {
                questions: true
              }
            }
          },
          orderBy: { order: 'asc' }
        })
        break

      default:
        // Return all taxonomy data for the organization
        const [subjects, chapters, topics, subtopics] = await Promise.all([
          db.subject.findMany({
            where: { organization_id: organizationId },
            orderBy: { name: 'asc' }
          }),
          db.chapter.findMany({
            where: { 
              subject: { organization_id: organizationId }
            },
            orderBy: { order: 'asc' }
          }),
          db.topic.findMany({
            where: { 
              chapter: { 
                subject: { organization_id: organizationId }
              }
            },
            orderBy: { order: 'asc' }
          }),
          db.subTopic.findMany({
            where: { 
              topic: { 
                chapter: { 
                  subject: { organization_id: organizationId }
                }
              }
            },
            orderBy: { order: 'asc' }
          })
        ])

        data = {
          subjects,
          chapters,
          topics,
          subtopics
        }
        break
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching taxonomy:', error)
    return NextResponse.json(
      { error: 'Failed to fetch taxonomy' },
      { status: 500 }
    )
  }
}