import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TestMode, TestStatus } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const organizationId = searchParams.get('organizationId')
    const createdBy = searchParams.get('createdBy')
    const mode = searchParams.get('mode') as TestMode
    const status = searchParams.get('status') as TestStatus
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    const where: any = {}
    
    if (organizationId) where.organization_id = organizationId
    if (createdBy) where.created_by_id = createdBy
    if (mode) where.mode = mode
    if (status) where.status = status
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [tests, total] = await Promise.all([
      db.test.findMany({
        where,
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
                }
              }
            }
          },
          _count: {
            select: {
              attempts: true,
              questions: true,
              assignments: true
            }
          }
        },
        orderBy: { updated_at: 'desc' },
        skip,
        take: limit
      }),
      db.test.count({ where })
    ])

    return NextResponse.json({
      tests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching tests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tests' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      code,
      templateId,
      organizationId,
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
      sections,
      autoAssembly,
      blueprint
    } = body

    // Validate required fields
    if (!title || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields: title, organizationId' },
        { status: 400 }
      )
    }

    // Create the test
    const test = await db.test.create({
      data: {
        title,
        description,
        code,
        template_id: templateId,
        organization_id: organizationId,
        mode: mode || TestMode.PRACTICE,
        status: TestStatus.DRAFT,
        duration: duration || 60,
        start_time: startTime ? new Date(startTime) : null,
        end_time: endTime ? new Date(endTime) : null,
        max_attempts: maxAttempts || 1,
        shuffle_questions: shuffleQuestions !== false,
        shuffle_options: shuffleOptions !== false,
        show_results: showResults !== false,
        show_solutions: showSolutions || false,
        allow_review: allowReview !== false,
        negative_marking: negativeMarking || {},
        passing_marks: passingMarks,
        instructions,
        settings: settings || {},
        created_by_id: body.createdById || 'system' // This should come from auth
      },
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

    // If auto-assembly is requested, generate test from blueprint
    if (autoAssembly && blueprint) {
      const assembledTest = await assembleTestFromBlueprint(test.id, blueprint)
      return NextResponse.json(assembledTest, { status: 201 })
    }

    // If manual sections are provided, create them
    if (sections && Array.isArray(sections)) {
      for (const sectionData of sections) {
        const section = await db.testSection.create({
          data: {
            test_id: test.id,
            name: sectionData.name,
            description: sectionData.description,
            order: sectionData.order || 0,
            duration: sectionData.duration,
            marks: sectionData.marks,
            instructions: sectionData.instructions,
            settings: sectionData.settings || {}
          }
        })

        // Add questions to section if provided
        if (sectionData.questions && Array.isArray(sectionData.questions)) {
          for (let i = 0; i < sectionData.questions.length; i++) {
            const questionData = sectionData.questions[i]
            await db.testQuestion.create({
              data: {
                test_id: test.id,
                section_id: section.id,
                question_id: questionData.questionId,
                order: questionData.order || i,
                marks: questionData.marks,
                negative_marks: questionData.negativeMarks,
                settings: questionData.settings || {}
              }
            })
          }
        }
      }
    }

    // Fetch the complete test with sections and questions
    const completeTest = await db.test.findUnique({
      where: { id: test.id },
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

    return NextResponse.json(completeTest, { status: 201 })
  } catch (error) {
    console.error('Error creating test:', error)
    return NextResponse.json(
      { error: 'Failed to create test' },
      { status: 500 }
    )
  }
}

// Helper function to assemble test from blueprint
async function assembleTestFromBlueprint(testId: string, blueprint: any) {
  try {
    const { 
      subjects, 
      chapters, 
      topics, 
      difficultyMix, 
      questionCount, 
      timePerSection,
      negativeMarkingRules 
    } = blueprint

    // Build where clause for question selection
    const whereClause: any = { status: 'APPROVED' }
    
    if (subjects && subjects.length > 0) {
      whereClause.subject_id = { in: subjects }
    }
    
    if (chapters && chapters.length > 0) {
      whereClause.chapter_id = { in: chapters }
    }
    
    if (topics && topics.length > 0) {
      whereClause.topic_id = { in: topics }
    }

    // Get questions matching criteria
    const availableQuestions = await db.question.findMany({
      where: whereClause,
      include: {
        subject: true,
        chapter: true,
        topic: true
      }
    })

    // Filter by difficulty mix
    const filteredQuestions = availableQuestions.filter(question => {
      if (!difficultyMix) return true
      return difficultyMix.includes(question.difficulty)
    })

    // Shuffle and select required number of questions
    const shuffledQuestions = filteredQuestions.sort(() => Math.random() - 0.5)
    const selectedQuestions = shuffledQuestions.slice(0, questionCount || 50)

    // Create sections based on subjects or create one main section
    const sectionsBySubject = selectedQuestions.reduce((acc, question) => {
      if (!acc[question.subject_id]) {
        acc[question.subject_id] = {
          name: question.subject.name,
          questions: []
        }
      }
      acc[question.subject_id].questions.push(question)
      return acc
    }, {} as any)

    // Create sections and add questions
    let totalMarks = 0
    const createdSections = []

    for (const [subjectId, sectionData] of Object.entries(sectionsBySubject)) {
      const section = await db.testSection.create({
        data: {
          test_id: testId,
          name: sectionData.name,
          description: `Questions for ${sectionData.name}`,
          order: createdSections.length,
          duration: timePerSection,
          marks: sectionData.questions.reduce((sum: number, q: any) => sum + q.marks, 0)
        }
      })

      for (let i = 0; i < sectionData.questions.length; i++) {
        const question = sectionData.questions[i]
        await db.testQuestion.create({
          data: {
            test_id: testId,
            section_id: section.id,
            question_id: question.id,
            order: i,
            marks: question.marks,
            negative_marks: question.negative_marks
          }
        })
        totalMarks += question.marks
      }

      createdSections.push(section)
    }

    // Update test with total marks
    await db.test.update({
      where: { id: testId },
      data: { total_marks: totalMarks }
    })

    // Return the complete test
    const completeTest = await db.test.findUnique({
      where: { id: testId },
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

    return completeTest
  } catch (error) {
    console.error('Error assembling test from blueprint:', error)
    throw error
  }
}