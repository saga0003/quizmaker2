import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const question = await db.question.findUnique({
      where: { id: params.id },
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
        analytics: true
      }
    })

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(question)
  } catch (error) {
    console.error('Error fetching question:', error)
    return NextResponse.json(
      { error: 'Failed to fetch question' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      status,
      options
    } = body

    // Check if question exists
    const existingQuestion = await db.question.findUnique({
      where: { id: params.id }
    })

    if (!existingQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Update the question
    const updateData: any = {
      updated_at: new Date()
    }

    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (type !== undefined) updateData.type = type
    if (difficulty !== undefined) updateData.difficulty = difficulty
    if (cognitiveLevel !== undefined) updateData.cognitive_level = cognitiveLevel
    if (estimatedTime !== undefined) updateData.estimated_time = estimatedTime
    if (marks !== undefined) updateData.marks = marks
    if (negativeMarks !== undefined) updateData.negative_marks = negativeMarks
    if (subjectId !== undefined) updateData.subject_id = subjectId
    if (chapterId !== undefined) updateData.chapter_id = chapterId
    if (topicId !== undefined) updateData.topic_id = topicId
    if (subTopicId !== undefined) updateData.sub_topic_id = subTopicId
    if (explanation !== undefined) updateData.explanation = explanation
    if (pastExamMapping !== undefined) updateData.past_exam_mapping = pastExamMapping
    if (tags !== undefined) updateData.tags = tags ? JSON.stringify(tags) : null
    if (partialMarking !== undefined) updateData.partial_marking = partialMarking
    if (shuffleOptions !== undefined) updateData.shuffle_options = shuffleOptions
    if (status !== undefined) updateData.status = status

    const updatedQuestion = await db.question.update({
      where: { id: params.id },
      data: updateData,
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
        }
      }
    })

    // Update options if provided
    if (options && Array.isArray(options)) {
      // Delete existing options
      await db.questionOption.deleteMany({
        where: { question_id: params.id }
      })

      // Create new options
      if (options.length > 0) {
        await db.questionOption.createMany({
          data: options.map((option: any, index: number) => ({
            question_id: params.id,
            content: option.content,
            is_correct: option.isCorrect || false,
            order: option.order || index,
            rationale: option.rationale
          }))
        })
      }
    }

    // Fetch the complete updated question
    const completeQuestion = await db.question.findUnique({
      where: { id: params.id },
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
        }
      }
    })

    return NextResponse.json(completeQuestion)
  } catch (error) {
    console.error('Error updating question:', error)
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if question exists
    const existingQuestion = await db.question.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            responses: true,
            test_questions: true
          }
        }
      }
    })

    if (!existingQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Check if question is used in tests or has responses
    if (existingQuestion._count.responses > 0 || existingQuestion._count.test_questions > 0) {
      return NextResponse.json(
        { error: 'Cannot delete question that is used in tests or has responses' },
        { status: 400 }
      )
    }

    // Delete question options first
    await db.questionOption.deleteMany({
      where: { question_id: params.id }
    })

    // Delete question solutions
    await db.questionSolution.deleteMany({
      where: { question_id: params.id }
    })

    // Delete the question
    await db.question.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Question deleted successfully' })
  } catch (error) {
    console.error('Error deleting question:', error)
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    )
  }
}