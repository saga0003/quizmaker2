import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { QuestionType, QuestionStatus, CognitiveLevel } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const subjectId = searchParams.get('subjectId')
    const chapterId = searchParams.get('chapterId')
    const topicId = searchParams.get('topicId')
    const difficulty = searchParams.get('difficulty')
    const type = searchParams.get('type') as QuestionType
    const status = searchParams.get('status') as QuestionStatus
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    const where: any = {}
    
    if (subjectId) where.subject_id = subjectId
    if (chapterId) where.chapter_id = chapterId
    if (topicId) where.topic_id = topicId
    if (difficulty) where.difficulty = parseInt(difficulty)
    if (type) where.type = type
    if (status) where.status = status
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { explanation: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [questions, total] = await Promise.all([
      db.question.findMany({
        where,
        include: {
          subject: true,
          chapter: true,
          topic: true,
          sub_topic: true,
          created_by: {
            select: { id: true, name: true, email: true }
          },
          reviewed_by: {
            select: { id: true, name: true, email: true }
          },
          options: {
            orderBy: { order: 'asc' }
          },
          solutions: {
            orderBy: { order: 'asc' }
          },
          _count: {
            select: {
              responses: true
            }
          }
        },
        orderBy: { updated_at: 'desc' },
        skip,
        take: limit
      }),
      db.question.count({ where })
    ])

    return NextResponse.json({
      questions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching questions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      content,
      type,
      difficulty,
      cognitiveLevel,
      estimatedTime,
      marks,
      negativeMarks,
      subjectId,
      chapterId,
      topicId,
      subTopicId,
      explanation,
      pastExamMapping,
      tags,
      partialMarking,
      shuffleOptions,
      options
    } = body

    // Validate required fields
    if (!content || !type || !subjectId) {
      return NextResponse.json(
        { error: 'Missing required fields: content, type, subjectId' },
        { status: 400 }
      )
    }

    // Create the question
    const question = await db.question.create({
      data: {
        title,
        content,
        type: type as QuestionType,
        difficulty: difficulty || 3,
        cognitive_level: cognitiveLevel as CognitiveLevel || CognitiveLevel.RECALL,
        estimated_time: estimatedTime || 60,
        marks: marks || 1,
        negative_marks: negativeMarks || 0,
        subject_id: subjectId,
        chapter_id: chapterId,
        topic_id: topicId,
        sub_topic_id: subTopicId,
        created_by_id: body.createdById || 'system', // This should come from auth
        explanation,
        past_exam_mapping: pastExamMapping,
        tags: tags ? JSON.stringify(tags) : null,
        partial_marking: partialMarking || false,
        shuffle_options: shuffleOptions !== false
      },
      include: {
        subject: true,
        chapter: true,
        topic: true,
        sub_topic: true,
        created_by: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Create options if provided
    if (options && Array.isArray(options) && options.length > 0) {
      await db.questionOption.createMany({
        data: options.map((option: any, index: number) => ({
          question_id: question.id,
          content: option.content,
          is_correct: option.isCorrect || false,
          order: option.order || index,
          rationale: option.rationale
        }))
      })
    }

    // Fetch the complete question with options
    const completeQuestion = await db.question.findUnique({
      where: { id: question.id },
      include: {
        subject: true,
        chapter: true,
        topic: true,
        sub_topic: true,
        created_by: {
          select: { id: true, name: true, email: true }
        },
        options: {
          orderBy: { order: 'asc' }
        }
      }
    })

    return NextResponse.json(completeQuestion, { status: 201 })
  } catch (error) {
    console.error('Error creating question:', error)
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    )
  }
}