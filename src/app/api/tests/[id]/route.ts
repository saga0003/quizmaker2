import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const test = await db.test.findUnique({
      where: { id: params.id },
      include: {
        organization: {
          select: { id: true, name: true, slug: true }
        },
        created_by: {
          select: { id: true, name: true, email: true }
        },
        template: {
          select: { id: true, name: true, type: true }
        },
        sections: {
          include: {
            questions: {
              include: {
                question: {
                  select: {
                    id: true,
                    title: true,
                    content: true,
                    type: true,
                    difficulty: true,
                    cognitive_level: true,
                    estimated_time: true,
                    marks: true,
                    negative_marks: true,
                    subject: { select: { id: true, name: true } },
                    chapter: { select: { id: true, name: true } },
                    topic: { select: { id: true, name: true } },
                    options: {
                      orderBy: { order: 'asc' },
                      select: {
                        id: true,
                        content: true,
                        is_correct: true,
                        order: true,
                        rationale: true
                      }
                    }
                  }
                }
              },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            attempts: true,
            questions: true,
            assignments: true
          }
        }
      }
    })

    if (!test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(test)
  } catch (error) {
    console.error('Error fetching test:', error)
    return NextResponse.json(
      { error: 'Failed to fetch test' },
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
      description,
      code,
      mode,
      duration,
      startTime,
      endTime,
      maxAttempts,
      shuffleQuestions,
      shuffleOptions,
      showResults,
      showSolutions,
      allowReview,
      negativeMarking,
      passingMarks,
      instructions,
      settings,
      status
    } = body

    // Check if test exists
    const existingTest = await db.test.findUnique({
      where: { id: params.id }
    })

    if (!existingTest) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      )
    }

    // Update the test
    const updateData: any = {
      updated_at: new Date()
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (code !== undefined) updateData.code = code
    if (mode !== undefined) updateData.mode = mode
    if (duration !== undefined) updateData.duration = duration
    if (startTime !== undefined) updateData.start_time = startTime ? new Date(startTime) : null
    if (endTime !== undefined) updateData.end_time = endTime ? new Date(endTime) : null
    if (maxAttempts !== undefined) updateData.max_attempts = maxAttempts
    if (shuffleQuestions !== undefined) updateData.shuffle_questions = shuffleQuestions
    if (shuffleOptions !== undefined) updateData.shuffle_options = shuffleOptions
    if (showResults !== undefined) updateData.show_results = showResults
    if (showSolutions !== undefined) updateData.show_solutions = showSolutions
    if (allowReview !== undefined) updateData.allow_review = allowReview
    if (negativeMarking !== undefined) updateData.negative_marking = negativeMarking
    if (passingMarks !== undefined) updateData.passing_marks = passingMarks
    if (instructions !== undefined) updateData.instructions = instructions
    if (settings !== undefined) updateData.settings = settings
    if (status !== undefined) updateData.status = status

    const updatedTest = await db.test.update({
      where: { id: params.id },
      data: updateData,
      include: {
        organization: {
          select: { id: true, name: true, slug: true }
        },
        created_by: {
          select: { id: true, name: true, email: true }
        },
        template: {
          select: { id: true, name: true, type: true }
        }
      }
    })

    return NextResponse.json(updatedTest)
  } catch (error) {
    console.error('Error updating test:', error)
    return NextResponse.json(
      { error: 'Failed to update test' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if test exists
    const existingTest = await db.test.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            attempts: true,
            assignments: true
          }
        }
      }
    })

    if (!existingTest) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      )
    }

    // Check if test has attempts or assignments
    if (existingTest._count.attempts > 0 || existingTest._count.assignments > 0) {
      return NextResponse.json(
        { error: 'Cannot delete test that has attempts or assignments' },
        { status: 400 }
      )
    }

    // Delete test questions first
    await db.testQuestion.deleteMany({
      where: { test_id: params.id }
    })

    // Delete test sections
    await db.testSection.deleteMany({
      where: { test_id: params.id }
    })

    // Delete the test
    await db.test.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Test deleted successfully' })
  } catch (error) {
    console.error('Error deleting test:', error)
    return NextResponse.json(
      { error: 'Failed to delete test' },
      { status: 500 }
    )
  }
}

// POST endpoint for test operations (publish, duplicate, etc.)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'publish':
        return await publishTest(params.id)
      case 'duplicate':
        return await duplicateTest(params.id)
      case 'regenerate':
        return await regenerateTest(params.id, body.blueprint)
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error performing test action:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    )
  }
}

async function publishTest(testId: string) {
  const test = await db.test.findUnique({
    where: { id: testId },
    include: {
      _count: {
        select: {
          questions: true
        }
      }
    }
  })

  if (!test) {
    return NextResponse.json(
      { error: 'Test not found' },
      { status: 404 }
    )
  }

  if (test._count.questions === 0) {
    return NextResponse.json(
      { error: 'Cannot publish test without questions' },
      { status: 400 }
    )
  }

  const updatedTest = await db.test.update({
    where: { id: testId },
    data: { status: 'PUBLISHED' }
  })

  return NextResponse.json(updatedTest)
}

async function duplicateTest(testId: string) {
  const originalTest = await db.test.findUnique({
    where: { id: testId },
    include: {
      sections: {
        include: {
          questions: {
            include: {
              question: true
            }
          }
        }
      }
    }
  })

  if (!originalTest) {
    return NextResponse.json(
      { error: 'Test not found' },
      { status: 404 }
    )
  }

  // Create duplicate test
  const duplicatedTest = await db.test.create({
    data: {
      title: `${originalTest.title} (Copy)`,
      description: originalTest.description,
      code: originalTest.code ? `${originalTest.code}_copy` : null,
      template_id: originalTest.template_id,
      organization_id: originalTest.organization_id,
      mode: originalTest.mode,
      status: 'DRAFT',
      duration: originalTest.duration,
      start_time: originalTest.start_time,
      end_time: originalTest.end_time,
      max_attempts: originalTest.max_attempts,
      shuffle_questions: originalTest.shuffle_questions,
      shuffle_options: originalTest.shuffle_options,
      show_results: originalTest.show_results,
      show_solutions: originalTest.show_solutions,
      allow_review: originalTest.allow_review,
      negative_marking: originalTest.negative_marking,
      passing_marks: originalTest.passing_marks,
      instructions: originalTest.instructions,
      settings: originalTest.settings,
      total_marks: originalTest.total_marks,
      created_by_id: originalTest.created_by_id
    }
  })

  // Duplicate sections and questions
  for (const section of originalTest.sections) {
    const duplicatedSection = await db.testSection.create({
      data: {
        test_id: duplicatedTest.id,
        name: section.name,
        description: section.description,
        order: section.order,
        duration: section.duration,
        marks: section.marks,
        instructions: section.instructions,
        settings: section.settings
      }
    })

    for (const testQuestion of section.questions) {
      await db.testQuestion.create({
        data: {
          test_id: duplicatedTest.id,
          section_id: duplicatedSection.id,
          question_id: testQuestion.question_id,
          order: testQuestion.order,
          marks: testQuestion.marks,
          negative_marks: testQuestion.negative_marks,
          settings: testQuestion.settings
        }
      })
    }
  }

  // Fetch the complete duplicated test
  const completeDuplicatedTest = await db.test.findUnique({
    where: { id: duplicatedTest.id },
    include: {
      organization: {
        select: { id: true, name: true, slug: true }
      },
      created_by: {
        select: { id: true, name: true, email: true }
      },
      template: {
        select: { id: true, name: true, type: true }
      },
      sections: {
        include: {
          questions: {
            include: {
              question: {
                select: {
                  id: true,
                  title: true,
                  content: true,
                  type: true,
                  difficulty: true,
                  marks: true,
                  subject: { select: { name: true } },
                  chapter: { select: { name: true } }
                }
              }
            },
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { order: 'asc' }
      }
    }
  })

  return NextResponse.json(completeDuplicatedTest, { status: 201 })
}

async function regenerateTest(testId: string, blueprint: any) {
  // This would be similar to the auto-assembly logic in the POST /api/tests route
  // For now, we'll just return a success message
  return NextResponse.json({ message: 'Test regeneration initiated' })
}