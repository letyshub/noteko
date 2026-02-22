import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import * as schema from '@main/database/schema'

// Mock electron and electron-log (required by connection module)
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue(os.tmpdir()),
  },
}))

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock getDb to return our test database instance
const mockGetDb = vi.fn()
vi.mock('@main/database/connection', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}))

const createTables = (sqlite: Database.Database): void => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      parent_folder_id INTEGER REFERENCES folders(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      folder_id INTEGER NOT NULL REFERENCES folders(id),
      project_id INTEGER NOT NULL REFERENCES projects(id),
      processing_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id) UNIQUE,
      raw_text TEXT,
      summary TEXT,
      key_points TEXT,
      key_terms TEXT,
      summary_style TEXT,
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id),
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
      question TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      answers TEXT,
      completed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      created_at TEXT NOT NULL
    );
  `)
}

/**
 * Helper to create prerequisite data for tests that need documents
 * (project -> folder -> document chain)
 */
const createDocumentPrerequisites = (db: BetterSQLite3Database<typeof schema>) => {
  const project = db
    .insert(schema.projects)
    .values({
      name: 'Test Project',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .returning()
    .get()!

  const folder = db
    .insert(schema.folders)
    .values({
      name: 'Test Folder',
      project_id: project.id,
      created_at: new Date().toISOString(),
    })
    .returning()
    .get()!

  const document = db
    .insert(schema.documents)
    .values({
      name: 'test.pdf',
      file_path: '/test/test.pdf',
      file_type: 'pdf',
      file_size: 1024,
      folder_id: folder.id,
      project_id: project.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .returning()
    .get()!

  return { project, folder, document }
}

describe('service layer', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-svc-test-'))
    const dbPath = path.join(tmpDir, 'test.db')
    sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    createTables(sqlite)
    db = drizzle(sqlite, { schema })
    mockGetDb.mockReturnValue(db)
  })

  afterEach(() => {
    sqlite.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
    mockGetDb.mockReset()
  })

  // ─── Project Service ───────────────────────────────────────────

  describe('projectService', () => {
    it('should create a project and return it with an id', async () => {
      const { createProject } = await import('@main/services/project-service')

      const result = createProject({ name: 'My Project', description: 'A test project', color: '#ff0000' })

      expect(result).toBeDefined()
      expect(result!.id).toBeTypeOf('number')
      expect(result!.name).toBe('My Project')
      expect(result!.description).toBe('A test project')
      expect(result!.color).toBe('#ff0000')
      expect(result!.created_at).toBeDefined()
      expect(result!.updated_at).toBeDefined()
    })

    it('should list all projects', async () => {
      const { createProject, listProjects } = await import('@main/services/project-service')

      createProject({ name: 'Project A' })
      createProject({ name: 'Project B' })

      const all = listProjects()

      expect(all).toHaveLength(2)
      expect(all.map((p) => p.name)).toContain('Project A')
      expect(all.map((p) => p.name)).toContain('Project B')
    })

    it('should get a single project by id', async () => {
      const { createProject, getProject } = await import('@main/services/project-service')

      const created = createProject({ name: 'Find Me' })
      const found = getProject(created!.id)

      expect(found).toBeDefined()
      expect(found!.name).toBe('Find Me')
    })

    it('should return undefined for a non-existent project', async () => {
      const { getProject } = await import('@main/services/project-service')

      const result = getProject(9999)

      expect(result).toBeUndefined()
    })

    it('should update a project', async () => {
      const { createProject, updateProject, getProject } = await import('@main/services/project-service')

      const created = createProject({ name: 'Old Name' })
      const updated = updateProject(created!.id, { name: 'New Name', description: 'Updated' })

      expect(updated).toBeDefined()
      expect(updated!.name).toBe('New Name')
      expect(updated!.description).toBe('Updated')

      // Verify via getProject
      const fetched = getProject(created!.id)
      expect(fetched!.name).toBe('New Name')
    })

    it('should delete a project', async () => {
      const { createProject, deleteProject, getProject } = await import('@main/services/project-service')

      const created = createProject({ name: 'To Delete' })
      const deleted = deleteProject(created!.id)

      expect(deleted).toBeDefined()
      expect(deleted!.id).toBe(created!.id)

      const fetched = getProject(created!.id)
      expect(fetched).toBeUndefined()
    })
  })

  // ─── Folder Service ────────────────────────────────────────────

  describe('folderService', () => {
    it('should create a folder within a project', async () => {
      const { createProject } = await import('@main/services/project-service')
      const { createFolder } = await import('@main/services/folder-service')

      const project = createProject({ name: 'Folder Test Project' })
      const folder = createFolder({ name: 'My Folder', project_id: project!.id })

      expect(folder).toBeDefined()
      expect(folder!.id).toBeTypeOf('number')
      expect(folder!.name).toBe('My Folder')
      expect(folder!.project_id).toBe(project!.id)
    })

    it('should list folders by project id', async () => {
      const { createProject } = await import('@main/services/project-service')
      const { createFolder, listFolders } = await import('@main/services/folder-service')

      const projectA = createProject({ name: 'Project A' })
      const projectB = createProject({ name: 'Project B' })

      createFolder({ name: 'Folder A1', project_id: projectA!.id })
      createFolder({ name: 'Folder A2', project_id: projectA!.id })
      createFolder({ name: 'Folder B1', project_id: projectB!.id })

      const foldersA = listFolders(projectA!.id)
      const foldersB = listFolders(projectB!.id)

      expect(foldersA).toHaveLength(2)
      expect(foldersB).toHaveLength(1)
      expect(foldersA.map((f) => f.name)).toContain('Folder A1')
      expect(foldersA.map((f) => f.name)).toContain('Folder A2')
    })

    it('should update a folder', async () => {
      const { createProject } = await import('@main/services/project-service')
      const { createFolder, updateFolder } = await import('@main/services/folder-service')

      const project = createProject({ name: 'Update Folder Project' })
      const folder = createFolder({ name: 'Old Folder Name', project_id: project!.id })
      const updated = updateFolder(folder!.id, { name: 'New Folder Name' })

      expect(updated).toBeDefined()
      expect(updated!.name).toBe('New Folder Name')
    })

    it('should delete a folder', async () => {
      const { createProject } = await import('@main/services/project-service')
      const { createFolder, deleteFolder, listFolders } = await import('@main/services/folder-service')

      const project = createProject({ name: 'Delete Folder Project' })
      const folder = createFolder({ name: 'To Delete', project_id: project!.id })

      const deleted = deleteFolder(folder!.id)
      expect(deleted).toBeDefined()
      expect(deleted!.id).toBe(folder!.id)

      const remaining = listFolders(project!.id)
      expect(remaining).toHaveLength(0)
    })
  })

  // ─── Document Service ──────────────────────────────────────────

  describe('documentService', () => {
    it('should create a document', async () => {
      const { createDocument } = await import('@main/services/document-service')

      const { project, folder } = createDocumentPrerequisites(db)
      const doc = createDocument({
        name: 'notes.pdf',
        file_path: '/uploads/notes.pdf',
        file_type: 'pdf',
        file_size: 2048,
        folder_id: folder.id,
        project_id: project.id,
      })

      expect(doc).toBeDefined()
      expect(doc!.id).toBeTypeOf('number')
      expect(doc!.name).toBe('notes.pdf')
      expect(doc!.file_type).toBe('pdf')
    })

    it('should list documents by project id', async () => {
      const { createDocument, listDocumentsByProject } = await import('@main/services/document-service')

      const { project, folder } = createDocumentPrerequisites(db)
      createDocument({
        name: 'doc1.pdf',
        file_path: '/uploads/doc1.pdf',
        file_type: 'pdf',
        file_size: 100,
        folder_id: folder.id,
        project_id: project.id,
      })
      createDocument({
        name: 'doc2.pdf',
        file_path: '/uploads/doc2.pdf',
        file_type: 'pdf',
        file_size: 200,
        folder_id: folder.id,
        project_id: project.id,
      })

      const docs = listDocumentsByProject(project.id)
      expect(docs).toHaveLength(3) // 2 new + 1 from prerequisites
    })

    it('should get a document with its content', async () => {
      const { createDocument, getDocumentWithContent } = await import('@main/services/document-service')

      const { project, folder } = createDocumentPrerequisites(db)
      const doc = createDocument({
        name: 'with-content.pdf',
        file_path: '/uploads/with-content.pdf',
        file_type: 'pdf',
        file_size: 500,
        folder_id: folder.id,
        project_id: project.id,
      })

      // Insert content directly for the test
      db.insert(schema.documentContent)
        .values({
          document_id: doc!.id,
          raw_text: 'Hello world',
          summary: 'A greeting',
          key_points: ['greeting', 'world'],
          processed_at: new Date().toISOString(),
        })
        .run()

      const result = getDocumentWithContent(doc!.id)
      expect(result).toBeDefined()
      expect(result!.document.name).toBe('with-content.pdf')
      expect(result!.content).toBeDefined()
      expect(result!.content!.raw_text).toBe('Hello world')
      expect(result!.content!.summary).toBe('A greeting')
    })

    it('should delete a document', async () => {
      const { createDocument, deleteDocument, listDocumentsByProject } = await import('@main/services/document-service')

      const { project, folder, document: existingDoc } = createDocumentPrerequisites(db)
      const doc = createDocument({
        name: 'to-delete.pdf',
        file_path: '/uploads/to-delete.pdf',
        file_type: 'pdf',
        file_size: 100,
        folder_id: folder.id,
        project_id: project.id,
      })

      deleteDocument(doc!.id)

      const docs = listDocumentsByProject(project.id)
      expect(docs).toHaveLength(1) // Only the prerequisite doc remains
      expect(docs[0].id).toBe(existingDoc.id)
    })
  })

  // ─── Quiz Service ──────────────────────────────────────────────

  describe('quizService', () => {
    it('should create a quiz with questions', async () => {
      const { createQuiz } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)
      const quiz = createQuiz({
        title: 'Chapter 1 Quiz',
        document_id: document.id,
        questions: [
          {
            question: 'What is 2+2?',
            options: ['3', '4', '5'],
            correct_answer: '4',
            explanation: 'Basic arithmetic',
          },
          {
            question: 'What color is the sky?',
            options: ['Red', 'Blue', 'Green'],
            correct_answer: 'Blue',
          },
        ],
      })

      expect(quiz).toBeDefined()
      expect(quiz!.id).toBeTypeOf('number')
      expect(quiz!.title).toBe('Chapter 1 Quiz')
    })

    it('should list quizzes by document id', async () => {
      const { createQuiz, listQuizzesByDocument } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)
      createQuiz({ title: 'Quiz 1', document_id: document.id, questions: [] })
      createQuiz({ title: 'Quiz 2', document_id: document.id, questions: [] })

      const quizzes = listQuizzesByDocument(document.id)
      expect(quizzes).toHaveLength(2)
    })

    it('should get a quiz with its questions', async () => {
      const { createQuiz, getQuizWithQuestions } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)
      const quiz = createQuiz({
        title: 'Detailed Quiz',
        document_id: document.id,
        questions: [
          {
            question: 'Test question?',
            options: ['A', 'B'],
            correct_answer: 'A',
            explanation: 'Because A',
          },
        ],
      })

      const result = getQuizWithQuestions(quiz!.id)
      expect(result).toBeDefined()
      expect(result!.quiz.title).toBe('Detailed Quiz')
      expect(result!.questions).toHaveLength(1)
      expect(result!.questions[0].question).toBe('Test question?')
      expect(result!.questions[0].correct_answer).toBe('A')
    })

    it('should record a quiz attempt', async () => {
      const { createQuiz, recordAttempt, listAttempts } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)
      const quiz = createQuiz({
        title: 'Attempt Quiz',
        document_id: document.id,
        questions: [{ question: 'Q1?', options: ['A', 'B'], correct_answer: 'A' }],
      })

      const attempt = recordAttempt({
        quiz_id: quiz!.id,
        score: 1,
        total_questions: 1,
        answers: { '1': 'A' },
      })

      expect(attempt).toBeDefined()
      expect(attempt!.score).toBe(1)
      expect(attempt!.total_questions).toBe(1)

      const attempts = listAttempts(quiz!.id)
      expect(attempts).toHaveLength(1)
    })

    it('should delete a quiz', async () => {
      const { createQuiz, deleteQuiz, listQuizzesByDocument } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)
      createQuiz({ title: 'To Delete', document_id: document.id, questions: [] })
      createQuiz({ title: 'Keep', document_id: document.id, questions: [] })

      const quizzes = listQuizzesByDocument(document.id)
      const toDelete = quizzes.find((q) => q.title === 'To Delete')!
      deleteQuiz(toDelete.id)

      const remaining = listQuizzesByDocument(document.id)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].title).toBe('Keep')
    })
  })

  // ─── Cascade Delete Tests ─────────────────────────────────────

  describe('cascadeDeleteProject', () => {
    it('should delete project and all associated folders, documents, content, quizzes, questions, and attempts', async () => {
      const { createProject } = await import('@main/services/project-service')
      const { cascadeDeleteProject } = await import('@main/services/project-service')
      const { createFolder } = await import('@main/services/folder-service')
      const { createDocument } = await import('@main/services/document-service')
      const { createQuiz, recordAttempt } = await import('@main/services/quiz-service')

      // Create project with full hierarchy
      const project = createProject({ name: 'Cascade Delete Project' })!
      const folder = createFolder({ name: 'Folder', project_id: project.id })!
      const doc = createDocument({
        name: 'doc.pdf',
        file_path: '/test/doc.pdf',
        file_type: 'pdf',
        file_size: 100,
        folder_id: folder.id,
        project_id: project.id,
      })!

      // Add document content
      db.insert(schema.documentContent)
        .values({
          document_id: doc.id,
          raw_text: 'Some text',
          processed_at: new Date().toISOString(),
        })
        .run()

      // Add quiz with questions
      const quiz = createQuiz({
        title: 'Test Quiz',
        document_id: doc.id,
        questions: [{ question: 'Q1?', options: ['A', 'B'], correct_answer: 'A' }],
      })!

      // Add quiz attempt
      recordAttempt({ quiz_id: quiz.id, score: 1, total_questions: 1 })

      // Perform cascade delete
      cascadeDeleteProject(project.id)

      // Verify everything is gone
      const remainingProjects = db.select().from(schema.projects).all()
      const remainingFolders = db.select().from(schema.folders).all()
      const remainingDocs = db.select().from(schema.documents).all()
      const remainingContent = db.select().from(schema.documentContent).all()
      const remainingQuizzes = db.select().from(schema.quizzes).all()
      const remainingQuestions = db.select().from(schema.quizQuestions).all()
      const remainingAttempts = db.select().from(schema.quizAttempts).all()

      expect(remainingProjects).toHaveLength(0)
      expect(remainingFolders).toHaveLength(0)
      expect(remainingDocs).toHaveLength(0)
      expect(remainingContent).toHaveLength(0)
      expect(remainingQuizzes).toHaveLength(0)
      expect(remainingQuestions).toHaveLength(0)
      expect(remainingAttempts).toHaveLength(0)
    })
  })

  describe('cascadeDeleteFolder', () => {
    it('should delete folder, nested subfolders, and documents in those folders', async () => {
      const { createProject } = await import('@main/services/project-service')
      const { createFolder } = await import('@main/services/folder-service')
      const { cascadeDeleteFolder } = await import('@main/services/folder-service')
      const { createDocument } = await import('@main/services/document-service')
      const { createQuiz } = await import('@main/services/quiz-service')

      const project = createProject({ name: 'Cascade Folder Project' })!

      // Create folder hierarchy: root -> child -> grandchild
      const rootFolder = createFolder({ name: 'Root', project_id: project.id })!
      const childFolder = createFolder({ name: 'Child', project_id: project.id, parent_folder_id: rootFolder.id })!
      const grandchildFolder = createFolder({
        name: 'Grandchild',
        project_id: project.id,
        parent_folder_id: childFolder.id,
      })!

      // Create a sibling folder that should NOT be deleted
      const siblingFolder = createFolder({ name: 'Sibling', project_id: project.id })!

      // Add documents to various levels
      const docInRoot = createDocument({
        name: 'root-doc.pdf',
        file_path: '/test/root-doc.pdf',
        file_type: 'pdf',
        file_size: 100,
        folder_id: rootFolder.id,
        project_id: project.id,
      })!

      createDocument({
        name: 'grandchild-doc.pdf',
        file_path: '/test/grandchild-doc.pdf',
        file_type: 'pdf',
        file_size: 200,
        folder_id: grandchildFolder.id,
        project_id: project.id,
      })

      // Add a document in the sibling folder (should survive)
      createDocument({
        name: 'sibling-doc.pdf',
        file_path: '/test/sibling-doc.pdf',
        file_type: 'pdf',
        file_size: 300,
        folder_id: siblingFolder.id,
        project_id: project.id,
      })

      // Add document content and quiz for root doc
      db.insert(schema.documentContent)
        .values({
          document_id: docInRoot.id,
          raw_text: 'Root doc text',
          processed_at: new Date().toISOString(),
        })
        .run()

      createQuiz({
        title: 'Root Doc Quiz',
        document_id: docInRoot.id,
        questions: [{ question: 'Q?', options: ['A'], correct_answer: 'A' }],
      })

      // Cascade delete the root folder
      cascadeDeleteFolder(rootFolder.id)

      // Verify: root, child, grandchild folders gone; sibling remains
      const remainingFolders = db.select().from(schema.folders).all()
      expect(remainingFolders).toHaveLength(1)
      expect(remainingFolders[0].name).toBe('Sibling')

      // Verify: documents in deleted folders gone; sibling doc remains
      const remainingDocs = db.select().from(schema.documents).all()
      expect(remainingDocs).toHaveLength(1)
      expect(remainingDocs[0].name).toBe('sibling-doc.pdf')

      // Verify: content and quizzes cleaned up
      const remainingContent = db.select().from(schema.documentContent).all()
      expect(remainingContent).toHaveLength(0)

      const remainingQuizzes = db.select().from(schema.quizzes).all()
      expect(remainingQuizzes).toHaveLength(0)

      const remainingQuestions = db.select().from(schema.quizQuestions).all()
      expect(remainingQuestions).toHaveLength(0)
    })
  })

  describe('updateDocument with folder_id', () => {
    it('should update a document folder_id', async () => {
      const { createProject } = await import('@main/services/project-service')
      const { createFolder } = await import('@main/services/folder-service')
      const { createDocument, updateDocument } = await import('@main/services/document-service')

      const project = createProject({ name: 'Move Doc Project' })!
      const folderA = createFolder({ name: 'Folder A', project_id: project.id })!
      const folderB = createFolder({ name: 'Folder B', project_id: project.id })!

      const doc = createDocument({
        name: 'movable.pdf',
        file_path: '/test/movable.pdf',
        file_type: 'pdf',
        file_size: 100,
        folder_id: folderA.id,
        project_id: project.id,
      })!

      expect(doc.folder_id).toBe(folderA.id)

      const updated = updateDocument(doc.id, { folder_id: folderB.id })

      expect(updated).toBeDefined()
      expect(updated!.folder_id).toBe(folderB.id)
      expect(updated!.name).toBe('movable.pdf') // unchanged
    })
  })
})
