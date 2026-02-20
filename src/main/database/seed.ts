import Database from 'better-sqlite3'
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3'
import { projects, folders, documents, documentContent, quizzes, quizQuestions, quizAttempts, appLogs } from './schema'
import * as schema from './schema'

/**
 * Seed the database with realistic development data.
 *
 * Accepts an optional Drizzle db instance for test isolation.
 * When called without an argument (from the script), it creates its own connection.
 */
export const seed = (db: BetterSQLite3Database<typeof schema>): void => {
  // 1. Delete existing data in reverse FK order for idempotency
  db.delete(quizAttempts).run()
  db.delete(quizQuestions).run()
  db.delete(quizzes).run()
  db.delete(documentContent).run()
  db.delete(documents).run()
  db.delete(folders).run()
  db.delete(projects).run()
  db.delete(appLogs).run()

  // 2. Insert projects
  const insertedProjects = db
    .insert(projects)
    .values([
      {
        name: 'Machine Learning Fundamentals',
        description: 'Course materials for intro to ML',
        color: '#3B82F6',
        created_at: '2026-01-15T10:00:00.000Z',
        updated_at: '2026-02-10T14:30:00.000Z',
      },
      {
        name: 'Software Architecture',
        description: 'Design patterns and system architecture notes',
        color: '#10B981',
        created_at: '2026-01-20T09:00:00.000Z',
        updated_at: '2026-02-15T11:00:00.000Z',
      },
      {
        name: 'History Research',
        description: 'Primary sources and analysis for history thesis',
        color: '#F59E0B',
        created_at: '2026-02-01T08:00:00.000Z',
        updated_at: '2026-02-18T16:45:00.000Z',
      },
    ])
    .returning()
    .all()

  const [mlProject, archProject] = insertedProjects

  // 3. Insert folders (2 root-level, 2-3 nested)
  const insertedFolders = db
    .insert(folders)
    .values([
      {
        name: 'Lectures',
        project_id: mlProject.id,
        parent_folder_id: null,
        created_at: '2026-01-15T10:05:00.000Z',
      },
      {
        name: 'Design Patterns',
        project_id: archProject.id,
        parent_folder_id: null,
        created_at: '2026-01-20T09:10:00.000Z',
      },
    ])
    .returning()
    .all()

  const [lecturesFolder, patternsFolder] = insertedFolders

  // Nested folders
  const nestedFolders = db
    .insert(folders)
    .values([
      {
        name: 'Week 1 - Regression',
        project_id: mlProject.id,
        parent_folder_id: lecturesFolder.id,
        created_at: '2026-01-16T08:00:00.000Z',
      },
      {
        name: 'Week 2 - Classification',
        project_id: mlProject.id,
        parent_folder_id: lecturesFolder.id,
        created_at: '2026-01-23T08:00:00.000Z',
      },
      {
        name: 'Creational Patterns',
        project_id: archProject.id,
        parent_folder_id: patternsFolder.id,
        created_at: '2026-01-21T10:00:00.000Z',
      },
    ])
    .returning()
    .all()

  const [week1Folder, week2Folder, creationalFolder] = nestedFolders

  // 4. Insert documents linked to folders and projects
  const insertedDocs = db
    .insert(documents)
    .values([
      {
        name: 'Linear Regression Notes.pdf',
        file_path: '/docs/ml/linear-regression-notes.pdf',
        file_type: 'pdf',
        file_size: 245_000,
        folder_id: week1Folder.id,
        project_id: mlProject.id,
        created_at: '2026-01-16T09:00:00.000Z',
        updated_at: '2026-01-16T09:00:00.000Z',
      },
      {
        name: 'Logistic Regression Slides.pdf',
        file_path: '/docs/ml/logistic-regression-slides.pdf',
        file_type: 'pdf',
        file_size: 1_200_000,
        folder_id: week2Folder.id,
        project_id: mlProject.id,
        created_at: '2026-01-23T09:30:00.000Z',
        updated_at: '2026-01-23T09:30:00.000Z',
      },
      {
        name: 'Factory Pattern Overview.docx',
        file_path: '/docs/arch/factory-pattern-overview.docx',
        file_type: 'docx',
        file_size: 85_000,
        folder_id: creationalFolder.id,
        project_id: archProject.id,
        created_at: '2026-01-22T11:00:00.000Z',
        updated_at: '2026-02-05T14:20:00.000Z',
      },
      {
        name: 'Renaissance Primary Sources.pdf',
        file_path: '/docs/hist/renaissance-primary-sources.pdf',
        file_type: 'pdf',
        file_size: 3_500_000,
        folder_id: lecturesFolder.id,
        project_id: mlProject.id,
        created_at: '2026-02-02T10:00:00.000Z',
        updated_at: '2026-02-02T10:00:00.000Z',
      },
    ])
    .returning()
    .all()

  const [linearDoc, logisticDoc, factoryDoc, renaissanceDoc] = insertedDocs

  // 5. Insert document_content for each document
  db.insert(documentContent)
    .values([
      {
        document_id: linearDoc.id,
        raw_text:
          'Linear regression is a supervised learning algorithm that models the relationship between a dependent variable and one or more independent variables using a linear equation.',
        summary: 'Introduction to linear regression covering simple and multiple regression techniques.',
        key_points: [
          'Linear regression models the relationship between variables',
          'Least squares method minimizes prediction error',
          'R-squared measures model fit quality',
        ],
        processed_at: '2026-01-16T09:15:00.000Z',
      },
      {
        document_id: logisticDoc.id,
        raw_text:
          'Logistic regression is used for binary classification problems. It uses the sigmoid function to map predicted values to probabilities between 0 and 1.',
        summary: 'Logistic regression fundamentals for binary and multi-class classification.',
        key_points: [
          'Sigmoid function maps outputs to probabilities',
          'Cross-entropy loss for optimization',
          'Decision boundary separates classes',
          'Can be extended to multi-class via softmax',
        ],
        processed_at: '2026-01-23T10:00:00.000Z',
      },
      {
        document_id: factoryDoc.id,
        raw_text:
          'The Factory Method pattern defines an interface for creating an object but lets subclasses decide which class to instantiate. Factory Method lets a class defer instantiation to subclasses.',
        summary: 'Overview of the Factory Method design pattern with implementation examples.',
        key_points: ['Encapsulates object creation logic', 'Promotes loose coupling', 'Enables runtime polymorphism'],
        processed_at: '2026-01-22T11:30:00.000Z',
      },
      {
        document_id: renaissanceDoc.id,
        raw_text:
          'The Renaissance was a period of cultural, artistic, political, and economic rebirth following the Middle Ages. It began in Italy in the 14th century and spread throughout Europe.',
        summary: 'Collection of primary sources from the Italian Renaissance period.',
        key_points: [
          'Humanism as a central philosophy',
          'Revival of classical Greek and Roman ideals',
          'Impact on art, science, and governance',
        ],
        processed_at: '2026-02-02T10:30:00.000Z',
      },
    ])
    .run()

  // 6. Insert quizzes linked to documents
  const insertedQuizzes = db
    .insert(quizzes)
    .values([
      {
        document_id: linearDoc.id,
        title: 'Linear Regression Concepts Quiz',
        created_at: '2026-01-17T14:00:00.000Z',
      },
      {
        document_id: factoryDoc.id,
        title: 'Factory Pattern Knowledge Check',
        created_at: '2026-01-25T16:00:00.000Z',
      },
    ])
    .returning()
    .all()

  const [mlQuiz, patternQuiz] = insertedQuizzes

  // 7. Insert quiz_questions (3-4 per quiz)
  db.insert(quizQuestions)
    .values([
      {
        quiz_id: mlQuiz.id,
        question: 'What does linear regression model?',
        options: [
          'Relationship between dependent and independent variables',
          'Classification boundaries',
          'Clustering patterns',
          'Time series forecasts',
        ],
        correct_answer: 'Relationship between dependent and independent variables',
        explanation:
          'Linear regression models the linear relationship between a dependent variable and one or more independent variables.',
      },
      {
        quiz_id: mlQuiz.id,
        question: 'What method does linear regression use to minimize error?',
        options: ['Gradient descent only', 'Least squares method', 'Maximum likelihood', 'Bayesian estimation'],
        correct_answer: 'Least squares method',
        explanation: 'The ordinary least squares method minimizes the sum of squared residuals.',
      },
      {
        quiz_id: mlQuiz.id,
        question: 'What does R-squared measure?',
        options: ['Prediction speed', 'Model fit quality', 'Data size', 'Feature importance'],
        correct_answer: 'Model fit quality',
        explanation: 'R-squared indicates the proportion of variance in the dependent variable explained by the model.',
      },
      {
        quiz_id: patternQuiz.id,
        question: 'What is the main purpose of the Factory Method pattern?',
        options: [
          'Direct object instantiation',
          'Encapsulating object creation logic',
          'Reducing memory usage',
          'Improving network performance',
        ],
        correct_answer: 'Encapsulating object creation logic',
        explanation:
          'Factory Method encapsulates object creation, letting subclasses decide which class to instantiate.',
      },
      {
        quiz_id: patternQuiz.id,
        question: 'What does the Factory Method pattern promote?',
        options: ['Tight coupling', 'Loose coupling', 'Global state', 'Circular dependencies'],
        correct_answer: 'Loose coupling',
        explanation: 'By deferring instantiation to subclasses, Factory Method promotes loose coupling.',
      },
      {
        quiz_id: patternQuiz.id,
        question: 'Which type of pattern is Factory Method?',
        options: ['Behavioral', 'Structural', 'Creational', 'Architectural'],
        correct_answer: 'Creational',
        explanation: 'Factory Method is a creational design pattern that deals with object creation mechanisms.',
      },
    ])
    .run()

  // 8. Insert quiz_attempts (1-2 per quiz)
  db.insert(quizAttempts)
    .values([
      {
        quiz_id: mlQuiz.id,
        score: 2,
        total_questions: 3,
        answers: {
          '1': 'Relationship between dependent and independent variables',
          '2': 'Gradient descent only',
          '3': 'Model fit quality',
        },
        completed_at: '2026-01-18T10:30:00.000Z',
      },
      {
        quiz_id: mlQuiz.id,
        score: 3,
        total_questions: 3,
        answers: {
          '1': 'Relationship between dependent and independent variables',
          '2': 'Least squares method',
          '3': 'Model fit quality',
        },
        completed_at: '2026-01-19T09:00:00.000Z',
      },
      {
        quiz_id: patternQuiz.id,
        score: 2,
        total_questions: 3,
        answers: {
          '1': 'Encapsulating object creation logic',
          '2': 'Loose coupling',
          '3': 'Behavioral',
        },
        completed_at: '2026-01-26T15:00:00.000Z',
      },
    ])
    .run()

  // 9. Insert app_logs at various levels
  db.insert(appLogs)
    .values([
      {
        level: 'info',
        message: 'Application started successfully',
        context: { version: '0.1.0', platform: 'win32' },
        created_at: '2026-02-20T08:00:00.000Z',
      },
      {
        level: 'info',
        message: 'Database initialized',
        context: { path: './noteko-dev.db', journalMode: 'wal' },
        created_at: '2026-02-20T08:00:01.000Z',
      },
      {
        level: 'warn',
        message: 'Document processing took longer than expected',
        context: { documentId: 1, durationMs: 5200, threshold: 3000 },
        created_at: '2026-02-20T08:05:00.000Z',
      },
      {
        level: 'error',
        message: 'Failed to parse document content',
        context: { documentId: 99, error: 'File not found', stack: 'Error: File not found at parseDocument()' },
        created_at: '2026-02-20T08:10:00.000Z',
      },
      {
        level: 'info',
        message: 'Quiz generated from document analysis',
        context: { documentId: 1, questionCount: 3, modelUsed: 'llama3' },
        created_at: '2026-02-20T08:15:00.000Z',
      },
    ])
    .run()
}

/**
 * Create a standalone database connection and run the seed script.
 * This function is called when the file is executed directly via `tsx`.
 */
const main = (): void => {
  const dbPath = './noteko-dev.db'
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })

  console.log('Seeding database...')
  seed(db)

  // Log table counts for verification
  const tables = [
    'projects',
    'folders',
    'documents',
    'document_content',
    'quizzes',
    'quiz_questions',
    'quiz_attempts',
    'app_logs',
  ] as const

  console.log('\nSeed complete. Table row counts:')
  for (const table of tables) {
    const result = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
    console.log(`  ${table}: ${result.count}`)
  }

  sqlite.close()
  console.log('\nDatabase connection closed.')
}

// Only run when executed directly as a script (not when imported by tests)
// tsx sets the module URL to the file path, so we check if this module is the entry point
const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('src/main/database/seed.ts')
if (isDirectRun) {
  main()
}
